(function () {
'use strict';

// Ponto de entrada: liga os módulos, controla login/logout e a navegação entre telas.
const { $, initActionDelegation, initModals, initTheme, initUserMenu, closeUserMenu, showAlert, closeModal } = App.ui;
const { authEvents, isAuthenticated, currentUser, displayName } = App.api;
const { initSynapses } = App.background;
const { initCards } = App.cards;
const { initAuth } = App.auth;
const { initBase, loadBase } = App.base;
const { initComandos, loadComandos, resetComandos, applyCommandPermissions, positionFilterIndicator } = App.comandos;
const { initArquivos, loadArquivos, resetArquivos } = App.arquivos;
const { initAdmin, applyAdminMenu, resetAdmin } = App.admin;

// Chaves que versões anteriores gravavam no localStorage e que não são mais usadas
// (inclui token/usuário de uma sessão que nunca expirava).
const LEGACY_STORAGE_KEYS = ['supabaseToken', 'supabaseUser', 'relatorio_horas_extras_custom', 'invalid_horas_cards'];

function clearLegacyStorage() {
    try { LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key)); } catch { /* storage indisponível */ }
}

// ---------- navegação entre telas ----------
const VIEWS = {
    base: { tab: 'nav-base-tab', view: 'view-base' },
    comandos: { tab: 'nav-comandos-tab', view: 'view-comandos' },
    arquivos: { tab: 'nav-arquivos-tab', view: 'view-arquivos' }
};

function showView(name) {
    Object.entries(VIEWS).forEach(([viewName, ids]) => {
        const active = viewName === name;
        $(ids.view).classList.toggle('hidden', !active);
        const tab = $(ids.tab);
        tab.classList.toggle('tab-active', active);
        tab.classList.toggle('tab-inactive', !active);
        tab.setAttribute('aria-selected', String(active));
    });
    // A linha animada só pode ser medida com a tela visível.
    if (name === 'comandos') positionFilterIndicator();
}

function initNavigation() {
    Object.entries(VIEWS).forEach(([name, ids]) => $(ids.tab).addEventListener('click', () => showView(name)));
}

// ---------- estado de autenticação na interface ----------
function renderAuthState() {
    const authed = isAuthenticated();
    const main = $('main-content');

    $('login-overlay').style.display = authed ? 'none' : 'flex';
    $('user-menu-container').classList.toggle('hidden', !authed);

    if (!authed) {
        main.classList.add('hidden', 'opacity-0');
        return;
    }

    const name = displayName(currentUser());
    $('user-name-display').textContent = name;
    $('user-avatar').textContent = name.charAt(0).toUpperCase();
    applyCommandPermissions();
    applyAdminMenu();

    main.classList.remove('hidden');
    // Pequeno atraso para o navegador aplicar display antes de animar a opacidade.
    setTimeout(() => {
        main.classList.remove('opacity-0');
        positionFilterIndicator();
    }, 50);
}

function loadAll() {
    return Promise.allSettled([loadBase(), loadComandos(), loadArquivos()]);
}

function handleSignedOut() {
    resetComandos();
    resetArquivos();
    resetAdmin();
    ['trashModal', 'passwordRequestsModal', 'historyModal', 'addModal', 'arquivoModal', 'infoModal', 'deleteModal'].forEach(closeModal);
    closeUserMenu();
    showView('comandos');
    renderAuthState();
}

function boot() {
    clearLegacyStorage();

    initTheme();
    initActionDelegation();
    initModals();
    initUserMenu();
    initCards();

    initSynapses($('site-synapses-canvas'));
    initSynapses($('synapses-canvas'));

    initAuth();
    initBase();
    initComandos();
    initArquivos();
    initAdmin();
    initNavigation();
    showView('comandos');

    authEvents.addEventListener('login', () => {
        renderAuthState();
        loadAll();
    });
    authEvents.addEventListener('logout', handleSignedOut);
    authEvents.addEventListener('expired', () => {
        handleSignedOut();
        showAlert('Sua sessão expirou por segurança. Faça login novamente.');
    });

    renderAuthState();
    if (isAuthenticated()) loadAll();
}

boot();

})();
