(function () {
'use strict';

// Tela "Base de Conhecimento": categorias e assuntos vindos de database.json.
const { $, registerActions } = App.ui;
const { setupAutocomplete } = App.search;
const { escapeHtml, highlightMatch, normalizeString } = App.utils;
const { icon } = App.icons;

let categories = [];
let suggestions = [];
let isLoaded = false;

const els = {};

function renderCategory(category, term) {
    const expanded = term.length > 0 ? true : Boolean(category.expanded);
    const subjects = category.subjectsToDisplay || category.subjects;

    const subjectsHtml = subjects.length > 0
        ? subjects.map((subject) => `
            <li class="flex items-center justify-between text-text-high ml-2 p-1 rounded-md">
                <span class="truncate pr-2">${highlightMatch(subject.name, term)}</span>
            </li>`).join('')
        : '<li class="text-text-muted text-sm ml-2">Nenhum assunto nesta categoria.</li>';

    const element = document.createElement('div');
    element.className = 'panel rounded-lg';
    element.innerHTML = `
        <div class="group flex items-center justify-between p-4 cursor-pointer category-header"
             role="button" tabindex="0" aria-expanded="${expanded}"
             data-action="toggle-base-category" data-id="${escapeHtml(category.id)}">
            <h3 class="text-lg font-semibold truncate pr-2">${highlightMatch(category.name, term)}</h3>
            <div class="flex items-center gap-3">
                ${icon('chevron', `w-6 h-6 text-text-muted transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`)}
            </div>
        </div>
        <div class="subject-list ${expanded ? 'expanded' : ''}">
            <div><div class="p-4 border-t" style="border-color: var(--border-subtle);"><ul class="space-y-1 mb-4">${subjectsHtml}</ul></div></div>
        </div>`;
    return element;
}

function render(list) {
    const term = els.input.value.trim();
    els.container.replaceChildren();

    if (list.length === 0) {
        const message = term ? `Nenhum resultado encontrado para "${escapeHtml(term)}".` : 'A base de conhecimento está vazia.';
        els.container.innerHTML = `<div class="text-center text-text-muted py-10">${message}</div>`;
        return;
    }
    list.forEach((category) => els.container.appendChild(renderCategory(category, term)));
}

function applySearch() {
    if (!isLoaded) return;
    const term = normalizeString(els.input.value.trim());

    if (!term) {
        render(categories.map((category) => ({ ...category, subjectsToDisplay: category.subjects })));
        return;
    }

    const results = categories.flatMap((category) => {
        if (normalizeString(category.name).includes(term)) return [{ ...category, subjectsToDisplay: category.subjects }];
        const matching = category.subjects.filter((subject) => normalizeString(subject.name).includes(term));
        return matching.length > 0 ? [{ ...category, subjectsToDisplay: matching }] : [];
    });
    render(results);
}

async function loadBase() {
    els.container.classList.add('loading');
    try {
        const response = await fetch('./database.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        categories = await response.json();

        const unique = new Set();
        categories.forEach((category) => {
            unique.add(category.name);
            category.subjects.forEach((subject) => unique.add(subject.name));
        });
        suggestions = [...unique];

        isLoaded = true;
        applySearch();
    } catch (error) {
        console.error('Erro ao carregar a base de conhecimento', error);
        const isLocalFile = location.protocol === 'file:';
        els.container.innerHTML = `<div class="text-center text-text-muted py-10">
            <p>Não foi possível carregar a base de conhecimento.</p>
            ${isLocalFile ? '<p class="text-xs mt-1">O navegador não deixa ler o <code>database.json</code> quando o site é aberto direto do disco (arquivo local). Publique o site ou, para testar, rode <code>python -m http.server</code> nesta pasta e abra <code>http://localhost:8000</code>.</p>' : ''}
        </div>`;
    } finally {
        els.container.classList.remove('loading');
    }
}

function initBase() {
    els.input = $('baseSearchInput');
    els.container = $('baseCategoriesContainer');

    setupAutocomplete({
        input: els.input,
        container: $('baseSuggestionsContainer'),
        getSuggestions: () => suggestions,
        onSearch: applySearch
    });

    registerActions({
        'toggle-base-category': (header) => {
            const category = categories.find((item) => String(item.id) === header.dataset.id);
            if (!category) return;
            category.expanded = !category.expanded;
            header.setAttribute('aria-expanded', String(category.expanded));
            header.nextElementSibling?.classList.toggle('expanded');
            header.querySelector('svg')?.classList.toggle('rotate-180');
        }
    });
}

App.base = { loadBase, initBase };
})();
