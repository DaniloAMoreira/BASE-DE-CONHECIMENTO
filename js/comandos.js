(function () {
'use strict';

// Tela "Comandos SQL": listagem, busca, criação/edição, lixeira (soft delete) e histórico.
const { $, registerActions, openModal, closeModal, showAlert, showConfirm, promptReason, showInfo, copyText, downloadTextFile } = App.ui;
const { rest, restJson, displayName, authorName, isSameAuthor, isAdmin, isVisitor, isAuthenticated, uploadMedia, deleteMedia } = App.api;
const { buildCard } = App.cards;
const { setupAutocomplete } = App.search;
const { icon } = App.icons;
const { TRASH_TTL_MS, MEDIA_BUCKET } = App.config;
const { escapeHtml, highlightMatch, normalizeString, isSingleUrl, toDriveDownloadUrl } = App.utils;

// ---------- estado ----------
let allComandos = [];
let trashComandos = [];
let suggestions = [];
let isLoaded = false;
let filterTab = 'all';

let editingId = null;
let modalSubs = [];
let activeModalTab = 0;
let pendingUploads = new Set(); // mídias enviadas no modal e ainda não salvas
let commandToDeleteId = null;

const els = {};
const PREVIEW_LINES = 10;

// ---------- dados ----------
/**
 * Lê o campo `command` (texto JSON). Aceita o formato antigo (lista de gavetas),
 * o atual ({ is_private, subCommands, deleted_at }) e texto puro.
 */
function parseCommandData(raw) {
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (Array.isArray(parsed)) return { is_private: false, subCommands: parsed };
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.subCommands)) {
            return { is_private: Boolean(parsed.is_private), subCommands: parsed.subCommands, deleted_at: parsed.deleted_at };
        }
    } catch { /* não é JSON: tratado como texto puro abaixo */ }
    return { is_private: false, subCommands: [{ name: 'Comando', text: typeof raw === 'string' ? raw : '' }] };
}

/** Garante que toda gaveta tenha os campos de texto preenchidos. */
const normalizeSubCommand = (sc) => ({
    name: String(sc?.name ?? ''),
    desc: String(sc?.desc ?? ''),
    text: String(sc?.text ?? ''),
    ...(sc?.media_url && { media_url: String(sc.media_url) }),
    ...(sc?.requires_backup && { requires_backup: true })
});

/** Anexa ao comando os dados já interpretados e o texto usado na busca. */
function hydrate(cmd) {
    const data = parseCommandData(cmd.command);
    const subCommands = data.subCommands.map(normalizeSubCommand);
    cmd._data = { is_private: data.is_private, deleted_at: data.deleted_at, subCommands };
    cmd._search = normalizeString([cmd.name, ...subCommands.flatMap((sc) => [sc.name, sc.desc, sc.text])].join('\n'));
    return cmd;
}

const findCommand = (id) => allComandos.find((cmd) => String(cmd.id) === String(id));
const idQuery = (id) => `id=eq.${encodeURIComponent(String(id))}`;

const getTrash = () => trashComandos;

/** PATCH/DELETE do PostgREST responde 204 mesmo quando o RLS bloqueia: confere se alguma linha mudou. */
async function mutate(path, method, body) {
    const rows = await restJson(path, { method, body, prefer: 'return=representation' });
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('Nenhum registro foi alterado (sem permissão ou comando inexistente).');
    }
    return rows;
}

async function loadComandos() {
    els.container.classList.add('loading');
    try {
        const rows = await restJson('comandos?select=*');
        const me = authorName();
        const admin = isAdmin();
        const now = Date.now();

        allComandos = [];
        trashComandos = [];
        const expired = [];

        rows.map(hydrate).forEach((cmd) => {
            const { deleted_at: deletedAt, is_private: isPrivate } = cmd._data;
            if (deletedAt) {
                if (now - new Date(deletedAt).getTime() >= TRASH_TTL_MS) expired.push(cmd);
                else trashComandos.push(cmd);
                return;
            }
            if (isPrivate && !isSameAuthor(cmd.created_by_name, me) && !admin) return;
            allComandos.push(cmd);
        });

        // Só o administrador (que enxerga a lixeira) limpa os itens vencidos.
        if (admin) expired.forEach((cmd) => purgeCommand(cmd).catch((error) => console.warn('Falha ao limpar item vencido da lixeira:', error)));

        allComandos.sort((a, b) => a.name.localeCompare(b.name));

        const unique = new Set();
        allComandos.forEach((cmd) => {
            unique.add(cmd.name);
            cmd._data.subCommands.forEach((sc) => unique.add(sc.name));
        });
        suggestions = [...unique];

        isLoaded = true;
        applySearch();
    } catch (error) {
        console.error('Erro ao carregar comandos', error);
        if (isAuthenticated()) showInfo({ title: 'Erro', text: 'Erro ao carregar banco de dados: ' + error.message });
    } finally {
        els.container.classList.remove('loading');
    }
}

// ---------- lixeira (usada pelo painel do administrador) ----------
/** Apaga o comando de vez e remove as mídias que ele usava. */
async function purgeCommand(cmd) {
    await mutate(`comandos?${idQuery(cmd.id)}`, 'DELETE');
    const urls = cmd._data.subCommands.map((sc) => sc.media_url).filter(Boolean);
    if (urls.length > 0) {
        const result = await deleteMedia(urls);
        if (!result.ok) console.warn('Não foi possível apagar as mídias do comando excluído:', result.detail);
    }
}

async function setDeletedAt(id, deletedAt) {
    const [row] = await restJson(`comandos?${idQuery(id)}&select=command`) ?? [];
    if (!row) throw new Error('Comando não encontrado');

    const data = parseCommandData(row.command);
    if (deletedAt) data.deleted_at = deletedAt;
    else delete data.deleted_at;

    await mutate(`comandos?${idQuery(id)}`, 'PATCH', { command: JSON.stringify(data) });
}

async function restoreCommand(id) {
    await setDeletedAt(id, null);
    await loadComandos();
}

// ---------- renderização ----------
/** Escapa o texto e destaca em laranja os trechos entre "#...#" (comentários dos comandos). */
function formatSqlComments(raw) {
    let html = '';
    let last = 0;
    for (const match of raw.matchAll(/#([\s\S]*?)#/g)) {
        html += escapeHtml(raw.slice(last, match.index));
        html += `<span class="text-orange-500 font-bold">${escapeHtml(match[0])}</span>`;
        last = match.index + match[0].length;
    }
    return html + escapeHtml(raw.slice(last));
}

const BTN_SECONDARY = 'px-3 py-1 bg-bg-panel border border-border-element text-text-high rounded hover:bg-bg-solid-hover transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center';
const BTN_PRIMARY = 'px-3 py-1 bg-accent-solid text-white rounded hover:opacity-90 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center';
const PRE_BASE = 'text-xs text-text-muted whitespace-pre-wrap font-mono p-3 bg-black/5 rounded-md border border-border-subtle';

function renderCodeBlock(text) {
    const lines = text.split('\n');
    if (lines.length <= PREVIEW_LINES) {
        return `<pre class="${PRE_BASE} flex-grow min-w-0 overflow-y-auto w-full">${formatSqlComments(text)}</pre>`;
    }
    return `
        <div class="relative w-full flex-grow min-w-0" data-preview-box>
            <pre data-preview class="${PRE_BASE} pb-8 overflow-hidden">${formatSqlComments(lines.slice(0, PREVIEW_LINES).join('\n'))}</pre>
            <div data-expand-overlay class="absolute bottom-2 left-0 right-0 flex items-center justify-center">
                <button type="button" data-action="expand-preview" class="text-accent-solid text-xs font-bold hover:underline bg-transparent border-none cursor-pointer">Expandir</button>
            </div>
            <pre data-full class="hidden ${PRE_BASE} max-h-[300px] overflow-y-auto">${formatSqlComments(text)}</pre>
        </div>`;
}

function renderPanel(cmd, sc, index) {
    const text = sc.text.trim();
    const ref = `data-id="${escapeHtml(cmd.id)}" data-index="${index}"`;
    const isSqlFile = sc.name.toLowerCase().endsWith('.sql');
    const downloadUrl = !isSqlFile && isSingleUrl(text) ? toDriveDownloadUrl(text) : '';
    const shownText = downloadUrl || text;

    let primary;
    if (isSqlFile) {
        primary = `<button type="button" ${ref} data-action="download-command" class="${BTN_PRIMARY}" title="Descarregar ficheiro">${icon('download')} Download</button>`;
    } else if (downloadUrl) {
        primary = `<a href="${escapeHtml(downloadUrl)}" target="_blank" rel="noopener noreferrer" class="${BTN_SECONDARY}" title="Download">${icon('download')} Download</a>`;
    } else {
        primary = `<button type="button" ${ref} data-action="copy-command" class="${BTN_SECONDARY}" title="Copiar">${icon('copy')} Copiar</button>`;
    }

    const history = `
        <button type="button" data-id="${escapeHtml(cmd.id)}" data-action="view-history"
                class="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded hover:bg-orange-500/20 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center" title="Histórico">
            ${icon('clock')} Histórico
        </button>`;

    const description = sc.desc.trim() ? `
        <div class="inline-flex items-center gap-2 mb-2 p-2 -ml-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors group w-fit"
             role="button" tabindex="0" ${ref} data-action="show-description">
            <div class="w-6 h-6 rounded-full bg-yellow-400 group-hover:bg-yellow-500 text-black text-xs font-bold flex items-center justify-center shrink-0 group-hover:scale-110 transition-all shadow-md" title="Ver descrição">!</div>
            <span class="text-sm font-medium text-text-high group-hover:text-accent-solid transition-colors">Para que serve este comando?</span>
            ${sc.media_url ? icon('image', 'w-4 h-4 text-yellow-400 opacity-80') : ''}
        </div>` : '';

    const backup = sc.requires_backup ? `
        <div class="flex items-center gap-2 mb-3 -mt-1 w-fit">
            ${icon('warning', 'w-4 h-4 text-orange-500')}
            <span class="text-xs font-bold text-orange-500 uppercase tracking-wide">Obrigatório fazer o backup</span>
        </div>` : '';

    return `
        ${description}
        ${backup}
        <div class="flex justify-between items-start gap-4">
            ${renderCodeBlock(shownText)}
            <div class="relative flex flex-col items-center gap-2">${primary}${history}</div>
        </div>`;
}

function renderCard(cmd, term, canEdit) {
    const { subCommands } = cmd._data;
    const id = escapeHtml(cmd.id);

    const actionsHtml = canEdit ? `
        <div class="flex items-center gap-2 overflow-hidden transition-all duration-300 max-w-0 opacity-0 action-drawer">
            <button type="button" data-id="${id}" data-action="delete-command" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors whitespace-nowrap" title="Excluir">
                ${icon('trash')} Excluir
            </button>
            <button type="button" data-id="${id}" data-action="edit-command" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-solid border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap" title="Editar">
                ${icon('edit')} Editar
            </button>
        </div>
        <button type="button" data-action="toggle-drawer" class="p-1 hover:bg-bg-solid-hover rounded transition-colors text-text-muted shrink-0" title="Opções" aria-label="Opções">
            ${icon('dots', 'w-5 h-5')}
        </button>` : '';

    return buildCard({
        titleHtml: highlightMatch(cmd.name, term),
        accentBar: subCommands.some((sc) => sc.requires_backup),
        actionsHtml,
        expanded: term.length > 0,
        tabs: subCommands.map((sc, index) => ({
            labelHtml: highlightMatch(sc.name, term),
            panelHtml: renderPanel(cmd, sc, index)
        }))
    });
}

function render(list) {
    const term = els.input.value.trim();
    els.container.replaceChildren();

    if (list.length === 0) {
        const message = term ? `Nenhum resultado encontrado para "${escapeHtml(term)}".` : 'A lista de comandos está vazia.';
        els.container.innerHTML = `<div class="text-center text-text-muted py-10">${message}</div>`;
        return;
    }
    const canEdit = !isVisitor();
    list.forEach((cmd) => els.container.appendChild(renderCard(cmd, term, canEdit)));
}

function applySearch() {
    if (!isLoaded) return;
    const term = normalizeString(els.input.value.trim());
    const me = authorName();

    render(allComandos.filter((cmd) => {
        if (filterTab === 'mine' && !isSameAuthor(cmd.created_by_name, me)) return false;
        return !term || cmd._search.includes(term);
    }));
}

// ---------- filtro "Todos / Meus comandos" ----------
const FILTER_ACTIVE = 'relative z-10 pb-3 text-sm font-semibold text-accent-solid transition-colors';
const FILTER_INACTIVE = 'relative z-10 pb-3 text-sm font-semibold text-text-muted hover:text-text-high transition-colors';

/** Posiciona a linha animada sob a aba ativa (só funciona com a tela visível). */
function positionFilterIndicator() {
    const active = filterTab === 'all' ? els.tabAll : els.tabMine;
    if (!active.offsetWidth) return;
    els.indicator.style.width = `${active.offsetWidth}px`;
    els.indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}

function setFilterTab(tab) {
    filterTab = tab;
    els.tabAll.className = tab === 'all' ? FILTER_ACTIVE : FILTER_INACTIVE;
    els.tabMine.className = tab === 'mine' ? FILTER_ACTIVE : FILTER_INACTIVE;
    positionFilterIndicator();
    applySearch();
}

/** Esconde os controles de edição para a conta de visitante. */
function applyCommandPermissions() {
    els.addButton.classList.toggle('hidden', isVisitor());
}

/** Limpa a tela ao sair da conta. */
function resetComandos() {
    allComandos = [];
    trashComandos = [];
    suggestions = [];
    isLoaded = false;
    els.container.replaceChildren();
    els.input.value = '';
}

// ---------- histórico ----------
function formatForDiff(rawCommand) {
    const { subCommands } = parseCommandData(rawCommand);
    return subCommands.map(normalizeSubCommand).map((sc, i) => {
        let block = `[GAVETA ${i + 1}] ${sc.name || 'Sem título'}`;
        if (sc.desc) block += `\nDescrição: ${sc.desc}`;
        if (sc.text) block += `\nCódigo:\n${sc.text}`;
        return block;
    }).join('\n\n------------------------\n\n');
}

function renderDiff(item) {
    const label = (content) => `TÍTULO PRINCIPAL: ${content.name || 'Sem título'}\n\n${formatForDiff(content.command)}`;
    let html = '';

    if (item.action === 'UPDATE' && item.old_content && item.new_content) {
        if (!window.Diff) {
            html = '<div class="text-xs text-red-400 mt-2">Não foi possível calcular as diferenças.</div>';
        } else {
            const parts = window.Diff.diffLines(label(item.old_content), label(item.new_content));
            const changes = parts.filter((part) => part.added || part.removed).map((part) => {
                const [tone, sign] = part.added
                    ? ['text-green-400 bg-green-500/10 border-green-500', '+']
                    : ['text-red-400 bg-red-500/10 border-red-500', '-'];
                return `<div class="${tone} px-2 py-1 whitespace-pre-wrap border-l-2">${sign} ${escapeHtml(part.value)}</div>`;
            });
            html = `<div class="mt-3 bg-bg-panel-active rounded p-2 overflow-x-auto text-xs font-mono">${
                changes.length > 0 ? changes.join('') : '<div class="text-gray-400 px-2 py-1 italic">Nenhuma alteração textual detectada.</div>'
            }</div>`;
        }
    } else if (item.action !== 'UPDATE' && item.new_content) {
        html = `<div class="mt-3 bg-bg-panel-active rounded p-3 overflow-x-auto text-xs font-mono whitespace-pre-wrap text-text-muted border-l-2 border-green-500 bg-green-500/5">${escapeHtml(label(item.new_content))}</div>`;
    }

    if (item.new_content?.reason) {
        html += `<div class="mt-3 bg-accent-solid/10 border-l-2 border-accent-solid p-3 rounded text-sm text-text-high font-sans"><strong>Motivo da alteração:</strong> <span class="text-text-muted">${escapeHtml(item.new_content.reason)}</span></div>`;
    }
    return html;
}

function renderHistoryItem(item) {
    const isUpdate = item.action === 'UPDATE';
    const element = document.createElement('details');
    element.className = 'group bg-black/5 border border-border-subtle rounded-lg mb-3 last:mb-0';
    element.innerHTML = `
        <summary class="flex justify-between items-start p-4 cursor-pointer hover:bg-white/5 transition-colors list-none rounded-lg [&::-webkit-details-marker]:hidden">
            <div>
                <span class="inline-block px-2 py-1 rounded text-xs font-bold ${isUpdate ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'} mb-1">${isUpdate ? 'EDITADO' : 'CRIADO'}</span>
                <p class="text-text-high font-medium text-sm">Por: ${escapeHtml(item.user_name || 'Desconhecido')}</p>
            </div>
            <div class="flex flex-col items-end gap-2">
                <span class="text-xs text-text-muted">${escapeHtml(new Date(item.created_at).toLocaleString('pt-BR'))}</span>
                ${icon('chevron', 'w-4 h-4 text-text-muted group-open:rotate-180 transition-transform')}
            </div>
        </summary>
        <div class="p-4 pt-0 border-t border-border-subtle/30 mt-1">${renderDiff(item)}</div>`;
    return element;
}

async function viewHistory(id) {
    const cmd = findCommand(id);
    $('historyCommandName').textContent = cmd?.name ?? '';
    const loading = $('historyLoading');
    const empty = $('historyEmpty');
    const list = $('historyListContainer');

    openModal('historyModal');
    loading.classList.remove('hidden');
    empty.classList.add('hidden');
    list.replaceChildren();

    try {
        const history = await restJson(`command_history?command_id=eq.${encodeURIComponent(String(id))}&order=created_at.desc`);
        loading.classList.add('hidden');
        if (!history || history.length === 0) {
            empty.classList.remove('hidden');
            return;
        }
        history.forEach((item) => list.appendChild(renderHistoryItem(item)));
    } catch (error) {
        loading.classList.add('hidden');
        showAlert('Erro ao carregar o histórico: ' + error.message);
    }
}

// ---------- modal de criação / edição ----------
const MODAL_TAB_ACTIVE = 'bg-bg-solid text-white border-border-element shadow-md scale-[1.02]';
const MODAL_TAB_INACTIVE = 'bg-bg-panel border-border-element text-text-high hover:bg-bg-solid-hover hover:text-white hover:shadow-md hover:scale-[1.02] transition-all';
const FIELD = 'w-full rounded-md px-3 py-1.5 bg-[color:var(--bg-app)] border border-border-element text-text-high focus:outline-none focus:ring-1 focus:ring-accent-solid text-sm';

function renderModalTabs() {
    els.modalTabs.innerHTML = modalSubs.map((sc, index) => `
        <button type="button" data-action="switch-modal-tab" data-index="${index}"
                class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors border truncate shrink-0 ${index === activeModalTab ? MODAL_TAB_ACTIVE : MODAL_TAB_INACTIVE}">${escapeHtml(sc.name || 'Nova Aba')}</button>`).join('');
}

function renderModal() {
    renderModalTabs();

    if (modalSubs.length === 0) {
        els.modalContent.innerHTML = '<div class="text-text-muted text-sm flex items-center justify-center h-full text-center">Nenhuma aba criada.<br>Clique no "+" ao lado para adicionar.</div>';
        return;
    }

    const sc = modalSubs[activeModalTab];
    els.modalContent.innerHTML = `
        <div class="flex justify-between items-center mb-1">
            <label for="modalFieldName" class="block text-xs font-medium text-text-muted">Nome da Aba (Ex: Select)</label>
            <button type="button" data-action="remove-modal-tab" class="text-red-500 hover:text-red-700 flex items-center justify-center p-1 rounded-md hover:bg-red-500/10 transition-all hover:scale-110 hover:shadow-sm" title="Remover Aba" aria-label="Remover Aba">
                ${icon('close')}
            </button>
        </div>
        <input id="modalFieldName" type="text" data-field="name" value="${escapeHtml(sc.name)}" class="${FIELD} mb-3">

        <label for="modalFieldDesc" class="block text-xs font-medium text-text-muted mb-1">Descrição (Obrigatório)</label>
        <input id="modalFieldDesc" type="text" data-field="desc" value="${escapeHtml(sc.desc)}" placeholder="Para que serve este comando?" class="${FIELD} mb-3">

        <label class="block text-xs font-medium text-text-muted mb-1">Anexo de Mídia (Opcional)</label>
        <div class="mb-3 flex items-center gap-3">
            ${sc.media_url ? `
                <div class="relative group shrink-0">
                    <img src="${escapeHtml(sc.media_url)}" class="h-10 w-10 object-cover rounded border border-border-element bg-black/5" alt="Preview">
                    <button type="button" data-action="remove-modal-media" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:scale-110 transition-transform" title="Remover Imagem" aria-label="Remover Imagem">
                        ${icon('close', 'w-3 h-3')}
                    </button>
                </div>` : ''}
            <label class="cursor-pointer flex items-center justify-center px-3 py-1.5 bg-[color:var(--bg-app)] border border-border-element rounded-md hover:bg-bg-solid-hover transition-colors text-xs font-medium text-text-high">
                ${icon('image', 'w-4 h-4 mr-1.5')}
                <span id="mediaUploadBtnLabel">${sc.media_url ? 'Trocar Imagem' : 'Anexar Imagem'}</span>
                <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" class="hidden" data-media-input>
            </label>
            <label class="flex items-center gap-2 cursor-pointer ml-4">
                <input type="checkbox" data-field="requires_backup" class="rounded border-border-element bg-[color:var(--bg-app)] text-accent-solid focus:ring-accent-solid w-4 h-4" ${sc.requires_backup ? 'checked' : ''}>
                <span class="text-xs font-medium text-text-high">Comando obrigatório backup</span>
            </label>
        </div>

        <label for="modalFieldText" class="block text-xs font-medium text-text-muted mb-1">Comando SQL</label>
        <textarea id="modalFieldText" rows="4" data-field="text" class="w-full rounded-md px-3 py-1.5 bg-[color:var(--bg-app)] border border-border-element text-text-high focus:outline-none focus:ring-1 focus:ring-accent-solid font-mono text-xs flex-grow min-h-[80px]">${escapeHtml(sc.text)}</textarea>`;
}

function updateField(field, value) {
    const sc = modalSubs[activeModalTab];
    if (!sc) return;
    sc[field] = value;
    if (field === 'name') {
        const tab = els.modalTabs.children[activeModalTab];
        if (tab) tab.textContent = value || 'Nova Aba';
    }
}

async function uploadModalMedia(input) {
    const file = input.files[0];
    const sc = modalSubs[activeModalTab];
    if (!file || !sc) return;

    const label = $('mediaUploadBtnLabel');
    const originalLabel = label.textContent;
    label.textContent = 'Enviando...';
    input.disabled = true;

    try {
        sc.media_url = await uploadMedia(file);
        pendingUploads.add(sc.media_url);
        renderModal();
    } catch (error) {
        showAlert('Erro ao enviar imagem: ' + error.message);
        label.textContent = originalLabel;
        input.disabled = false;
        input.value = '';
    }
}

function addModalTab() {
    modalSubs.push({ name: '', desc: '', text: '' });
    activeModalTab = modalSubs.length - 1;
    renderModal();
}

function openCreateModal() {
    editingId = null;
    $('addModalTitle').textContent = 'Adicionar Novo Comando';
    els.title.value = '';
    $('commandVisibilityInput').value = 'public';
    modalSubs = [];
    pendingUploads = new Set();
    addModalTab();
    openModal('addModal');
}

function openEditModal(id) {
    const cmd = findCommand(id);
    if (!cmd) return;

    editingId = cmd.id;
    $('addModalTitle').textContent = 'Editar Comando';
    els.title.value = cmd.name;
    $('commandVisibilityInput').value = cmd._data.is_private ? 'private' : 'public';
    // Cópia profunda: editar no modal não pode alterar os dados em cache se o usuário cancelar.
    modalSubs = structuredClone(cmd._data.subCommands);
    if (modalSubs.length === 0) modalSubs = [{ name: '', desc: '', text: '' }];
    activeModalTab = 0;
    pendingUploads = new Set();
    renderModal();
    openModal('addModal');
}

/** Apaga do storage as imagens enviadas no modal que não chegaram a ser salvas. */
function discardPendingUploads() {
    if (pendingUploads.size === 0) return;
    deleteMedia([...pendingUploads]).catch((error) => console.warn('Falha ao descartar uploads pendentes:', error));
    pendingUploads = new Set();
}

async function cancelModal() {
    const hasContent = els.title.value.trim() !== ''
        || modalSubs.some((sc) => sc.name?.trim() || sc.desc?.trim() || sc.text?.trim() || sc.media_url);

    if (hasContent) {
        const confirmed = await showConfirm('Tem certeza que deseja cancelar? Todos os dados preenchidos serão perdidos.');
        if (!confirmed) return;
    }
    discardPendingUploads();
    closeModal('addModal');
}

function collectSubCommands() {
    return modalSubs.map((sc) => ({
        name: (sc.name ?? '').trim(),
        text: (sc.text ?? '').trim(),
        desc: (sc.desc ?? '').trim(),
        ...(sc.media_url && { media_url: sc.media_url }),
        ...(sc.requires_backup && { requires_backup: true })
    }));
}

async function saveCommand() {
    const title = els.title.value.trim();
    if (!title) return showAlert('O Título do Comando é obrigatório!');

    const subCommands = collectSubCommands();
    if (subCommands.length === 0) return showAlert('Adicione pelo menos um subcomando (Gaveta interna).');
    if (subCommands.some((sc) => !sc.name)) return showAlert('O Nome da Aba de todas as gavetas é obrigatório!');
    if (subCommands.some((sc) => !sc.desc)) return showAlert('A descrição de todas as gavetas é obrigatória!');
    if (subCommands.some((sc) => !sc.text)) return showAlert('O Comando SQL de todas as gavetas é obrigatório!');

    const isEditing = editingId !== null;
    let reason = null;
    if (isEditing) {
        reason = await promptReason();
        if (reason === null) return;
    }

    els.saveButton.textContent = 'Salvando...';
    els.saveButton.disabled = true;

    try {
        const oldCmd = isEditing ? allComandos.find((cmd) => cmd.id === editingId) : null;
        const commandJson = JSON.stringify({ is_private: $('commandVisibilityInput').value === 'private', subCommands });

        const payload = { name: title, command: commandJson };
        if (!isEditing) payload.created_by_name = authorName();

        const saved = isEditing
            ? await mutate(`comandos?${idQuery(editingId)}`, 'PATCH', payload)
            : await restJson('comandos', { method: 'POST', body: payload, prefer: 'return=representation' });
        const savedCmd = Array.isArray(saved) ? saved[0] : saved;

        // Mídias que deixaram de ser usadas (trocadas, removidas ou enviadas e descartadas).
        const keep = new Set(subCommands.map((sc) => sc.media_url).filter(Boolean));
        const orphans = [...pendingUploads].filter((url) => !keep.has(url));
        oldCmd?._data.subCommands.forEach((sc) => {
            if (sc.media_url && !keep.has(sc.media_url)) orphans.push(sc.media_url);
        });
        pendingUploads = new Set();
        if (orphans.length > 0) {
            const cleanup = await deleteMedia(orphans);
            if (!cleanup.ok) {
                showAlert(`O comando foi salvo, mas não foi possível excluir a imagem antiga do Supabase (${MEDIA_BUCKET}). Verifique as permissões (RLS) de DELETE. Detalhes: ${cleanup.detail}`);
            }
        }

        const historyRes = await rest('command_history', {
            method: 'POST',
            prefer: 'return=minimal',
            body: {
                command_id: savedCmd.id,
                action: isEditing ? 'UPDATE' : 'CREATE',
                user_name: displayName(),
                old_content: oldCmd ? { name: oldCmd.name, command: oldCmd.command } : null,
                new_content: { name: title, command: commandJson, ...(reason ? { reason } : {}) }
            }
        });
        if (!historyRes.ok) showAlert('O comando foi salvo, mas não foi possível registrar a alteração no histórico.');

        closeModal('addModal');
        els.title.value = '';
        editingId = null;
        await loadComandos();
    } catch (error) {
        if (isAuthenticated()) showAlert('Ocorreu um erro ao salvar no banco de dados. ' + error.message);
    } finally {
        els.saveButton.textContent = 'Salvar Comando';
        els.saveButton.disabled = false;
    }
}

// ---------- exclusão (vai para a lixeira) ----------
async function confirmDelete() {
    if (commandToDeleteId === null) return;
    const button = $('confirmDeleteBtn');
    button.textContent = 'Excluindo...';
    button.disabled = true;

    try {
        await setDeletedAt(commandToDeleteId, new Date().toISOString());
        await loadComandos();
    } catch (error) {
        if (isAuthenticated()) showAlert('Erro: ' + error.message);
    } finally {
        commandToDeleteId = null;
        closeModal('deleteModal');
        button.textContent = 'Sim, Excluir';
        button.disabled = false;
    }
}

// ---------- efeito de digitação no placeholder ----------
const PLACEHOLDER_PHRASES = [
    'Pesquisar por categorias...',
    'Buscar produtos com preço menor que custo...',
    'Como zerar o IPI?',
    'Tirar caracteres especiais...',
    'Ajuste de estoque...',
    'ERRO IMENDES...',
    'Set Produto...',
    'Comandos SQL úteis...',
    'Buscar produtos sem NCM...',
    'Corrigir tributação...'
];

function startTypewriter(input) {
    let phraseIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timer;

    function tick() {
        if (document.activeElement === input) return; // pausa enquanto o usuário digita
        const phrase = PLACEHOLDER_PHRASES[phraseIndex];

        if (deleting) {
            input.placeholder = phrase.substring(0, charIndex - 1);
            charIndex--;
        } else {
            input.placeholder = phrase.substring(0, charIndex + 1) + '|';
            charIndex++;
        }

        let delay = deleting ? 30 : 60;
        if (!deleting && charIndex === phrase.length) {
            input.placeholder = phrase;
            delay = 2000;
            deleting = true;
        } else if (deleting && charIndex === 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % PLACEHOLDER_PHRASES.length;
            delay = 500;
        }
        timer = setTimeout(tick, delay);
    }

    input.addEventListener('focus', () => {
        clearTimeout(timer);
        input.placeholder = 'Pesquisar...';
    });
    input.addEventListener('blur', () => {
        if (input.value === '') {
            deleting = false;
            charIndex = 0;
            tick();
        }
    });
    tick();
}

// ---------- inicialização ----------
function initComandos() {
    Object.assign(els, {
        input: $('cmdSearchInput'),
        container: $('categoriesContainer'),
        tabAll: $('tabFilterAll'),
        tabMine: $('tabFilterMine'),
        indicator: $('tabIndicator'),
        addButton: $('openAddModalBtn'),
        saveButton: $('saveCommandBtn'),
        title: $('commandTitleInput'),
        modalTabs: $('modalTabsContainer'),
        modalContent: $('modalContentContainer')
    });

    setupAutocomplete({
        input: els.input,
        container: $('cmdSuggestionsContainer'),
        getSuggestions: () => suggestions,
        onSearch: applySearch
    });
    startTypewriter(els.input);

    registerActions({
        'filter-commands': (button) => setFilterTab(button.dataset.filter),

        'toggle-drawer': (button) => {
            const drawer = button.previousElementSibling;
            const opening = drawer.classList.contains('max-w-0');
            closeAllDrawers();
            if (opening) {
                drawer.classList.remove('max-w-0', 'opacity-0');
                drawer.classList.add('max-w-[200px]', 'opacity-100');
            }
        },

        'copy-command': (button) => {
            const sc = findCommand(button.dataset.id)?._data.subCommands[Number(button.dataset.index)];
            if (sc) return copyText(sc.text.trim(), button);
        },

        'download-command': (button) => {
            const sc = findCommand(button.dataset.id)?._data.subCommands[Number(button.dataset.index)];
            if (!sc) return;
            const text = sc.text.trim();
            if (!text) return showAlert('O comando está vazio. Edite-o e preencha o código SQL para poder baixar.');
            const safeName = sc.name.replace(/[\\/:*?"<>|]/g, '_');
            downloadTextFile(text, /\.sql$/i.test(safeName) ? safeName : `${safeName}.sql`);
        },

        'show-description': (el) => {
            const sc = findCommand(el.dataset.id)?._data.subCommands[Number(el.dataset.index)];
            if (sc) showInfo({ title: 'Descrição', text: sc.desc || 'Descrição não informada.', imageUrl: sc.media_url });
        },

        'view-history': (button) => viewHistory(button.dataset.id),
        'edit-command': (button) => openEditModal(button.dataset.id),
        'delete-command': (button) => {
            commandToDeleteId = button.dataset.id;
            openModal('deleteModal');
        },

        'add-modal-tab': addModalTab,
        'switch-modal-tab': (button) => {
            activeModalTab = Number(button.dataset.index);
            renderModal();
        },
        'remove-modal-tab': () => {
            modalSubs.splice(activeModalTab, 1);
            activeModalTab = Math.max(0, Math.min(activeModalTab, modalSubs.length - 1));
            renderModal();
        },
        'remove-modal-media': () => {
            const sc = modalSubs[activeModalTab];
            if (sc) delete sc.media_url;
            renderModal();
        }
    });

    els.addButton.addEventListener('click', openCreateModal);
    $('cancelAddBtn').addEventListener('click', cancelModal);
    els.saveButton.addEventListener('click', saveCommand);

    $('cancelDeleteBtn').addEventListener('click', () => {
        commandToDeleteId = null;
        closeModal('deleteModal');
    });
    $('confirmDeleteBtn').addEventListener('click', confirmDelete);

    // Campos do modal: um único listener por tipo de evento em vez de handlers inline.
    els.modalContent.addEventListener('input', (event) => {
        const field = event.target.dataset?.field;
        if (field && field !== 'requires_backup') updateField(field, event.target.value);
    });
    els.modalContent.addEventListener('change', (event) => {
        const target = event.target;
        if (target.dataset.field === 'requires_backup') updateField('requires_backup', target.checked);
        else if ('mediaInput' in target.dataset) uploadModalMedia(target);
    });

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.action-drawer') && !event.target.closest('[data-action="toggle-drawer"]')) closeAllDrawers();
    });
}

function closeAllDrawers() {
    document.querySelectorAll('.action-drawer').forEach((drawer) => {
        drawer.classList.add('max-w-0', 'opacity-0');
        drawer.classList.remove('max-w-[200px]', 'opacity-100');
    });
}

App.comandos = { parseCommandData, getTrash, loadComandos, purgeCommand, restoreCommand, positionFilterIndicator, applyCommandPermissions, resetComandos, initComandos };
})();
