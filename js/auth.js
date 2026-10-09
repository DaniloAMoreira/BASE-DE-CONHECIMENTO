(function () {
'use strict';

// Formulários da tela de login: entrar, sair e pedir troca de senha.
const { $ } = App.ui;
const { signIn, signOut, rest } = App.api;
const { ADMIN_EMAIL, EMAIL_DOMAIN, TEAM_USERNAMES } = App.config;

/** "joao" -> "joao@dominio"; campo vazio entra como administrador (comportamento histórico). */
function toLoginEmail(value) {
    const typed = value.trim().toLowerCase();
    if (!typed) return ADMIN_EMAIL;
    return typed.includes('@') ? typed : `${typed}@${EMAIL_DOMAIN}`;
}

function showMessage(element, text) {
    element.textContent = text;
    element.classList.remove('hidden');
}

function setBusy(button, spinner, busy) {
    button.disabled = busy;
    spinner.classList.toggle('hidden', !busy);
}

async function handleLogin(event) {
    event.preventDefault();
    const button = $('login-btn');
    const spinner = $('login-spinner');
    const error = $('login-error');

    setBusy(button, spinner, true);
    error.classList.add('hidden');
    try {
        await signIn(toLoginEmail($('login-user').value), $('login-password').value);
        $('login-password').value = '';
    } catch (err) {
        console.error('Erro de login:', err);
        showMessage(error, err.message || 'Usuário ou senha incorretos.');
    } finally {
        setBusy(button, spinner, false);
    }
}

/**
 * Registra o pedido de troca de senha para o administrador aprovar.
 * Importante: este fluxo NÃO autentica ninguém.
 */
async function handleForgotPassword(event) {
    event.preventDefault();
    const username = $('forgot-user').value.trim().toLowerCase();
    const newPassword = $('forgot-new-password').value;
    const error = $('forgot-error');
    const success = $('forgot-success');

    error.classList.add('hidden');
    success.classList.add('hidden');

    if (!TEAM_USERNAMES.includes(username)) return showMessage(error, 'Nome de usuário inválido ou não encontrado.');
    if (newPassword !== $('forgot-confirm-password').value) return showMessage(error, 'As senhas não coincidem.');

    const button = $('forgot-btn');
    const spinner = $('forgot-spinner');
    setBusy(button, spinner, true);
    try {
        const res = await rest('password_requests', {
            method: 'POST',
            body: { username, new_password: newPassword },
            prefer: 'return=minimal'
        });
        if (!res.ok) throw new Error('Erro ao salvar solicitação no banco.');

        $('forgot-password-form').reset();
        success.classList.remove('hidden');
    } catch (err) {
        console.error('Erro ao pedir troca de senha:', err);
        showMessage(error, err.message || 'Ocorreu um erro ao enviar.');
    } finally {
        setBusy(button, spinner, false);
    }
}

function initAuth() {
    const loginForm = $('login-form');
    const forgotForm = $('forgot-password-form');

    loginForm.addEventListener('submit', handleLogin);
    forgotForm.addEventListener('submit', handleForgotPassword);

    $('forgot-password-link').addEventListener('click', () => {
        loginForm.classList.add('hidden');
        forgotForm.classList.remove('hidden');
    });
    $('back-to-login-btn').addEventListener('click', () => {
        forgotForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    $('logout-btn').addEventListener('click', signOut);
}

App.auth = { initAuth };
})();
