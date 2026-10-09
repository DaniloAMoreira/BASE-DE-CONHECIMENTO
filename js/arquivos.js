(function () {
'use strict';

// Tela "Arquivos": um card por arquivo, com título e botão de download direto.
// Os documentos ficam numa pasta do Google Drive; cadastrar, trocar e excluir pelo site
// acontece direto nessa pasta (backend: script Code.gs publicado no Google Apps Script).
//
// Ao salvar um documento o formulário fecha e o envio segue em segundo plano: um card "Pendente" aparece
// na lista (ou o aviso aparece no card existente, ao trocar o documento). Enquanto houver envio pendente o
// site consulta a lista do Drive de tempos em tempos e, quando o arquivo aparece lá, o card vira normal.
const { $, registerActions, openModal, closeModal, showConfirm } = App.ui;
const { isVisitor, currentUser } = App.api;
const { FILES_MAX_UPLOAD_BYTES } = App.config;
const { isDriveConfigured, listFiles, updateTitle, deleteFile, startUpload, sendChunks } = App.drive;
const { setupAutocomplete } = App.search;
const { buildCard } = App.cards;
const { icon } = App.icons;
const { escapeHtml, highlightMatch, normalizeString, safeHttpUrl, driveDirectDownloadUrl } = App.utils;

// Última lista recebida, guardada neste navegador: a aba abre na hora com ela enquanto o Google responde
// (cada chamada ao Apps Script leva de ~1 s a mais de 6 s). É apagada ao sair da conta.
const CACHE_KEY = 'arquivosCache';
const CACHE_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_POLL_MS = 7000; // de quanto em quanto tempo consulta o Drive enquanto há envio pendente

let files = [];
let uploads = [];       // envios em andamento ou que falharam (ainda não viraram arquivo na lista)
let uploadSeq = 0;
let pollTimer = null;
let polling = false;
let suggestions = [];
let isLoaded = false;
let canWrite = false;
let loadState = 'idle'; // idle | loading | ready | error
let editingId = null;   // null = cadastrando um arquivo novo

const els = {};

// ---------- dados ----------
const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
    return `${(bytes / 1073741824).toFixed(1).replace('.', ',')} GB`;
};

const formatDate = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
};

/** Converte a resposta do backend no formato usado pela tela. */
function normalizeFiles(list) {
    return (list ?? []).map((file) => {
        const isNative = Boolean(file.native);
        return {
            id: String(file.id),
            title: String(file.title ?? '').trim() || 'Arquivo sem título',
            ext: String(file.ext ?? ''),
            size: Number.isFinite(file.size) ? file.size : null,
            created: file.created,
            updated: file.updated ?? null,
            isNative,
            // Link direto de download, sem a tela de aviso de vírus do Drive (documentos nativos do Google só abrem no Drive).
            url: isNative ? safeHttpUrl(file.url) : driveDirectDownloadUrl(String(file.id))
        };
    });
}

const findFile = (id) => files.find((file) => file.id === id);

// ---------- cache da lista ----------
const currentEmail = () => (currentUser()?.email || '').toLowerCase();

function readCache() {
    try {
        const cache = JSON.parse(localStorage.getItem(CACHE_KEY));
        const valid = cache && cache.v === CACHE_VERSION && cache.email === currentEmail()
            && Array.isArray(cache.files) && Date.now() - cache.savedAt < CACHE_MAX_AGE_MS;
        return valid ? cache : null;
    } catch {
        return null;
    }
}

function writeCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ v: CACHE_VERSION, email: currentEmail(), savedAt: Date.now(), canWrite, files }));
    } catch { /* storage indisponível ou cheio: segue sem cache */ }
}

function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch { /* sem storage */ }
}

/** Linha discreta acima da lista: "Atualizando…" ou aviso de que a lista mostrada pode estar desatualizada. */
function setSyncStatus(message = '', { retry = false } = {}) {
    els.syncStatus.hidden = !message;
    els.syncStatus.classList.toggle('hidden', !message);
    els.syncStatus.innerHTML = message
        ? `${escapeHtml(message)}${retry ? ' <button type="button" data-action="reload-arquivos" class="underline text-accent-solid hover:opacity-80">Tentar novamente</button>' : ''}`
        : '';
}
const findUpload = (id) => uploads.find((item) => item.id === id);
const fullName = (file) => (file.ext ? `${file.title}.${file.ext}` : file.title);

// ---------- envios pendentes ----------
const pendingLabel = (item) => (item.status === 'error' ? `Falhou: ${item.error}` : 'Enviando para o Google Drive… sai de "Pendente" sozinho quando chegar.');

const PENDING_BADGE = '<span class="ml-2 align-middle text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">Pendente</span>';

/** Faixa translúcida atrás do cabeçalho do card: pulsa enquanto pendente, fica vermelha se falhou. */
function pendingOverlay(item) {
    // Cor inline: o Tailwind não aplica "/20" de opacidade em cores definidas por variável CSS.
    return item.status === 'error'
        ? '<div class="absolute inset-0 pointer-events-none" style="background: rgba(239, 68, 68, 0.15)"></div>'
        : '<div class="absolute inset-0 pointer-events-none animate-pulse" style="background: color-mix(in srgb, var(--accent-solid) 18%, transparent)"></div>';
}

function uploadButtons(item) {
    const retry = item.status === 'error'
        ? `<button type="button" data-action="retry-upload" data-id="${item.id}" class="px-3 py-1.5 text-xs font-medium text-accent-solid border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap">Tentar novamente</button>`
        : '';
    const label = item.status === 'error' ? 'Descartar' : 'Cancelar envio';
    return `${retry}
        <button type="button" data-action="cancel-upload" data-id="${item.id}" class="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors" title="${label}" aria-label="${label}">${icon('close', 'w-4 h-4')}</button>`;
}

/** Card de um arquivo novo que ainda está sendo enviado. */
function renderPendingCard(item) {
    const failed = item.status === 'error';
    const element = document.createElement('div');
    element.innerHTML = `
        <div class="panel border ${failed ? 'border-red-500/40' : 'border-border-subtle'} rounded-md mb-3 bg-white/5 overflow-hidden" data-upload-card="${item.id}">
            <div class="relative flex items-center justify-between gap-3 p-3">
                ${pendingOverlay(item)}
                <div class="relative z-10 min-w-0 flex flex-col">
                    <span class="font-semibold text-text-high truncate">${escapeHtml(item.title)}${failed ? '' : PENDING_BADGE}</span>
                    <span class="text-[11px] font-mono ${failed ? 'text-red-400' : 'text-text-muted'}">${escapeHtml(pendingLabel(item))}</span>
                </div>
                <div class="relative z-10 flex items-center gap-2 shrink-0">${uploadButtons(item)}</div>
            </div>
        </div>`;
    return element;
}

// ---------- renderização ----------
function renderPanel(file) {
    const meta = [file.ext.toUpperCase(), formatBytes(file.size), file.created ? `enviado em ${formatDate(file.created)}` : '']
        .filter(Boolean).join(' • ');

    const action = file.isNative
        ? { icon: 'document', label: 'Abrir', title: `Abrir ${file.title} no Google Drive` }
        : { icon: 'download', label: 'Download', title: `Baixar ${fullName(file)}` };

    const button = file.url
        ? `<a href="${escapeHtml(file.url)}" target="_blank" rel="noopener noreferrer"
              class="px-3 py-1 bg-accent-solid text-white rounded hover:opacity-90 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center whitespace-nowrap"
              title="${escapeHtml(action.title)}">${icon(action.icon)} ${action.label}</a>`
        : `<span class="px-3 py-1 bg-bg-panel border border-border-element text-text-muted rounded text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center opacity-60 cursor-not-allowed"
              title="Link indisponível">${icon('download')} Indisponível</span>`;

    return `
        <div class="flex justify-between items-center gap-4">
            <div class="flex items-center gap-3 flex-grow min-w-0 w-full p-3 bg-black/5 rounded-md border border-border-subtle">
                ${icon('document', 'w-8 h-8 text-accent-solid shrink-0')}
                <div class="min-w-0">
                    <p class="text-sm font-medium text-text-high truncate">${escapeHtml(fullName(file))}</p>
                    ${meta ? `<p class="text-[11px] text-text-muted font-mono mt-0.5">${escapeHtml(meta)}</p>` : ''}
                </div>
            </div>
            <div class="relative flex flex-col items-center gap-2">${button}</div>
        </div>`;
}

function renderCard(file, term) {
    const id = escapeHtml(file.id);
    const uploading = uploads.find((item) => item.fileId === file.id); // documento sendo trocado
    const badge = file.ext
        ? `<span class="ml-2 align-middle text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-bg-panel border border-border-element text-text-muted">${escapeHtml(file.ext)}</span>`
        : '';
    const uploadNote = uploading
        ? (uploading.status === 'error'
            ? `<span class="ml-2 text-[11px] font-mono font-normal text-red-400">${escapeHtml(pendingLabel(uploading))}</span>`
            : PENDING_BADGE)
        : '';

    let actionsHtml = '';
    if (uploading) {
        actionsHtml = uploadButtons(uploading);
    } else if (canWrite) {
        actionsHtml = `
        <div class="flex items-center gap-2 overflow-hidden transition-all duration-300 max-w-0 opacity-0 action-drawer">
            <button type="button" data-id="${id}" data-action="delete-arquivo" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors whitespace-nowrap" title="Excluir">
                ${icon('trash')} Excluir
            </button>
            <button type="button" data-id="${id}" data-action="edit-arquivo" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-solid border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap" title="Editar">
                ${icon('edit')} Editar
            </button>
        </div>
        <button type="button" data-action="toggle-drawer" class="p-1 hover:bg-bg-solid-hover rounded transition-colors text-text-muted shrink-0" title="Opções" aria-label="Opções">
            ${icon('dots', 'w-5 h-5')}
        </button>`;
    }

    return buildCard({
        titleHtml: highlightMatch(file.title, term) + badge + uploadNote,
        actionsHtml,
        overlayHtml: uploading ? pendingOverlay(uploading) : '',
        expanded: term.length > 0,
        hideTabs: true,
        tabs: [{ labelHtml: '', panelHtml: renderPanel(file) }]
    });
}

function renderNotConnected() {
    return `
        <div class="panel p-6 rounded-xl border border-amber-500/30 bg-amber-500/10 text-sm">
            <p class="font-semibold text-amber-400 mb-1">Google Drive ainda não conectado</p>
            <p class="text-text-muted">Para cadastrar e baixar arquivos, publique o script <code>Code.gs</code> no Google Apps Script e cole a URL em <code>FILES_API_URL</code> (arquivo <code>js/config.js</code>). Passo a passo no guia <code>ARQUIVOS-DRIVE.md</code>.</p>
        </div>`;
}

function render(list) {
    const term = els.input.value.trim();
    const normalizedTerm = normalizeString(term);
    els.container.replaceChildren();

    if (!isDriveConfigured()) {
        els.container.innerHTML = renderNotConnected();
        return;
    }

    // Envios de arquivos novos ficam no topo da lista.
    const pending = uploads.filter((item) => !item.fileId && (!normalizedTerm || normalizeString(item.title).includes(normalizedTerm)));

    if (list.length === 0 && pending.length === 0) {
        const message = term
            ? `Nenhum resultado encontrado para "${escapeHtml(term)}".`
            : canWrite ? 'Nenhum arquivo cadastrado. Use o botão <strong>+</strong> para adicionar.' : 'Nenhum arquivo disponível no momento.';
        els.container.innerHTML = `<div class="text-center text-text-muted py-10">${message}</div>`;
        return;
    }
    pending.forEach((item) => els.container.appendChild(renderPendingCard(item)));
    list.forEach((file) => els.container.appendChild(renderCard(file, term)));
}

function applySearch() {
    if (!isLoaded) return;
    const term = normalizeString(els.input.value.trim());
    render(files.filter((file) => !term || normalizeString(fullName(file)).includes(term)));
}

/** O botão "+" some (sem mexer no layout) para quem não pode editar. Sem Drive conectado ele fica visível para pré-visualizar o formulário. */
function updateAddButton() {
    // Visível enquanto a lista carrega (o servidor ainda confirma a permissão) e depois só para quem pode editar.
    const visible = !isVisitor() && (canWrite || !isDriveConfigured() || loadState === 'loading');
    els.addWrap.classList.toggle('invisible', !visible);
    els.addWrap.classList.toggle('pointer-events-none', !visible);
    els.addWrap.setAttribute('aria-hidden', String(!visible));
    els.addButton.tabIndex = visible ? 0 : -1;
}

// ---------- carregamento ----------
async function loadArquivos({ quiet = false } = {}) {
    // Primeira carga da sessão: se há uma lista salva, mostra já e atualiza em segundo plano.
    const cached = !isLoaded && isDriveConfigured() ? readCache() : null;
    if (cached) {
        files = cached.files;
        canWrite = Boolean(cached.canWrite) && !isVisitor();
        suggestions = [...new Set(files.map((file) => file.title))];
        isLoaded = true;
        loadState = 'ready';
        updateAddButton();
        applySearch();
        setSyncStatus('Atualizando a lista…');
    } else if (!isLoaded && isDriveConfigured()) {
        loadState = 'loading';
        updateAddButton();
        els.container.innerHTML = '<div class="text-center text-text-muted py-10">Carregando arquivos do Google Drive…<br><span class="text-xs">A primeira carga pode levar alguns segundos.</span></div>';
    } else if (!quiet) {
        setSyncStatus('Atualizando a lista…');
    }

    try {
        if (isDriveConfigured()) {
            const data = await listFiles();
            files = normalizeFiles(data.files);
            canWrite = Boolean(data.canWrite) && !isVisitor();
            writeCache();
        } else {
            files = [];
            canWrite = false;
        }
        suggestions = [...new Set(files.map((file) => file.title))];
        isLoaded = true;
        loadState = 'ready';
        updateAddButton();
        applySearch();
        setSyncStatus('');
    } catch (error) {
        console.error('Erro ao carregar arquivos', error);
        if (isLoaded) {
            // Já há uma lista na tela (do cache): mantém e só avisa que não deu para atualizar.
            setSyncStatus(`Não foi possível atualizar (${error.message}). Mostrando a última lista salva.`, { retry: true });
            return;
        }
        canWrite = false;
        loadState = 'error';
        updateAddButton();
        setSyncStatus('');
        els.container.innerHTML = `
            <div class="text-center text-text-muted py-10">
                <p>Não foi possível carregar a lista de arquivos.</p>
                <p class="text-xs mt-1">${escapeHtml(error.message)}</p>
                <button type="button" data-action="reload-arquivos"
                        class="mt-4 px-4 py-2 bg-bg-panel border border-border-element text-text-high rounded-lg hover:bg-bg-solid-hover transition-colors text-sm">Tentar novamente</button>
            </div>`;
    }
}

/** Limpa a tela ao sair da conta (envios em andamento são interrompidos). */
function resetArquivos() {
    uploads.forEach((item) => item.controller?.abort());
    uploads = [];
    stopPollingIfIdle();
    files = [];
    suggestions = [];
    isLoaded = false;
    canWrite = false;
    loadState = 'idle';
    clearCache();
    setSyncStatus('');
    els.container.replaceChildren();
    els.input.value = '';
    updateAddButton();
}

/** Põe (ou atualiza) o arquivo devolvido pelo servidor na lista local, sem esperar uma nova chamada de listagem. */
function applyServerFile(info) {
    const [file] = normalizeFiles([info]);
    const index = files.findIndex((item) => item.id === file.id);
    if (index >= 0) files[index] = file;
    else files.push(file);
    files.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }));
    suggestions = [...new Set(files.map((item) => item.title))];
    isLoaded = true;
    writeCache();
}

// ---------- envio em segundo plano ----------
const listSignature = (list) => list.map((file) => `${file.id}|${file.title}|${file.updated}|${file.size}`).join(';');

/** O arquivo deste envio já aparece na lista do Drive? (arquivo novo: título que não existia antes; troca de documento: arquivo mudou) */
function appearedIn(item, fresh) {
    if (item.fileId) {
        const file = fresh.find((candidate) => candidate.id === item.fileId);
        return Boolean(file) && (file.updated !== item.baselineUpdated || file.size !== item.baselineSize);
    }
    const wanted = item.title.toLowerCase();
    return fresh.some((file) => !item.baselineIds.has(file.id) && file.title.toLowerCase() === wanted);
}

/**
 * Consulta a lista no Drive e dá como concluídos os envios cujo arquivo já apareceu lá.
 * Serve de rede de segurança: às vezes o arquivo chega no Drive mas a resposta do Google se perde no caminho.
 */
async function refreshAndMatchUploads() {
    const data = await listFiles();
    const fresh = normalizeFiles(data.files);
    const finished = uploads.filter((item) => appearedIn(item, fresh));
    const changed = listSignature(fresh) !== listSignature(files);

    files = fresh;
    canWrite = Boolean(data.canWrite) && !isVisitor();
    suggestions = [...new Set(files.map((file) => file.title))];
    isLoaded = true;
    writeCache();

    finished.forEach((item) => item.controller?.abort());
    uploads = uploads.filter((item) => !finished.includes(item));
    if (changed || finished.length > 0) applySearch();
    stopPollingIfIdle();
    return finished;
}

async function pollUploads() {
    if (polling) return;
    if (!uploads.some((item) => item.status === 'uploading')) return stopPollingIfIdle();
    polling = true;
    try {
        await refreshAndMatchUploads();
    } catch (error) {
        console.warn('Consulta da lista falhou; tenta de novo na próxima rodada.', error);
    } finally {
        polling = false;
    }
}

function startPolling() {
    if (!pollTimer) pollTimer = setInterval(pollUploads, PENDING_POLL_MS);
}

function stopPollingIfIdle() {
    if (pollTimer && !uploads.some((item) => item.status === 'uploading')) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

/**
 * Abre o envio no Drive (se ainda não abriu) e manda os blocos em segundo plano. O card fica "Pendente"
 * e vira arquivo normal quando o servidor confirma OU quando a consulta periódica vê o arquivo na lista.
 */
async function runUpload(item, { resume = false } = {}) {
    item.error = '';
    item.status = 'uploading';
    item.controller = new AbortController();
    applySearch();
    startPolling();

    try {
        if (!item.uploadId) {
            ({ uploadId: item.uploadId } = await startUpload({ title: item.title, file: item.file, fileId: item.fileId }, { signal: item.controller.signal }));
        }
        const created = await sendChunks({ uploadId: item.uploadId, file: item.file, resume, signal: item.controller.signal });
        uploads = uploads.filter((other) => other !== item);
        applyServerFile(created);
        applySearch();
        stopPollingIfIdle();
    } catch (error) {
        if (error.name === 'AbortError') return; // cancelado, ou a consulta já viu o arquivo no Drive
        console.error('Falha no envio', error);
        // Antes de dar como falho, confere a lista: o arquivo pode ter chegado e só a resposta se perdeu.
        try {
            if ((await refreshAndMatchUploads()).includes(item)) return;
        } catch { /* sem resposta da lista: segue para o erro */ }
        item.status = 'error';
        item.error = error.message;
        applySearch();
        stopPollingIfIdle();
    }
}

// ---------- cadastrar / editar ----------
function showFormError(message) {
    els.formError.textContent = message;
    els.formError.classList.toggle('hidden', !message);
}

function openFormModal(file = null) {
    editingId = file ? file.id : null;
    $('arquivoModalTitle').textContent = file ? 'Editar Arquivo' : 'Adicionar Arquivo';
    els.title.value = file ? file.title : '';
    els.file.value = '';
    els.fileHint.textContent = file
        ? `Documento atual: ${fullName(file)}. Escolha outro só se quiser substituí-lo (o link de download continua o mesmo).`
        : `Escolha o documento do seu computador (até ${formatBytes(FILES_MAX_UPLOAD_BYTES)}). O envio continua em segundo plano: o card fica como Pendente até o arquivo chegar ao Drive.`;
    showFormError('');
    openModal('arquivoModal');
    els.title.focus();
}

function setSaving(busy, label = 'Salvar') {
    els.saveButton.disabled = busy;
    els.cancelButton.disabled = busy;
    els.saveButton.textContent = busy ? label : 'Salvar';
}

async function saveArquivo() {
    const title = els.title.value.trim();
    const file = els.file.files[0];
    const current = editingId !== null ? findFile(editingId) : null;

    if (!title) return showFormError('Informe o título do arquivo.');
    if (!current && !file) return showFormError('Selecione o documento do seu computador.');
    if (file && file.size === 0) return showFormError('O documento selecionado está vazio.');
    if (file && file.size > FILES_MAX_UPLOAD_BYTES) {
        return showFormError(`O documento tem ${formatBytes(file.size)} e passa do limite de ${formatBytes(FILES_MAX_UPLOAD_BYTES)}.`);
    }

    const wanted = title.toLowerCase();
    const taken = files.some((item) => item.id !== current?.id && item.title.toLowerCase() === wanted)
        || uploads.some((item) => item.fileId !== (current?.id ?? null) && item.title.toLowerCase() === wanted);
    if (taken) return showFormError(`Já existe um arquivo com o título "${title}".`);

    showFormError('');

    if (!file) {
        // Só o título mudou: uma chamada rápida.
        setSaving(true, 'Salvando…');
        try {
            if (title !== current.title) applyServerFile((await updateTitle({ fileId: current.id, title })).file);
            closeModal('arquivoModal');
            applySearch();
        } catch (error) {
            showFormError(error.message);
        } finally {
            setSaving(false);
        }
        return;
    }

    // Documento novo: o formulário fecha na hora e o card "Pendente" aparece no topo da lista.
    // O envio é aberto no Drive em segundo plano; qualquer erro (ex.: título repetido) aparece no próprio card.
    const item = {
        id: `u${++uploadSeq}`, uploadId: null, title, file, fileId: current?.id ?? null, status: 'uploading', error: '', controller: null,
        baselineIds: new Set(files.map((existing) => existing.id)), baselineUpdated: current?.updated ?? null, baselineSize: current?.size ?? null
    };
    uploads.unshift(item);
    closeModal('arquivoModal');
    runUpload(item);
}

// ---------- excluir ----------
async function removeArquivo(button) {
    const file = findFile(button.dataset.id);
    if (!file) return;

    const confirmed = await showConfirm(
        `Excluir "${file.title}"? O arquivo será removido da pasta do Google Drive (vai para a lixeira do Drive) e deixa de aparecer aqui.`,
        'Excluir arquivo'
    );
    if (!confirmed) return;

    button.disabled = true;
    try {
        await deleteFile(file.id);
        files = files.filter((item) => item.id !== file.id);
        suggestions = [...new Set(files.map((item) => item.title))];
        writeCache();
        applySearch();
    } finally {
        button.disabled = false;
    }
}

// ---------- inicialização ----------
function initArquivos() {
    Object.assign(els, {
        input: $('arquivosSearchInput'),
        container: $('arquivosContainer'),
        syncStatus: $('arquivosSyncStatus'),
        addWrap: $('arquivosAddWrap'),
        addButton: $('openArquivoModalBtn'),
        title: $('arquivoTitle'),
        file: $('arquivoFile'),
        fileHint: $('arquivoFileHint'),
        formError: $('arquivoError'),
        saveButton: $('arquivoSaveBtn'),
        cancelButton: $('arquivoCancelBtn')
    });

    setupAutocomplete({
        input: els.input,
        container: $('arquivosSuggestionsContainer'),
        getSuggestions: () => suggestions,
        onSearch: applySearch
    });

    registerActions({
        'reload-arquivos': () => loadArquivos(),
        'edit-arquivo': (button) => {
            const file = findFile(button.dataset.id);
            if (file) openFormModal(file);
        },
        'delete-arquivo': removeArquivo,
        'cancel-upload': (button) => {
            const item = findUpload(button.dataset.id);
            if (!item) return;
            item.controller?.abort();
            uploads = uploads.filter((other) => other !== item);
            applySearch();
            stopPollingIfIdle();
        },
        'retry-upload': (button) => {
            const item = findUpload(button.dataset.id);
            if (item) runUpload(item, { resume: Boolean(item.uploadId) });
        }
    });

    els.addButton.addEventListener('click', () => openFormModal());
    els.saveButton.addEventListener('click', saveArquivo);
    els.cancelButton.addEventListener('click', () => closeModal('arquivoModal'));
    els.title.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') saveArquivo();
    });

    // Fechar a aba no meio de um envio o interrompe: avisa antes.
    window.addEventListener('beforeunload', (event) => {
        if (uploads.some((item) => item.status === 'uploading')) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
    updateAddButton();
}

App.arquivos = { loadArquivos, resetArquivos, initArquivos };
})();
