(function () {
'use strict';

// Autocomplete compartilhado pelas telas (Base de Conhecimento, Comandos e Arquivos).
const { normalizeString } = App.utils;

const NEURAL_ICON = `
    <svg class="w-5 h-5 text-accent-solid flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle class="neural-dot neural-dot-1" cx="4" cy="12" r="3"/>
        <circle class="neural-dot neural-dot-2" cx="12" cy="12" r="3"/>
        <circle class="neural-dot neural-dot-3" cx="20" cy="12" r="3"/>
    </svg>`;

const MAX_SUGGESTIONS = 4;

/**
 * Liga o campo de busca à lista de sugestões.
 * @param {object} options
 * @param {HTMLInputElement} options.input
 * @param {HTMLElement} options.container  elemento que recebe as sugestões
 * @param {() => string[]} options.getSuggestions  lista completa de sugestões possíveis
 * @param {() => void} options.onSearch  aplica o filtro da tela
 */
function setupAutocomplete({ input, container, getSuggestions, onSearch }) {
    let activeIndex = -1;

    const collapse = () => container.classList.remove('expanded');

    function renderSuggestions(suggestions) {
        container.innerHTML = '<div></div>';
        if (suggestions.length === 0) {
            collapse();
            return;
        }
        const wrapper = container.firstElementChild;
        suggestions.forEach((text) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item flex items-center gap-x-3';
            item.innerHTML = NEURAL_ICON;
            const label = document.createElement('span');
            label.textContent = text;
            item.appendChild(label);
            item.addEventListener('click', () => {
                input.value = text;
                collapse();
                onSearch();
            });
            wrapper.appendChild(item);
        });
        container.classList.add('expanded');
        activeIndex = -1;
    }

    input.addEventListener('input', () => {
        onSearch();
        const term = input.value.trim();
        if (!term) {
            collapse();
            return;
        }
        const normalizedTerm = normalizeString(term);
        const matches = getSuggestions()
            .filter((suggestion) => normalizeString(suggestion).includes(normalizedTerm))
            .slice(0, MAX_SUGGESTIONS);
        renderSuggestions(matches);
    });

    input.addEventListener('keydown', (event) => {
        const items = container.querySelectorAll('.suggestion-item');
        if (!container.classList.contains('expanded') || items.length === 0) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            activeIndex = (activeIndex + 1) % items.length;
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            activeIndex = (activeIndex - 1 + items.length) % items.length;
        }
        items.forEach((item, index) => item.classList.toggle('active', index === activeIndex));

        if (event.key === 'Enter') {
            event.preventDefault();
            if (items[activeIndex]) {
                items[activeIndex].click();
            } else {
                collapse();
                onSearch();
            }
        }
    });

    document.addEventListener('click', (event) => {
        if (!container.closest('header')?.contains(event.target)) collapse();
    });
}

App.search = { setupAutocomplete };
})();
