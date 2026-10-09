(function () {
'use strict';

// Card com "gavetas" (abas) usado nas telas de Comandos e Arquivos.
const { registerActions } = App.ui;
const { icon } = App.icons;

const TAB_BASE = 'px-4 py-2 rounded-t-md rounded-b-none text-sm font-medium transition-colors border shrink-0';
const TAB_ACTIVE = `${TAB_BASE} bg-bg-panel-active text-text-high border-border-element border-b-0 z-10 relative`;
const TAB_INACTIVE = `${TAB_BASE} bg-transparent border-border-element text-text-muted hover:bg-bg-panel hover:text-text-high`;

/**
 * Monta um card recolhível.
 * @param {object} options
 * @param {string} options.titleHtml    HTML já escapado do título
 * @param {boolean} [options.accentBar] barra laranja lateral (ex.: exige backup)
 * @param {string} [options.actionsHtml] botões do lado direito do cabeçalho
 * @param {{labelHtml: string, panelHtml: string}[]} options.tabs  uma entrada por gaveta
 * @param {boolean} [options.expanded]
 * @param {boolean} [options.hideTabs]  esconde a barra de abas (card com uma única gaveta)
 * @param {string} [options.overlayHtml]  camada translúcida atrás do texto do cabeçalho (ex.: barra de progresso)
 */
function buildCard({ titleHtml, accentBar = false, actionsHtml = '', tabs, expanded = false, hideTabs = false, overlayHtml = '' }) {
    const tabsHtml = tabs.map((tab, index) => `
        <button type="button" data-tab data-action="switch-tab" data-index="${index}"
                class="${index === 0 ? TAB_ACTIVE : TAB_INACTIVE}" style="margin-bottom: -1px;">${tab.labelHtml}</button>`).join('');

    const panelsHtml = tabs.map((tab, index) => `
        <div data-panel class="${index === 0 ? '' : 'hidden'}">${tab.panelHtml}</div>`).join('');

    const element = document.createElement('div');
    element.dataset.card = '';
    element.innerHTML = `
        <div class="panel border border-border-subtle rounded-md mb-3 bg-white/5 overflow-hidden">
            <div class="relative flex items-center justify-between p-3 cursor-pointer group hover:bg-white/10 transition-colors"
                 role="button" tabindex="0" aria-expanded="${expanded}" data-action="toggle-card">
                ${overlayHtml}
                ${accentBar ? '<div class="absolute left-0 top-0 bottom-0 w-1 bg-orange-500 z-10"></div>' : ''}
                <div class="relative z-10 flex flex-col">
                    <span class="font-semibold text-text-high">${titleHtml}</span>
                </div>
                <div class="relative z-10 flex items-center gap-4 action-buttons">
                    ${actionsHtml}
                    ${icon('chevron', `card-chevron w-5 h-5 text-text-muted transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`)}
                </div>
            </div>
            <div data-card-body class="${expanded ? '' : 'hidden'} pt-0 border-t border-border-subtle bg-[color:var(--bg-app)] rounded-b-md">
                ${hideTabs ? '' : `<div class="flex overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden gap-1 pt-3 px-3 border-b border-border-element">${tabsHtml}</div>`}
                <div class="panels-container p-3 bg-bg-panel-active rounded-b-md">${panelsHtml}</div>
            </div>
        </div>`;
    return element;
}

function resetPreviews(scope) {
    scope.querySelectorAll('[data-preview], [data-expand-overlay]').forEach((el) => el.classList.remove('hidden'));
    scope.querySelectorAll('[data-full]').forEach((el) => el.classList.add('hidden'));
}

function initCards() {
    registerActions({
        'toggle-card': (header) => {
            const body = header.parentElement.querySelector('[data-card-body]');
            const collapsed = body.classList.toggle('hidden');
            header.setAttribute('aria-expanded', String(!collapsed));
            header.querySelector('.card-chevron')?.classList.toggle('rotate-180', !collapsed);
            if (collapsed) resetPreviews(body);
        },

        'switch-tab': (button) => {
            const card = button.closest('[data-card]');
            const index = Number(button.dataset.index);
            card.querySelectorAll('[data-panel]').forEach((panel, i) => panel.classList.toggle('hidden', i !== index));
            card.querySelectorAll('[data-tab]').forEach((tab, i) => { tab.className = i === index ? TAB_ACTIVE : TAB_INACTIVE; });
        },

        'expand-preview': (button) => {
            const box = button.closest('[data-preview-box]');
            box.querySelector('[data-preview]').classList.add('hidden');
            box.querySelector('[data-expand-overlay]').classList.add('hidden');
            box.querySelector('[data-full]').classList.remove('hidden');
        }
    });
}

App.cards = { buildCard, initCards };
})();
