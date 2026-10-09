(function () {
'use strict';

// Tela "Arquivos": um card por arquivo, com título e botão de download direto.
// Os documentos ficam numa pasta do Google Drive; cadastrar, trocar e excluir pelo site
// acontece direto nessa pasta (backend: script Code.gs publicado no Google Apps Script).
//
// Ao salvar um documento o formulário fecha e o envio segue em segundo plano: um card com
// barra de progresso aparece na lista (ou a barra aparece no card existente, ao trocar o documento).
const { $, registerActions, openModal, closeModal, showConfirm } = App.ui;
const { isVisitor } = App.api;
const { FILES_MAX_UPLOAD_BYTES } = App.config;
const { isDriveConfigured, listFiles, updateTitle, deleteFile, startUpload, sendChunks } = App.drive;
const { setupAutocomplete } = App.search;
const { buildCard } = App.cards;
const { icon } = App.icons;
const { escapeHtml, highlightMatch, normalizeString, safeHttpUrl, driveDirectDownloadUrl } = App.utils;

let files = [];
let uploads = [];       // envios em andamento ou que falharam (ainda não viraram arquivo na lista)
let uploadSeq = 0;
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
            isNative,
            // Link direto de download, sem a tela de aviso de vírus do Drive (documentos nativos do Google só abrem no Drive).
            url: isNative ? safeHttpUrl(file.url) : driveDirectDownloadUrl(String(file.id))
        };
    });
}

const findFile = (id) => files.find((file) => file.id === id);
const findUpload = (id) => uploads.find((item) => item.id === id);
const fullName = (file) => (file.ext ? `${file.title}.${file.ext}` : file.title);

// ---------- barra de progresso do envio ----------
// 100% só existe quando o card vira arquivo; até lá a barra para em 99%.
const percentOf = (item) => (item.file.size > 0 ? Math.min(99, Math.floor((item.sent / item.file.size) * 100)) : 0);

function progressLabel(item) {
    if (item.status === 'error') return `Falhou: ${item.error}`;
    if (item.status === 'starting') return 'Iniciando o envio…';
    if (item.finalizing) return 'Finalizando no Drive…';
    return `Enviando… ${percentOf(item)}% • ${formatBytes(item.sent)} de ${formatBytes(item.file.size)}`;
}

/** Camada translúcida que "enche" o cabeçalho do card conforme o envio avança. */
function progressOverlay(item) {
    // Cor inline: o Tailwind não aplica "/30" de opacidade em cores definidas por variável CSS.
    const color = item.status === 'error' ? 'rgba(239, 68, 68, 0.25)' : 'color-mix(in srgb, var(--accent-solid) 30%, transparent)';
    return `<div data-upload-bar="${item.id}" class="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out pointer-events-none" style="width: ${percentOf(item)}%; background: ${color}"></div>`;
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
                ${progressOverlay(item)}
                <div class="relative z-10 min-w-0 flex flex-col">
                    <span class="font-semibold text-text-high truncate">${escapeHtml(item.title)}</span>
                    <span data-upload-label="${item.id}" class="text-[11px] font-mono ${failed ? 'text-red-400' : 'text-text-muted'}">${escapeHtml(progressLabel(item))}</span>
                </div>
                <div class="relative z-10 flex items-center gap-2 shrink-0">${uploadButtons(item)}</div>
            </div>
        </div>`;
    return element;
}

/** Atualiza só a barra e o texto (sem redesenhar a lista) a cada bloco enviado. */
function updateProgressDom(item) {
    document.querySelectorAll(`[data-upload-bar="${item.id}"]`).forEach((bar) => { bar.style.width = `${percentOf(item)}%`; });
    document.querySelectorAll(`[data-upload-label="${item.id}"]`).forEach((label) => { label.textContent = progressLabel(item); });
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
        ? `<span data-upload-label="${uploading.id}" class="ml-2 text-[11px] font-mono font-normal ${uploading.status === 'error' ? 'text-red-400' : 'text-text-muted'}">${escapeHtml(progressLabel(uploading))}</span>`
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
        overlayHtml: uploading ? progressOverlay(uploading) : '',
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
    if (!quiet) els.container.classList.add('loading');
    if (!isLoaded && isDriveConfigured()) {
        loadState = 'loading';
        updateAddButton();
        els.container.innerHTML = '<div class="text-center text-text-muted py-10">Carregando arquivos do Google Drive…</div>';
    }
    try {
        if (isDriveConfigured()) {
            const data = await listFiles();
            files = normalizeFiles(data.files);
            canWrite = Boolean(data.canWrite) && !isVisitor();
        } else {
            files = [];
            canWrite = false;
        }
        suggestions = [...new Set(files.map((file) => file.title))];
        isLoaded = true;
        loadState = 'ready';
        updateAddButton();
        applySearch();
    } catch (error) {
        console.error('Erro ao carregar arquivos', error);
        isLoaded = false;
        canWrite = false;
        loadState = 'error';
        updateAddButton();
        els.container.innerHTML = `
            <div class="text-center text-text-muted py-10">
                <p>Não foi possível carregar a lista de arquivos.</p>
                <p class="text-xs mt-1">${escapeHtml(error.message)}</p>
                <button type="button" data-action="reload-arquivos"
                        class="mt-4 px-4 py-2 bg-bg-panel border border-border-element text-text-high rounded-lg hover:bg-bg-solid-hover transition-colors text-sm">Tentar novamente</button>
            </div>`;
    } finally {
        els.container.classList.remove('loading');
    }
}

/** Limpa a tela ao sair da conta (envios em andamento são interrompidos). */
function resetArquivos() {
    uploads.forEach((item) => item.controller?.abort());
    uploads = [];
    files = [];
    suggestions = [];
    isLoaded = false;
    canWrite = false;
    loadState = 'idle';
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
}

// ---------- envio em segundo plano ----------
/**
 * Abre o envio no Drive (se ainda não abriu), manda os blocos e, ao terminar, troca o card "de envio"
 * pelo card do arquivo usando a resposta do servidor (sem nova listagem, que levaria vários segundos).
 */
async function runUpload(item, { resume = false } = {}) {
    item.error = '';
    item.finalizing = false;
    item.status = item.uploadId ? 'uploading' : 'starting';
    item.controller = new AbortController();
    applySearch();

    try {
        if (!item.uploadId) {
            ({ uploadId: item.uploadId } = await startUpload({ title: item.title, file: item.file, fileId: item.fileId }, { signal: item.controller.signal }));
            item.status = 'uploading';
            updateProgressDom(item);
        }
        const created = await sendChunks({
            uploadId: item.uploadId,
            file: item.file,
            resume,
            signal: item.controller.signal,
            onProgress: ({ sent, finalizing = false }) => {
                item.sent = sent;
                item.finalizing = finalizing;
                updateProgressDom(item);
            }
        });
        uploads = uploads.filter((other) => other !== item);
        applyServerFile(created);
        applySearch();
    } catch (error) {
        if (error.name === 'AbortError') return; // cancelado pelo usuário: o card já foi removido
        console.error('Falha no envio', error);
        item.status = 'error';
        item.error = error.message;
        applySearch();
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
        : `Escolha o documento do seu computador (até ${formatBytes(FILES_MAX_UPLOAD_BYTES)}). O envio continua em segundo plano, com barra de progresso na lista.`;
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
        // Só o título mudou: uma chamada rápida, sem barra de progresso.
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

    // Documento novo: o formulário fecha na hora e o card de envio aparece no topo, já com a barra.
    // O envio é aberto no Drive em segundo plano; qualquer erro (ex.: título repetido) aparece no próprio card.
    const item = { id: `u${++uploadSeq}`, uploadId: null, title, file, fileId: current?.id ?? null, sent: 0, finalizing: false, status: 'starting', error: '', controller: null };
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
