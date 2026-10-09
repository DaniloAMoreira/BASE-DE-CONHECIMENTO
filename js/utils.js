(function () {
'use strict';

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto para uso seguro em HTML (conteúdo e atributos entre aspas). */
function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** Minúsculas, sem acentos e sem hífens — usado em todas as buscas. */
function normalizeString(value) {
    if (!value) return '';
    return String(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]|-/g, '');
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Retorna HTML seguro com as ocorrências de `term` destacadas por <mark>. */
function highlightMatch(text, term) {
    const source = String(text ?? '');
    if (!term) return escapeHtml(source);

    const regex = new RegExp(escapeRegExp(term), 'gi');
    let html = '';
    let last = 0;
    let match;
    while ((match = regex.exec(source)) !== null) {
        html += escapeHtml(source.slice(last, match.index));
        html += `<mark class="bg-transparent text-accent-solid font-semibold not-italic">${escapeHtml(match[0])}</mark>`;
        last = match.index + match[0].length;
    }
    return html + escapeHtml(source.slice(last));
}

/** Aceita apenas URLs http(s); devolve a URL normalizada ou '' se for inválida/perigosa. */
function safeHttpUrl(value) {
    try {
        const url = new URL(String(value ?? '').trim());
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch {
        return '';
    }
}

/** True se o texto inteiro é uma única URL http(s) (sem espaços/quebras de linha). */
function isSingleUrl(value) {
    return /^https?:\/\/\S+$/i.test(String(value ?? '').trim());
}

/** Link que baixa o arquivo do Drive direto, sem a tela de aviso de vírus (confirm=t). */
function driveDirectDownloadUrl(id) {
    return `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
}

/**
 * Converte links do Google Drive em link direto de download.
 * Aceita /file/d/ID/..., open?id=ID, uc?id=ID e links já no formato drive.usercontent.google.com/download.
 * Qualquer outra URL passa intacta.
 */
function toDriveDownloadUrl(value) {
    const safe = safeHttpUrl(value);
    if (!safe) return '';

    const url = new URL(safe);
    const isDrive = url.hostname === 'drive.google.com';
    const isUserContent = url.hostname === 'drive.usercontent.google.com' && url.pathname === '/download';
    if (!isDrive && !isUserContent) return safe;

    const fromPath = isDrive ? url.pathname.match(/\/file\/d\/([\w-]+)/) : null;
    const id = fromPath ? fromPath[1] : url.searchParams.get('id');
    if (!id || !/^[\w-]+$/.test(id)) return safe;

    return driveDirectDownloadUrl(id);
}

/** Cria um id único para nomes de arquivos enviados ao storage. */
function uniqueId() {
    return crypto.randomUUID();
}

App.utils = { escapeHtml, normalizeString, highlightMatch, safeHttpUrl, isSingleUrl, toDriveDownloadUrl, driveDirectDownloadUrl, uniqueId };
})();
