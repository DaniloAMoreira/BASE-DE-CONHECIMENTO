(function () {
'use strict';

// Utilitários de interface compartilhados: ações delegadas, modais, tema, cópia e download.
const { STORAGE_KEYS } = App.config;
const { safeHttpUrl } = App.utils;

const $ = (id) => document.getElementById(id);

// ---------- ações delegadas (substitui os onclick inline) ----------
const actions = new Map();

/** Registra handlers para elementos com `data-action="nome"`. Handler recebe (elemento, evento). */
function registerActions(map) {
    Object.entries(map).forEach(([name, handler]) => actions.set(name, handler));
}

function runAction(el, event) {
    const handler = actions.get(el.dataset.action);
    if (!handler) return;
    try {
        const result = handler(el, event);
        if (result && typeof result.catch === 'function') result.catch(reportError);
    } catch (error) {
        reportError(error);
    }
}

function reportError(error) {
    console.error(error);
    showAlert('Ocorreu um erro: ' + (error?.message || error));
}

function initActionDelegation() {
    document.addEventListener('click', (event) => {
        const el = event.target.closest('[data-action]');
        if (el && !el.disabled) runAction(el, event);
    });

    // Elementos role="button" (cabeçalhos de card) respondem a Enter/Espaço.
    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const el = event.target;
        if (el instanceof Element && el.matches('[role="button"][data-action]')) {
            event.preventDefault();
            el.click();
        }
    });
}

// ---------- modais ----------
// Do mais ao menos prioritário: Esc fecha o primeiro que estiver aberto.
const MODAL_PRIORITY = ['confirmModal', 'alertModal', 'reasonModal', 'deleteModal', 'historyModal', 'trashModal', 'passwordRequestsModal', 'infoModal', 'arquivoModal', 'addModal'];

const openModal = (id) => $(id).classList.remove('hidden');
const closeModal = (id) => $(id).classList.add('hidden');

function initModals() {
    registerActions({ 'close-modal': (el) => closeModal(el.dataset.modal) });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const id = MODAL_PRIORITY.find((modalId) => $(modalId) && !$(modalId).classList.contains('hidden'));
        if (!id) return;
        // O botão marcado com data-modal-close executa o fluxo de cancelamento do próprio modal.
        const closer = $(id).querySelector('[data-modal-close]');
        if (closer) closer.click();
        else closeModal(id);
    });
    $('infoOkBtn').addEventListener('click', () => closeModal('infoModal'));
}

function animateIn(modal) {
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        modal.firstElementChild.classList.remove('scale-95');
    }, 10);
}

function animateOut(modal) {
    modal.classList.add('opacity-0');
    modal.firstElementChild.classList.add('scale-95');
    return new Promise((resolve) => setTimeout(() => {
        modal.classList.add('hidden');
        resolve();
    }, 300));
}

function showAlert(message, title = 'Aviso') {
    $('alertModalTitle').textContent = title;
    $('alertModalMessage').textContent = message;
    const modal = $('alertModal');
    const button = $('alertModalBtn');
    animateIn(modal);
    button.focus();

    return new Promise((resolve) => {
        button.onclick = async () => {
            button.onclick = null;
            await animateOut(modal);
            resolve();
        };
    });
}

function showConfirm(message, title = 'Confirmação') {
    $('confirmModalTitle').textContent = title;
    $('confirmModalMessage').textContent = message;
    const modal = $('confirmModal');
    const okBtn = $('confirmModalOkBtn');
    const cancelBtn = $('confirmModalCancelBtn');
    animateIn(modal);
    okBtn.focus();

    return new Promise((resolve) => {
        const finish = async (result) => {
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            await animateOut(modal);
            resolve(result);
        };
        okBtn.onclick = () => finish(true);
        cancelBtn.onclick = () => finish(false);
    });
}

/** Modal "Motivo da Alteração". Resolve com o texto digitado ou null se cancelado. */
function promptReason() {
    return new Promise((resolve) => {
        const input = $('reasonInput');
        const controller = new AbortController();
        const { signal } = controller;

        const finish = (value) => {
            controller.abort();
            closeModal('reasonModal');
            resolve(value);
        };

        input.value = '';
        openModal('reasonModal');
        input.focus();

        $('reasonOkBtn').addEventListener('click', () => {
            const reason = input.value.trim();
            if (!reason) {
                showAlert('O motivo da alteração é obrigatório!');
                return;
            }
            finish(reason);
        }, { signal });
        $('reasonCancelBtn').addEventListener('click', () => finish(null), { signal });
        $('reasonCancelTopBtn').addEventListener('click', () => finish(null), { signal });
    });
}

/** Abre o modal de informação com texto e, opcionalmente, uma imagem clicável. */
function showInfo({ title = 'Informação', text = '', imageUrl = '' }) {
    $('infoModalTitle').textContent = title;
    const body = $('infoMessage');
    body.replaceChildren();

    const paragraph = document.createElement('p');
    paragraph.className = 'whitespace-pre-wrap';
    paragraph.textContent = text;
    body.appendChild(paragraph);

    const safeImage = safeHttpUrl(imageUrl);
    if (safeImage) {
        const wrapper = document.createElement('div');
        wrapper.className = 'mt-4 border-t border-border-subtle pt-4 flex justify-center bg-black/10 rounded-lg p-2';

        const link = document.createElement('a');
        link.href = safeImage;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = 'Clique para abrir imagem original';

        const image = document.createElement('img');
        image.src = safeImage;
        image.alt = 'Anexo do comando';
        image.className = 'max-w-full rounded hover:opacity-90 transition-opacity shadow-sm';
        image.style.cssText = 'max-height: 400px; object-fit: contain;';

        link.appendChild(image);
        wrapper.appendChild(link);
        body.appendChild(wrapper);
    }
    openModal('infoModal');
}

// ---------- tema ----------
function readTheme() {
    try { return localStorage.getItem(STORAGE_KEYS.theme) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

function initTheme() {
    const apply = (theme) => {
        document.documentElement.dataset.theme = theme;
        try { localStorage.setItem(STORAGE_KEYS.theme, theme); } catch { /* storage indisponível */ }
        $('theme-icon-sun').classList.toggle('hidden', theme === 'dark');
        $('theme-icon-moon').classList.toggle('hidden', theme === 'light');
    };
    apply(readTheme());
    $('theme-toggle-btn').addEventListener('click', () => {
        apply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });
}

// ---------- menu do usuário ----------
function initUserMenu() {
    const dropdown = $('user-dropdown');
    $('user-info-badge').addEventListener('click', () => {
        const open = dropdown.classList.toggle('hidden') === false;
        $('user-info-badge').setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
        if (!event.target.closest('#user-menu-container')) {
            dropdown.classList.add('hidden');
            $('user-info-badge').setAttribute('aria-expanded', 'false');
        }
    });
}

const closeUserMenu = () => $('user-dropdown').classList.add('hidden');

// ---------- cópia e download ----------
function flashCopied(button) {
    button.nextElementSibling?.classList.contains('copy-notification') && button.nextElementSibling.remove();

    const toast = document.createElement('div');
    toast.className = 'copy-notification absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-green-600 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-50 pointer-events-none transition-opacity duration-300';
    toast.textContent = 'Copiado!';
    button.parentNode.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
}

function fallbackCopy(text) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* sem suporte */ }
    area.remove();
    return copied;
}

async function copyText(text, button) {
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            copied = true;
        } catch { /* cai no plano B */ }
    }
    if (!copied) copied = fallbackCopy(text);

    if (copied) flashCopied(button);
    else showAlert('Não foi possível copiar o comando.');
}

function downloadTextFile(text, fileName) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

App.ui = { $, registerActions, initActionDelegation, openModal, closeModal, initModals, showAlert, showConfirm, promptReason, showInfo, initTheme, initUserMenu, closeUserMenu, copyText, downloadTextFile };
})();
