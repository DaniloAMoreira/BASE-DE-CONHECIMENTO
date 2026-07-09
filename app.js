/* ══════════════════════════════════════
   BASE DE CONHECIMENTO — app.js.
   Compatível com GitHub Pages (JS puro)
══════════════════════════════════════ */

'use strict';

// ── Utilitários ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const norm = s => (s || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const hl = (text, term) => {
  if (!term || !text) return text;
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return text.replace(rx, m => `<mark>${m}</mark>`);
};

// ── Estado global ─────────────────────────────────────────
const state = {
  categories: [],
  suggestions: [],
  activeIdx: -1,
  loaded: false,
  maxSubjectsAny: 1,   // Para calcular a barra de progresso
};

// ── Referências DOM ───────────────────────────────────────
const els = {
  searchInput: $('searchInput'),
  clearBtn: $('clearBtn'),
  sugBox: $('suggestionsBox'),
  container: $('categoriesContainer'),
  statCats: $('statCats'),
  statSubs: $('statSubs'),
  resultLabel: $('resultLabel'),
  modal: $('modal'),
  modalMsg: $('modalMsg'),
  modalOk: $('modalOk'),
  themeBtn: $('themeBtn'),
  iconSun: $('iconSun'),
  iconMoon: $('iconMoon'),
};

// ── TEMA ──────────────────────────────────────────────────
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('kb-theme', t);
  els.iconSun.classList.toggle('hidden', t === 'dark');
  els.iconMoon.classList.toggle('hidden', t === 'light');
}

els.themeBtn.addEventListener('click', () => {
  const current = document.documentElement.dataset.theme;
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

applyTheme(localStorage.getItem('kb-theme') || 'dark');

// ── MODAL ─────────────────────────────────────────────────
const showModal = msg => { els.modalMsg.textContent = msg; els.modal.classList.add('open'); };
const hideModal = () => els.modal.classList.remove('open');
els.modalOk.addEventListener('click', hideModal);
els.modal.addEventListener('click', e => { if (e.target === els.modal) hideModal(); });

// ── KEYBOARD SHORTCUT (Ctrl+K / Cmd+K) ───────────────────
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    els.searchInput.focus();
    els.searchInput.select();
  }
  if (e.key === 'Escape' && document.activeElement === els.searchInput) {
    els.searchInput.blur();
    closeSuggestions();
  }
});

// ── WEBGL BACKGROUND ─────────────────────────────────────
(function initWebGL() {
  if (typeof THREE === 'undefined') return;

  const canvas = $('webgl-bg');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 3000);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);

  // Partículas principais
  const pts1 = buildPoints(1200, 2400, 1.4, 0x6b9fff, 0.32);
  // Partículas secundárias (teal)
  const pts2 = buildPoints(400, 1600, 2.2, 0x4fd9c8, 0.16);
  // Partículas de destaque (purple)
  const pts3 = buildPoints(120, 1000, 3.5, 0xa78bfa, 0.12);

  scene.add(pts1, pts2, pts3);
  camera.position.z = 1000;

  let mx = 0, my = 0;
  document.addEventListener('mousemove', e => {
    mx = (e.clientX / innerWidth - 0.5) * 0.5;
    my = (e.clientY / innerHeight - 0.5) * 0.5;
  });

  (function animate() {
    requestAnimationFrame(animate);
    pts1.rotation.y += 0.00025 + mx * 0.0007;
    pts1.rotation.x += 0.00010 + my * 0.0007;
    pts2.rotation.y -= 0.00040;
    pts2.rotation.z += 0.00020;
    pts3.rotation.x += 0.00060;
    pts3.rotation.y -= 0.00030;
    renderer.render(scene, camera);
  })();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  function buildPoints(count, spread, size, color, opacity) {
    const verts = [];
    for (let i = 0; i < count; i++) {
      verts.push(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const mat = new THREE.PointsMaterial({ size, color, transparent: true, opacity });
    return new THREE.Points(geo, mat);
  }
})();

// ── SKELETONS ─────────────────────────────────────────────
function showSkeletons(n = 7) {
  els.container.innerHTML = Array.from({ length: n }, () =>
    `<div class="skeleton"></div>`
  ).join('');
}

// ── CARREGAR DADOS ────────────────────────────────────────
async function loadData() {
  showSkeletons();
  try {
    const res = await fetch('./database.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.categories = await res.json();

    // Construir sugestões + calcular max subjects
    const set = new Set();
    let totalSubs = 0;
    state.maxSubjectsAny = 1;

    state.categories.forEach(cat => {
      set.add(cat.name);
      if (cat.subjects.length > state.maxSubjectsAny)
        state.maxSubjectsAny = cat.subjects.length;
      cat.subjects.forEach(s => { set.add(s.name); totalSubs++; });
    });

    state.suggestions = [...set];
    els.statCats.textContent = state.categories.length;
    els.statSubs.textContent = totalSubs;
    state.loaded = true;
    render(state.categories);

  } catch (err) {
    els.container.innerHTML = '';
    showModal(
      'Não foi possível carregar a base de conhecimento.\n\n' +
      'Verifique se o arquivo database.json está na mesma pasta e tente novamente.'
    );
  }
}

// ── SUGESTÕES ─────────────────────────────────────────────
function renderSuggestions(list) {
  if (!list.length) { closeSuggestions(); return; }

  els.sugBox.innerHTML = list.map(s => {
    // Detectar se é categoria ou assunto
    const isCat = state.categories.some(c => c.name === s);
    return `
      <div class="sug-item" data-value="${s.replace(/"/g, '&quot;')}">
        <svg class="sug-ico" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span>${s}</span>
        <span class="sug-type">${isCat ? 'categoria' : 'assunto'}</span>
      </div>`;
  }).join('');

  els.sugBox.classList.add('open');
  state.activeIdx = -1;

  els.sugBox.querySelectorAll('.sug-item').forEach(el => {
    el.addEventListener('click', () => {
      els.searchInput.value = el.dataset.value;
      closeSuggestions();
      handleSearch();
    });
  });
}

function closeSuggestions() {
  els.sugBox.classList.remove('open');
  els.sugBox.innerHTML = '';
  state.activeIdx = -1;
}

// ── RENDER CATEGORIAS ─────────────────────────────────────
function render(data = []) {
  const term = norm(els.searchInput.value.trim());
  els.container.innerHTML = '';

  if (!data.length) {
    const rawVal = els.searchInput.value.trim();
    els.container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <h3>${rawVal ? 'Sem resultados' : 'Base vazia'}</h3>
        <p>${rawVal
        ? `Nenhum resultado para <strong>"${rawVal}"</strong>.<br>Tente outros termos de busca.`
        : 'O arquivo database.json está vazio ou não foi encontrado.'}</p>
      </div>`;
    return;
  }

  const frag = document.createDocumentFragment();

  data.forEach((cat, i) => {
    const subjects = cat.subjectsToDisplay || cat.subjects;
    const isOpen = cat.expanded || false;
    const stripeIdx = i % 8;
    const progress = Math.round((subjects.length / state.maxSubjectsAny) * 100);

    const card = document.createElement('div');
    card.className = `category-card${isOpen ? ' is-open' : ''}`;
    card.dataset.id = cat.id;

    const subsHTML = subjects.length
      ? subjects.map(sub => `
          <div class="subject-item">
            <div class="sub-dot"></div>
            <span class="sub-name">${hl(sub.name, term)}</span>
          </div>`).join('') +
      `<div class="subjects-footer">
           <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
             <circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/>
           </svg>
           ${subjects.length} assunto${subjects.length !== 1 ? 's' : ''} nesta categoria
         </div>`
      : `<p class="subjects-empty">Nenhum assunto cadastrado.</p>`;

    card.innerHTML = `
      <div class="cat-header" role="button" aria-expanded="${isOpen}" tabindex="0">
        <div class="cat-left">
          <div class="cat-stripe s${stripeIdx}"></div>
          <div class="cat-info">
            <span class="cat-idx">${String(i + 1).padStart(2, '0')} · ${String(data.length).padStart(2, '0')}</span>
            <span class="cat-name">${hl(cat.name, term)}</span>
          </div>
          <div class="cat-progress" title="${subjects.length} assuntos">
            <div class="cat-progress-fill" style="width:${progress}%"></div>
          </div>
        </div>
        <div class="cat-right">
          <span class="cat-count">${subjects.length} assunto${subjects.length !== 1 ? 's' : ''}</span>
          <svg class="cat-chevron" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </div>
      </div>
      <div class="subjects-panel${isOpen ? ' open' : ''}">
        <div class="subjects-inner">
          <div class="subjects-list">${subsHTML}</div>
        </div>
      </div>`;

    // Toggle ao clicar no header
    const header = card.querySelector('.cat-header');
    const toggle = () => {
      const catObj = state.categories.find(c => c.id === cat.id);
      if (catObj) { catObj.expanded = !catObj.expanded; handleSearch(); }
    };
    header.addEventListener('click', toggle);
    // Suporte a teclado (Enter/Space)
    header.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });

    frag.appendChild(card);
  });

  els.container.appendChild(frag);
}

// ── BUSCA ─────────────────────────────────────────────────
function handleSearch() {
  if (!state.loaded) return;

  const rawTerm = els.searchInput.value.trim();
  const term = norm(rawTerm);
  els.clearBtn.style.display = term ? 'flex' : 'none';

  if (!term) {
    els.resultLabel.classList.remove('visible');
    render(state.categories.map(c => ({ ...c, subjectsToDisplay: c.subjects })));
    return;
  }

  const results = state.categories.map(cat => {
    const catMatch = norm(cat.name).includes(term);
    const subs = cat.subjects.filter(s => norm(s.name).includes(term));
    if (catMatch) return { ...cat, subjectsToDisplay: cat.subjects, expanded: true };
    if (subs.length) return { ...cat, subjectsToDisplay: subs, expanded: true };
    return null;
  }).filter(Boolean);

  const totalFound = results.reduce((a, c) => a + (c.subjectsToDisplay || []).length, 0);
  els.resultLabel.innerHTML =
    `<svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
     <span>${results.length}</span> categoria${results.length !== 1 ? 's' : ''} ·
     <span>${totalFound}</span> assunto${totalFound !== 1 ? 's' : ''} encontrado${totalFound !== 1 ? 's' : ''}`;
  els.resultLabel.classList.add('visible');
  render(results);
}

// ── EVENTOS DE INPUT ──────────────────────────────────────
els.searchInput.addEventListener('input', () => {
  handleSearch();
  const val = els.searchInput.value.trim();
  if (!val) { closeSuggestions(); return; }
  const nv = norm(val);
  const filtered = state.suggestions
    .filter(s => norm(s).includes(nv) && norm(s) !== nv)
    .slice(0, 7);
  renderSuggestions(filtered);
});

els.searchInput.addEventListener('keydown', e => {
  const items = els.sugBox.querySelectorAll('.sug-item');
  if (!els.sugBox.classList.contains('open') || !items.length) {
    if (e.key === 'Enter') { closeSuggestions(); handleSearch(); }
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    state.activeIdx = (state.activeIdx + 1) % items.length;
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    state.activeIdx = (state.activeIdx - 1 + items.length) % items.length;
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (state.activeIdx > -1) items[state.activeIdx].click();
    else { closeSuggestions(); handleSearch(); }
    return;
  } else if (e.key === 'Escape') {
    closeSuggestions(); return;
  }
  items.forEach((item, i) => item.classList.toggle('active', i === state.activeIdx));
});

els.clearBtn.addEventListener('click', () => {
  els.searchInput.value = '';
  els.clearBtn.style.display = 'none';
  closeSuggestions();
  els.resultLabel.classList.remove('visible');
  render(state.categories.map(c => ({ ...c, subjectsToDisplay: c.subjects })));
  els.searchInput.focus();
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-section')) closeSuggestions();
});

// ── INIT ──────────────────────────────────────────────────
loadData();
