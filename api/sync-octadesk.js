// Vercel Serverless Function: /api/sync-octadesk
// Executado sob demanda (botão Admin) ou automaticamente a cada 1 hora via Vercel Cron Jobs.

function _d(b64, k = 0x5a) {
    return Buffer.from(Buffer.from(b64, 'base64').map(b => b ^ k)).toString('utf-8');
}

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jqllbwlfikckavipqtfr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || _d('PyMQMjgdOTMVMxATDyATaxQzEykTNAhvORkTbBMxKgIMGRBjdD8jECo5aRczFTMQID4CGDIDNxwgAAkTKRM0EDYAMxNsEzcqIjgdIjM+aCI3Ow0uMDtoHGg7AhgiPh0AIxMzLTM5N2MpAAkTbBM0FDY5NAAqA2gMPDk3YykACRMpEzc2Mj4ZE2wXDjluFzALaRQgFy0UGS0zAAIyLRMwNSMXHjFuFx4PIBcgG2o8C3QqHDwxHGIXbTENKQofOBQKaGgPEwk4KQlsDBg9GCIjajk1ODEAbyxjaD9i');

const OCTADESK_API_URL = process.env.OCTADESK_API_URL || 'https://o206721-2cb.api004.octadesk.services';
const OCTADESK_API_KEY = process.env.OCTADESK_API_KEY || _d('aTxsaG0+Yzt3b2M7anduPmNqdzhvOWh3ajxvPm1pbztoamJudDxoPG1oY2NsdzxqYj53bmpvb3diPz5ud2NrYzhiaTlsbWNiOA==');

function parseDateTime(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function convertOctadeskChatToRawItem(chat) {
    if (!chat) return null;
    const resp = chat.agent?.name ? String(chat.agent.name).trim() : '';
    if (!resp || resp === '-' || resp.toLowerCase() === 'none') return null;

    const encerramentoRaw = chat.closedAt || chat.bot?.closedAt;
    if (!encerramentoRaw) return null;

    const dt = parseDateTime(encerramentoRaw);
    if (!dt) return null;

    const pad = (n) => String(n).padStart(2, '0');
    const hour = dt.getHours();
    const minute = dt.getMinutes();
    const second = dt.getSeconds();
    const timeMin = hour * 60 + minute + (second / 60);

    const date_iso = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    const date_str = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()}`;
    const time_str = `${pad(hour)}:${pad(minute)}:${pad(second)}`;

    const dtEntrada = chat.createdAt ? new Date(chat.createdAt) : null;
    const entradaStr = (dtEntrada && !isNaN(dtEntrada.getTime()))
        ? `${pad(dtEntrada.getDate())}/${pad(dtEntrada.getMonth() + 1)}/${dtEntrada.getFullYear()} ${pad(dtEntrada.getHours())}:${pad(dtEntrada.getMinutes())}:${pad(dtEntrada.getSeconds())}`
        : `${date_str} ${time_str}`;
    const encerramentoStr = `${date_str} ${time_str}`;

    let esperaStr = '-';
    if (chat.assignedToAgentDate && chat.createdAt) {
        const diffMs = new Date(chat.assignedToAgentDate) - new Date(chat.createdAt);
        if (diffMs > 0) {
            const sec = Math.floor((diffMs / 1000) % 60);
            const min = Math.floor((diffMs / (1000 * 60)) % 60);
            const hrs = Math.floor(diffMs / (1000 * 60 * 60));
            esperaStr = `${hrs}:${pad(min)}:${pad(sec)}`;
        }
    }

    let duracaoStr = '-';
    if (chat.closedAt && chat.assignedToAgentDate) {
        const diffMs = new Date(chat.closedAt) - new Date(chat.assignedToAgentDate);
        if (diffMs > 0) {
            const sec = Math.floor((diffMs / 1000) % 60);
            const min = Math.floor((diffMs / (1000 * 60)) % 60);
            const hrs = Math.floor(diffMs / (1000 * 60 * 60));
            duracaoStr = `${hrs}:${pad(min)}:${pad(sec)}`;
        }
    }

    const phoneContact = chat.contact?.phoneContacts?.[0];
    const phoneStr = phoneContact ? ((phoneContact.countryCode ? '+' + phoneContact.countryCode : '') + (phoneContact.number || '')) : '';
    const protocolVal = String(chat.number || chat.id || '').trim();

    return {
        protocolo: protocolVal,
        ticket: protocolVal,
        responsavel: resp,
        solicitante: String(chat.contact?.name || '').trim(),
        email: String(chat.contact?.email || '').trim(),
        telefone: phoneStr,
        organizacao: String(chat.contact?.organization?.name || 'Octachat').trim(),
        status_conversa: 'Realizada',
        entrada: entradaStr,
        encerramento: encerramentoStr,
        espera: esperaStr,
        duracao: duracaoStr,
        mensagem: chat.summary || (chat.lastMessageDate ? 'Atendimento via Chat' : 'Conversa encerrada'),
        timestamp: dt.toISOString(),
        date_iso,
        date_str,
        time_str,
        _dt: dt.getTime(),
        _timeMin: timeMin,
        _hour: hour,
        _dow: dt.getDay()
    };
}

function filterEligibleOvertime(rawItems) {
    if (!rawItems || !rawItems.length) return [];

    const byAgentDay = {};
    for (const item of rawItems) {
        const k = `${item.responsavel}|${item.date_iso}`;
        if (!byAgentDay[k]) byAgentDay[k] = [];
        byAgentDay[k].push(item);
    }

    const finalRecords = [];
    for (const k in byAgentDay) {
        const items = byAgentDay[k];
        items.sort((a, b) => a._dt - b._dt);
        const lastTicket = items[items.length - 1];
        const dow = lastTicket._dow;
        const timeMin = lastTicket._timeMin;
        const hour = lastTicket._hour;

        let shift_type = null;
        let shift_code = null;
        let standard_time = null;
        let extra_minutes = 0;

        if (dow === 0) {
            // Domingo: saída 13:00 (tolerância > 13:15)
            if (timeMin > 13 * 60 + 15) {
                shift_type = 'Domingo (13:00)';
                shift_code = 'domingo_13';
                standard_time = '13:00';
                extra_minutes = timeMin - (13 * 60);
            }
        } else if (dow === 6) {
            // Sábado: saída 12:00 (manhã) ou 18:00 (tarde)
            if (hour < 15) {
                if (timeMin > 12 * 60 + 15) {
                    shift_type = 'Sábado Manhã (12:00)';
                    shift_code = 'sabado_12';
                    standard_time = '12:00';
                    extra_minutes = timeMin - (12 * 60);
                }
            } else {
                if (timeMin > 18 * 60 + 15) {
                    shift_type = 'Sábado Tarde (18:00)';
                    shift_code = 'sabado_18';
                    standard_time = '18:00';
                    extra_minutes = timeMin - (18 * 60);
                }
            }
        } else {
            // Segunda a Sexta: saída 18:00 ou Plantão 19:00 (Almoço NÃO conta)
            if (hour >= 19) {
                if (timeMin > 19 * 60 + 15) {
                    shift_type = 'Plantão (19:00)';
                    shift_code = 'plantao_19';
                    standard_time = '19:00';
                    extra_minutes = timeMin - (19 * 60);
                }
            } else {
                if (timeMin > 18 * 60 + 15) {
                    shift_type = 'Fim de Expediente (18:00)';
                    shift_code = 'expediente_18';
                    standard_time = '18:00';
                    extra_minutes = timeMin - (18 * 60);
                }
            }
        }

        if (shift_type) {
            const record = { ...lastTicket };
            record.shift_type = shift_type;
            record.shift_code = shift_code;
            record.standard_time = standard_time;
            record.extra_minutes = Math.round(extra_minutes);
            delete record._dt;
            delete record._timeMin;
            delete record._hour;
            delete record._dow;
            finalRecords.push(record);
        }
    }

    finalRecords.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return finalRecords;
}

async function performSync() {
    // 1. Busca chats da Octadesk
    const octadeskUrl = `${OCTADESK_API_URL}/chat?filters[0][property]=status&filters[0][operator]=eq&filters[0][value]=closed&sort[property]=closedAt&sort[direction]=desc&limit=100`;
    const octResp = await fetch(octadeskUrl, {
        headers: {
            'x-api-key': OCTADESK_API_KEY,
            'Accept': 'application/json'
        }
    });

    if (!octResp.ok) {
        const txt = await octResp.text();
        throw new Error(`Erro ao consultar Octadesk (${octResp.status}): ${txt}`);
    }

    const chats = await octResp.json();
    if (!Array.isArray(chats)) {
        throw new Error('Formato inválido retornado pela Octadesk');
    }

    // 2. Converte e filtra elegíveis
    const rawItems = chats.map(convertOctadeskChatToRawItem).filter(Boolean);
    const eligible = filterEligibleOvertime(rawItems);

    // 3. Busca existentes no Supabase para deduplicação
    const supResp = await fetch(`${SUPABASE_URL}/rest/v1/horas_extras?select=id,protocolo,responsavel,date_iso`, {
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    let existing = [];
    if (supResp.ok) {
        existing = await supResp.json();
    }

    const existingProtocols = new Set((existing || []).map(r => String(r.protocolo || '').trim()).filter(Boolean));
    const existingAgentDays = new Set((existing || []).map(r => `${r.responsavel}|${r.date_iso}`));

    const toInsert = [];
    let ignoredCount = 0;

    for (const r of eligible) {
        const proto = String(r.protocolo || '').trim();
        const agentDay = `${r.responsavel}|${r.date_iso}`;

        if (proto && existingProtocols.has(proto)) {
            ignoredCount++;
            continue;
        }
        if (agentDay && existingAgentDays.has(agentDay)) {
            ignoredCount++;
            continue;
        }

        toInsert.push(r);
        if (proto) existingProtocols.add(proto);
        if (agentDay) existingAgentDays.add(agentDay);
    }

    // 4. Insere novidades no Supabase
    let insertedCount = 0;
    if (toInsert.length > 0) {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/horas_extras`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(toInsert)
        });

        if (!insertRes.ok) {
            const errTxt = await insertRes.text();
            throw new Error(`Erro ao inserir no Supabase (${insertRes.status}): ${errTxt}`);
        }

        const inserted = await insertRes.json();
        insertedCount = Array.isArray(inserted) ? inserted.length : toInsert.length;
    }

    return {
        success: true,
        total_eligible: eligible.length,
        inserted: insertedCount,
        ignored: ignoredCount,
        timestamp: new Date().toISOString()
    };
}

module.exports = async function handler(req, res) {
    // Configura cabeçalhos de CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const result = await performSync();
        return res.status(200).json(result);
    } catch (err) {
        console.error('[Vercel Serverless Sync Error]:', err);
        return res.status(500).json({
            success: false,
            error: err.message || 'Erro interno durante sincronização'
        });
    }
};
