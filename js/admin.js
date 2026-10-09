(function () {
'use strict';

// Painéis do administrador: lixeira de comandos e solicitações de troca de senha.
const { $, registerActions, openModal, closeUserMenu, showAlert, showConfirm } = App.ui;
const { rest, restJson, isAdmin } = App.api;
const { getTrash, loadComandos, restoreCommand, purgeCommand } = App.comandos;
const { icon } = App.icons;
const { TRASH_TTL_MS } = App.config;
const { escapeHtml } = App.utils;

let passwordRequests = [];

/** Mostra/esconde no menu do usuário os itens exclusivos do administrador. */
function applyAdminMenu() {
    $('openTrashModalBtn').classList.toggle('hidden', !isAdmin());
    $('openPasswordRequestsBtn').classList.toggle('hidden', !isAdmin());
}

/** Remove da tela dados sensíveis ao sair da conta. */
function resetAdmin() {
    passwordRequests = [];
    $('trashList').replaceChildren();
    $('passwordRequestsList').replaceChildren();
}

// ---------- lixeira ----------
function renderTrash() {
    const list = $('trashList');
    const items = getTrash();

    if (items.length === 0) {
        list.innerHTML = '<p class="text-text-muted text-center py-8">Nenhum comando na lixeira.</p>';
        return;
    }

    list.innerHTML = items.map((cmd) => {
        const deletedAt = new Date(cmd._data.deleted_at);
        const expiresAt = new Date(deletedAt.getTime() + TRASH_TTL_MS);
        const id = escapeHtml(cmd.id);
        return `
            <div class="bg-bg-panel border border-border-element p-4 rounded-lg flex justify-between items-center">
                <div>
                    <h4 class="font-medium text-text-high mb-1">${escapeHtml(cmd.name)}</h4>
                    <p class="text-xs text-text-muted">Deletado: ${escapeHtml(deletedAt.toLocaleString('pt-BR'))}</p>
                    <p class="text-xs text-red-400">Expira: ${escapeHtml(expiresAt.toLocaleString('pt-BR'))}</p>
                </div>
                <div class="flex gap-2">
                    <button type="button" data-id="${id}" data-action="restore-command" class="p-2 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors" title="Restaurar" aria-label="Restaurar">${icon('restore', 'w-5 h-5')}</button>
                    <button type="button" data-id="${id}" data-action="purge-command" class="p-2 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors" title="Excluir Permanentemente" aria-label="Excluir Permanentemente">${icon('trash', 'w-5 h-5')}</button>
                </div>
            </div>`;
    }).join('');
}

// ---------- solicitações de senha ----------
async function renderPasswordRequests() {
    const list = $('passwordRequestsList');
    list.innerHTML = '<p class="text-text-muted text-center py-4">Carregando...</p>';

    try {
        passwordRequests = await restJson('password_requests?select=*') ?? [];

        if (passwordRequests.length === 0) {
            list.innerHTML = '<p class="text-text-muted text-center py-4">Nenhuma solicitação pendente.</p>';
            return;
        }

        list.innerHTML = passwordRequests.map((req) => `
            <div class="bg-bg-app border border-border-element p-4 rounded-lg flex items-center justify-between">
                <div>
                    <p class="text-text-high font-medium">Usuário: <span class="text-accent-solid">${escapeHtml(req.username)}</span></p>
                    <p class="text-text-muted text-sm">Nova senha: <span class="font-mono bg-black/20 px-1 rounded">${escapeHtml(req.new_password)}</span></p>
                </div>
                <div class="flex gap-2">
                    <button type="button" data-id="${escapeHtml(req.id)}" data-action="reject-password" class="px-3 py-1.5 bg-red-500/20 text-red-500 rounded hover:bg-red-500/30 transition-colors text-sm font-medium">Recusar</button>
                    <button type="button" data-id="${escapeHtml(req.id)}" data-action="accept-password" class="px-3 py-1.5 bg-green-500/20 text-green-500 rounded hover:bg-green-500/30 transition-colors text-sm font-medium">Aceitar</button>
                </div>
            </div>`).join('');
    } catch (error) {
        console.error('Erro ao buscar solicitações de senha', error);
        list.innerHTML = `<p class="text-red-500 text-center py-4">${escapeHtml(error.message)}</p>`;
    }
}

/** Apaga a solicitação e confere (RLS pode responder 204 sem apagar nada). */
async function deleteRequest(id) {
    const rows = await restJson(`password_requests?id=eq.${encodeURIComponent(String(id))}`, { method: 'DELETE', prefer: 'return=representation' });
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error('A solicitação NÃO foi apagada no banco. Verifique as Políticas RLS (DELETE) da tabela password_requests no Supabase.');
    }
}

async function acceptPasswordRequest(id) {
    const request = passwordRequests.find((req) => String(req.id) === String(id));
    if (!request) return;

    const confirmed = await showConfirm(`Alterar a senha do usuário "${request.username}" para a senha solicitada?`);
    if (!confirmed) return;

    const res = await rest('rpc/update_user_password', {
        method: 'POST',
        body: { target_username: request.username, new_password: request.new_password }
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Erro ao atualizar senha via RPC (update_user_password).');
    }

    try {
        await deleteRequest(id);
    } catch (error) {
        throw new Error('A senha foi alterada, mas a solicitação continua pendente. ' + error.message);
    }
    await showAlert('Senha atualizada com sucesso!');
    await renderPasswordRequests();
}

async function rejectPasswordRequest(id) {
    const confirmed = await showConfirm('Tem certeza que deseja recusar e apagar este pedido de troca de senha?');
    if (!confirmed) return;

    await deleteRequest(id);
    await showAlert('Solicitação recusada e excluída.');
    await renderPasswordRequests();
}

// ---------- inicialização ----------
function initAdmin() {
    registerActions({
        'open-trash': () => {
            closeUserMenu();
            renderTrash();
            openModal('trashModal');
        },
        'restore-command': async (button) => {
            await restoreCommand(button.dataset.id);
            renderTrash();
        },
        'purge-command': async (button) => {
            const cmd = getTrash().find((item) => String(item.id) === button.dataset.id);
            if (!cmd) return;
            if (!await showConfirm('Deseja realmente excluir este comando permanentemente?')) return;
            await purgeCommand(cmd);
            await loadComandos();
            renderTrash();
        },

        'open-password-requests': () => {
            closeUserMenu();
            openModal('passwordRequestsModal');
            return renderPasswordRequests();
        },
        'accept-password': (button) => acceptPasswordRequest(button.dataset.id),
        'reject-password': (button) => rejectPasswordRequest(button.dataset.id)
    });
}

App.admin = { applyAdminMenu, resetAdmin, initAdmin };
})();
