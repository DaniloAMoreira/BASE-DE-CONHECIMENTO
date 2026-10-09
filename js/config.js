var App = window.App = window.App || {};

(function () {
'use strict';

// Configuração central. A chave "anon" do Supabase é pública por design:
// a proteção real dos dados vem das políticas RLS no banco, não desta chave.
const SUPABASE_URL = 'https://jqllbwlfikckavipqtfr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxbGxid2xmaWtja2F2aXBxdGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzczMDQsImV4cCI6MjA5ODA1MzMwNH0.adNqWBWMY3PlIx_0OG1bMswbVR_TThtCmNWFptxkgRU';

const EMAIL_DOMAIN = 'lcsistemas.com';
const ADMIN_EMAIL = `admin@${EMAIL_DOMAIN}`;
const VISITOR_EMAIL = `visitante@${EMAIL_DOMAIN}`;

const MEDIA_BUCKET = 'comandos-midia';
const TRASH_TTL_MS = 48 * 60 * 60 * 1000;

// Usuários que podem pedir troca de senha na tela de login.
const TEAM_USERNAMES = ['rafael', 'leandro', 'danilo', 'ana', 'carlos', 'renato', 'gabriel', 'lucas', 'pedro', 'joao'];

// Aba "Arquivos": URL do web app do Google Apps Script (Code.gs), que cadastra, troca e exclui
// arquivos na pasta do Google Drive. Passo a passo no guia ARQUIVOS-DRIVE.md (arquivos de suporte).
// Vazia = a aba mostra o aviso "Google Drive ainda não conectado".
const FILES_API_URL = 'https://script.google.com/macros/s/AKfycbxfYqitvIeJCFP0CS8AirJzrjx5gWCkDV6jQJUOsuk3yAivgCeSywQM3Ze6PO8eXWQy/exec';
const FILES_MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB (mesmo limite do Code.gs)
const FILES_CHUNK_BYTES = 1024 * 1024;             // tamanho inicial dos blocos (múltiplo de 256 KB)
const FILES_MAX_CHUNK_BYTES = 20 * 1024 * 1024;   // os blocos crescem até isto enquanto o envio vai bem

// Chaves de sessionStorage mantidas iguais às da versão anterior (sessões abertas continuam válidas).
const STORAGE_KEYS = {
    token: 'supabaseToken',
    user: 'supabaseUser',
    refreshToken: 'supabaseRefreshToken',
    theme: 'themePreference'
};

App.config = { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_DOMAIN, ADMIN_EMAIL, VISITOR_EMAIL, MEDIA_BUCKET, TRASH_TTL_MS, TEAM_USERNAMES, FILES_API_URL, FILES_MAX_UPLOAD_BYTES, FILES_CHUNK_BYTES, FILES_MAX_CHUNK_BYTES, STORAGE_KEYS };
})();
