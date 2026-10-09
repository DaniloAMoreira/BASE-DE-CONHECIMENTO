(function () {
'use strict';

// Sessão do usuário + cliente HTTP do Supabase (Auth, REST e Storage).
const { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_KEYS, ADMIN_EMAIL, VISITOR_EMAIL, MEDIA_BUCKET } = App.config;
const { uniqueId } = App.utils;

/** Eventos: 'login' | 'logout' | 'expired'. */
const authEvents = new EventTarget();

// ---------- armazenamento da sessão (sessionStorage: some ao fechar a aba) ----------
const store = {
    get(key) {
        try { return sessionStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
        try { sessionStorage.setItem(key, value); } catch { /* storage indisponível */ }
    },
    remove(key) {
        try { sessionStorage.removeItem(key); } catch { /* storage indisponível */ }
    }
};

function readStoredSession() {
    const token = store.get(STORAGE_KEYS.token);
    let user = null;
    try { user = JSON.parse(store.get(STORAGE_KEYS.user) || 'null'); } catch { /* JSON corrompido */ }
    if (!token || !user) return null;
    return { token, refreshToken: store.get(STORAGE_KEYS.refreshToken), user };
}

let session = readStoredSession();

function persistSession(data) {
    session = {
        token: data.access_token,
        refreshToken: data.refresh_token ?? session?.refreshToken ?? null,
        user: data.user ?? session?.user
    };
    store.set(STORAGE_KEYS.token, session.token);
    store.set(STORAGE_KEYS.user, JSON.stringify(session.user));
    if (session.refreshToken) store.set(STORAGE_KEYS.refreshToken, session.refreshToken);
}

function clearSession() {
    session = null;
    [STORAGE_KEYS.token, STORAGE_KEYS.user, STORAGE_KEYS.refreshToken].forEach((key) => store.remove(key));
}

// ---------- consultas sobre a sessão ----------
const isAuthenticated = () => session !== null;
const currentUser = () => session?.user ?? null;
const getAccessToken = () => session?.token ?? '';
const currentEmail = () => (session?.user?.email || '').toLowerCase();
const isAdmin = () => currentEmail() === ADMIN_EMAIL;
const isVisitor = () => currentEmail() === VISITOR_EMAIL;

function displayName(user = currentUser()) {
    return user?.user_metadata?.name || user?.email?.split('@')[0] || 'Desconhecido';
}

/**
 * Nome gravado em comandos.created_by_name. Precisa bater (sem diferenciar maiúsculas) com a parte
 * local do e-mail, que é o que o banco usa para decidir quem é o autor; o nome de exibição
 * (user_metadata.name) pode ser editado pelo próprio usuário e por isso não serve de identidade.
 */
function authorName(user = currentUser()) {
    const local = (user?.email || '').split('@')[0];
    const name = user?.user_metadata?.name;
    if (name && name.toLowerCase() === local.toLowerCase()) return name;
    return local || name || 'Desconhecido';
}

const isSameAuthor = (a, b) => String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase();

// ---------- autenticação ----------
async function signIn(email, password) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro ao logar');

    persistSession(data);
    authEvents.dispatchEvent(new Event('login'));
}

function signOut() {
    const token = session?.token;
    clearSession();
    if (token) {
        // Invalida só esta sessão no servidor; falha aqui não impede o logout local.
        fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
            method: 'POST',
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
        }).catch(() => {});
    }
    authEvents.dispatchEvent(new Event('logout'));
}

let refreshing = null;

/** Renova o access token uma única vez, mesmo com várias requisições falhando juntas. */
function refreshSession() {
    if (!session?.refreshToken) return Promise.resolve(false);

    refreshing ??= (async () => {
        try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
                method: 'POST',
                headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: session.refreshToken })
            });
            if (!res.ok) return false;
            persistSession(await res.json());
            return true;
        } catch {
            return false;
        } finally {
            refreshing = null;
        }
    })();
    return refreshing;
}

function expireSession() {
    clearSession();
    authEvents.dispatchEvent(new Event('expired'));
}

// ---------- HTTP ----------
function buildHeaders(extra) {
    return {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session?.token || SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...extra
    };
}

/** fetch autenticado. Em 401 tenta renovar o token; se não der, encerra a sessão. */
async function request(url, { method = 'GET', headers, body, retry = true } = {}) {
    const res = await fetch(url, { method, headers: buildHeaders(headers), body });
    if (res.status === 401 && session && retry) {
        if (await refreshSession()) return request(url, { method, headers, body, retry: false });
        expireSession();
    }
    return res;
}

async function errorMessage(res) {
    try {
        const data = await res.json();
        return data.message || data.error_description || data.msg || `Erro ${res.status}`;
    } catch {
        return `Erro ${res.status}`;
    }
}

/** Chamada REST (PostgREST). `body` é um objeto/array serializado em JSON. Devolve a Response. */
function rest(path, { method = 'GET', body, prefer } = {}) {
    return request(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: prefer ? { Prefer: prefer } : undefined,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
}

/** Como `rest`, mas lança Error se !ok e devolve o JSON (ou null quando não há corpo). */
async function restJson(path, options) {
    const res = await rest(path, options);
    if (!res.ok) throw new Error(await errorMessage(res));
    const text = await res.text();
    return text ? JSON.parse(text) : null;
}

// ---------- Storage (mídias dos comandos) ----------
const publicMediaPrefix = `${SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/`;

function mediaPathFromUrl(url) {
    if (typeof url !== 'string') return '';
    const marker = `/${MEDIA_BUCKET}/`;
    const index = url.indexOf(marker);
    return index === -1 ? '' : url.slice(index + marker.length);
}

/** Envia uma imagem e devolve a URL pública. */
async function uploadMedia(file) {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
        throw new Error('Envie um arquivo de imagem (PNG, JPG, GIF ou WebP).');
    }
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `uploads/${Date.now()}-${uniqueId()}.${ext}`;

    const res = await request(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
    });
    if (!res.ok) throw new Error(`Upload falhou: ${res.status} - ${await res.text()}`);

    return publicMediaPrefix + path;
}

/** Apaga mídias pelo URL público. Devolve { ok, detail }. */
async function deleteMedia(urls) {
    const prefixes = urls.map(mediaPathFromUrl).filter(Boolean);
    if (prefixes.length === 0) return { ok: true, detail: '' };

    const res = await request(`${SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}`, {
        method: 'DELETE',
        body: JSON.stringify({ prefixes })
    });
    return { ok: res.ok, detail: res.ok ? '' : await res.text() };
}

App.api = { authEvents, isAuthenticated, currentUser, getAccessToken, isAdmin, isVisitor, displayName, authorName, isSameAuthor, signIn, signOut, refreshSession, expireSession, request, rest, restJson, mediaPathFromUrl, uploadMedia, deleteMedia };
})();
