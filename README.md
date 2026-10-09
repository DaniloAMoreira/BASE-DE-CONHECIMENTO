# Base de Conhecimento (uso interno)

Site estático (HTML + JavaScript puro em scripts clássicos + Tailwind via CDN, sem build) com três telas — **Base de Conhecimento**, **Comandos SQL** e **Arquivos** — e backend no Supabase (Auth, tabelas `comandos`/`command_history`/`password_requests`, Storage `comandos-midia`) e no Google Drive (aba Arquivos).

## Abrir / testar

Basta **dar dois cliques no `index.html`** — não precisa de servidor (os scripts são clássicos, funcionam em `file://`).
A única exceção é a aba **Base de Conhecimento**, que lê o `database.json` e o navegador bloqueia isso em arquivo local;
para ela, publique o site ou rode `python -m http.server` na pasta e abra <http://localhost:8000>.

## Estrutura

| Arquivo | Para quê |
|---|---|
| `index.html` | Marcação das telas; carrega os scripts de `js/` em ordem |
| `style.css` | Tema escuro/claro e estilos |
| `js/` | Código do site. Os arquivos compartilham o objeto global `App` (cada um expõe suas funções em `App.<nome>`) |
| `database.json` | Conteúdo da Base de Conhecimento |
| `js/config.js` | URLs e chaves públicas (Supabase, Google Drive), limites de upload |
| `favicon.png`, `logo-login.png` | Imagens |

Depois de alterar qualquer `js/*.js` ou `style.css`, aumente o `?v=` correspondente no `index.html` (ou recarregue com `Ctrl+F5`) para o navegador não usar cache antigo.

## Fora deste repositório

O script do Google Apps Script (aba Arquivos), o SQL de segurança do Supabase, o relatório de auditoria e os guias de instalação ficam numa pasta de **arquivos de suporte** local, de propósito: não fazem parte do site e alguns descrevem detalhes sensíveis de segurança.
