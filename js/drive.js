(function () {
'use strict';

// Cliente do backend de arquivos (Google Apps Script "Code.gs", mantido fora deste repositório).
const { FILES_API_URL, FILES_CHUNK_BYTES, FILES_MAX_CHUNK_BYTES } = App.config;
const { getAccessToken, refreshSession, expireSession } = App.api;

const REQUIRED_SCRIPT_VERSION = 3; // precisa ser igual a SCRIPT_VERSION no Code.gs publicado no Apps Script
const MAX_ATTEMPTS = 6;
const FAST_CHUNK_MS = 25000;       // bloco que demora mais que isto não justifica aumentar os próximos
// Erros em que repetir a mesma chamada não adianta.
const NO_RETRY = new Set(['unauthorized', 'forbidden', 'bad_request', 'too_large', 'duplicate', 'upload_expired']);

const isDriveConfigured = () => Boolean(FILES_API_URL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const abortError = () => new DOMException('Envio cancelado', 'AbortError');

/**
 * Faz a chamada HTTP e devolve o texto da resposta. Todas as chamadas são POST em text/plain
 * (requisição "simples": o navegador não faz preflight CORS, que o Apps Script não suporta).
 * Não registrar listeners de upload (XMLHttpRequest.upload.*): isso força o preflight e o Google recusa.
 */
function transport(payload, { signal } = {}) {
    return fetch(FILES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, token: getAccessToken() }),
        signal
    }).then((res) => res.text());
}

/** Resumo legível de uma resposta que não é JSON (normalmente uma página de erro do Google). */
function describeUnexpected(text) {
    const plain = String(text).replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    return plain ? plain.slice(0, 160) : 'resposta vazia';
}

async function post(payload, { canRetry = true, signal } = {}) {
    if (!isDriveConfigured()) {
        throw new Error('O Google Drive ainda não foi conectado. Publique o script do Google Drive e preencha FILES_API_URL em js/config.js (guia ARQUIVOS-DRIVE.md).');
    }

    const text = await transport(payload, { signal });
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        console.error('Resposta inesperada do servidor de arquivos:', text);
        const unexpected = new Error(`O servidor de arquivos respondeu algo inesperado (${describeUnexpected(text)}). Confira se o Apps Script foi implantado como "Qualquer pessoa" e na versão mais recente. Se acontecer de vez em quando, tente em uma janela anônima: extensões ou antivírus podem interferir.`);
        unexpected.code = 'unexpected_response';
        throw unexpected;
    }

    if (data.ok) return data;

    if (data.error === 'unauthorized') {
        // O login pode ter vencido no meio de um envio longo: renova e repete uma vez.
        if (canRetry && await refreshSession()) return post(payload, { canRetry: false, signal });
        expireSession();
    }
    const error = new Error(data.message || 'Erro no servidor de arquivos.');
    error.code = data.error;
    throw error;
}

/**
 * Repete automaticamente chamadas que podem ser repetidas sem problema (listar, consultar/abrir o envio, trocar título) quando o Google
 * responde algo que não é JSON ou a rede falha: o endereço temporário da resposta às vezes expira ou é consumido.
 */
async function postRetrying(payload, options = {}, attempts = 3) {
    for (let attempt = 1; ; attempt++) {
        try {
            return await post(payload, options);
        } catch (error) {
            const transient = error.code === 'unexpected_response' || error instanceof TypeError;
            if (!transient || attempt >= attempts || options.signal?.aborted) throw error;
            await sleep(800 * attempt);
        }
    }
}

/** { files: [{ id, title, ext, size, url, native, created, updated }], canWrite } */
const listFiles = async () => {
    const data = await postRetrying({ action: 'list' });
    if ((data.version || 0) < REQUIRED_SCRIPT_VERSION) {
        const error = new Error('O script do Google Drive publicado está desatualizado. No Apps Script, cole o novo Code.gs, salve e use Implantar → Gerenciar implantações → ✏️ → Versão: Nova versão → Implantar.');
        error.code = 'outdated';
        throw error;
    }
    return data;
};

/** Troca só o título do arquivo (o link de download continua o mesmo). */
const updateTitle = ({ fileId, title }) => postRetrying({ action: 'update', fileId, title });

const deleteFile = (fileId) => post({ action: 'delete', fileId });

/**
 * Abre um envio no Drive. Com `fileId` troca o conteúdo de um arquivo existente (mantendo o link).
 * Devolve { uploadId }. Erros de título repetido, tamanho etc. já aparecem aqui, antes de enviar bytes.
 */
const startUpload = ({ title, file, fileId }, { signal } = {}) => postRetrying({
    action: 'uploadStart',
    title,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    fileId
}, { signal });

/** Lê um pedaço do arquivo e devolve o conteúdo em base64 (sem o prefixo "data:...;base64,"). */
function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Envia o arquivo em blocos, com novas tentativas e retomada: se a rede cair, pergunta ao Drive
 * quanto já chegou e continua dali.
 *
 * - Os blocos começam pequenos (FILES_CHUNK_BYTES) e dobram enquanto passam rápido, até
 *   FILES_MAX_CHUNK_BYTES: menos chamadas ao Apps Script em arquivos grandes. Se um bloco maior
 *   falhar, volta ao último tamanho que funcionou e não tenta passar dele de novo.
 * - Com `resume: true` começa consultando o Drive (para "Tentar novamente" depois de uma falha).
 *
 * Devolve os dados do arquivo criado.
 */
async function sendChunks({ uploadId, file, resume = false, signal }) {
    let offset = 0;
    let failures = 0;
    let chunk = FILES_CHUNK_BYTES;
    let ceiling = FILES_MAX_CHUNK_BYTES;

    const resync = async () => {
        const status = await postRetrying({ action: 'uploadStatus', uploadId }, { signal });
        if (status.done) return status;
        offset = status.received;
        return null;
    };

    if (resume) {
        const finished = await resync();
        if (finished) return finished.file;
    }

    while (offset < file.size) {
        if (signal?.aborted) throw abortError();
        const size = Math.min(chunk, file.size - offset);
        const end = offset + size;
        const startedAt = Date.now();
        try {
            const data = await blobToBase64(file.slice(offset, end));
            const reply = await post({ action: 'uploadChunk', uploadId, offset, data }, { signal });
            if (reply.done) return reply.file;
            failures = reply.received > offset ? 0 : failures + 1; // sem avanço = tentativa perdida
            if (failures >= MAX_ATTEMPTS) throw new Error('O Drive não está aceitando o envio. Tente novamente.');
            offset = reply.received;
            if (Date.now() - startedAt < FAST_CHUNK_MS && chunk < ceiling) chunk = Math.min(chunk * 2, ceiling);
        } catch (error) {
            if (error.name === 'AbortError' || NO_RETRY.has(error.code)) throw error;
            if (chunk > FILES_CHUNK_BYTES) {
                // Bloco maior que o inicial falhou: volta ao último tamanho que funcionou (sem contar como falha).
                ceiling = Math.max(FILES_CHUNK_BYTES, chunk / 2);
                chunk = ceiling;
                await sleep(500);
            } else {
                if (++failures >= MAX_ATTEMPTS) throw error;
                await sleep(Math.min(1500 * failures, 8000));
            }
            try {
                const finished = await resync();
                if (finished) return finished.file;
            } catch (statusError) {
                if (statusError.name === 'AbortError' || NO_RETRY.has(statusError.code)) throw statusError;
            }
        }
    }
    // Todos os bytes foram aceitos mas o Drive ainda não confirmou o arquivo: pede o fechamento.
    const finished = await resync();
    if (finished) return finished.file;
    throw new Error('O Drive não confirmou o fim do envio. Use "Tentar novamente".');
}

App.drive = { isDriveConfigured, listFiles, updateTitle, deleteFile, startUpload, sendChunks };
})();
