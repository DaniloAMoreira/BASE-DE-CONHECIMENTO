
        // Função para visualizar
        window.viewCommand = (text) => {
            const infoModal = document.getElementById('infoModal');
            const infoMessage = document.getElementById('infoMessage');

            infoMessage.style.whiteSpace = 'pre-wrap';
            infoMessage.style.wordBreak = 'break-word';
            infoMessage.style.fontFamily = 'monospace';

            infoMessage.textContent = text || 'Aviso: Comando vazio ou não encontrado no JSON.';
            infoModal.classList.remove('hidden');
        };

        // Função para download virtual
        window.downloadFile = (text, fileName) => {
            if (!text || text === 'undefined' || text.trim() === '') {
                const infoModal = document.getElementById('infoModal');
                const infoMessage = document.getElementById('infoMessage');
                infoMessage.style.whiteSpace = 'pre-wrap';
                infoMessage.style.fontFamily = 'monospace';
                infoMessage.textContent = 'Aviso: O comando está vazio no JSON. \nInsira o código correspondente no arquivo comandos.json na propriedade "command" para poder efetuar o download.';
                infoModal.classList.remove('hidden');
                return;
            }

            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        };

        // Função para copiar com plano B
        window.copyCommand = (text, btnElement) => {
            const showNotification = () => {
                if (btnElement && btnElement.nextElementSibling && btnElement.nextElementSibling.classList.contains('copy-notification')) {
                    btnElement.nextElementSibling.remove();
                }
                if (btnElement) {
                    const notif = document.createElement('div');
                    notif.className = 'copy-notification absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 bg-green-600 text-white text-[10px] rounded shadow-lg whitespace-nowrap z-50 pointer-events-none transition-opacity duration-300';
                    notif.textContent = 'Copiado!';
                    btnElement.parentNode.appendChild(notif);

                    setTimeout(() => {
                        if (notif.parentNode) {
                            notif.style.opacity = '0';
                            setTimeout(() => {
                                if (notif.parentNode) notif.remove();
                            }, 300);
                        }
                    }, 1500);
                }
            };

            const fallbackCopy = (textToCopy) => {
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy || '';
                textArea.style.position = "fixed";
                textArea.style.top = "0";
                textArea.style.left = "0";
                textArea.style.opacity = "0";

                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();

                try {
                    const successful = document.execCommand('copy');
                    if (successful) showNotification();
                    else alert('Erro: Não foi possível copiar o comando.');
                } catch (err) {
                    console.error('Erro no fallback de cópia', err);
                }

                document.body.removeChild(textArea);
            };

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text || '').then(() => {
                    showNotification();
                }).catch(err => {
                    fallbackCopy(text);
                });
            } else {
                fallbackCopy(text);
            }
        };

        document.addEventListener('DOMContentLoaded', () => {
            // --- Elementos do DOM ---
            const searchInput = document.getElementById('searchInput');
            const categoriesContainer = document.getElementById('categoriesContainer');
            const suggestionsContainer = document.getElementById('suggestionsContainer');
            const infoModal = document.getElementById('infoModal');
            const infoOkBtn = document.getElementById('infoOkBtn');

            // --- Variáveis de Estado ---
            let categories = [];
            let allSuggestions = [];
            let activeSuggestionIndex = -1;
            let isDataLoaded = false;

            
            // --- Lógica do Modal Adicionar Comando ---
            const addModal = document.getElementById('addModal');
            const openAddModalBtn = document.getElementById('openAddModalBtn');
            const cancelAddBtn = document.getElementById('cancelAddBtn');
            const saveCommandBtn = document.getElementById('saveCommandBtn');
            const categorySelect = document.getElementById('categorySelect');
            const toggleNewCategoryBtn = document.getElementById('toggleNewCategoryBtn');
            const newCategoryInput = document.getElementById('newCategoryInput');
            const commandTitleInput = document.getElementById('commandTitleInput');
            const commandTextInput = document.getElementById('commandTextInput');

            let isNewCategory = false;

            openAddModalBtn.addEventListener('click', () => {
                // Populate categories
                categorySelect.innerHTML = '<option value="">Selecione a categoria...</option>';
                categories.forEach(cat => {
                    const opt = document.createElement('option');
                    opt.value = cat.id;
                    opt.textContent = cat.name;
                    categorySelect.appendChild(opt);
                });
                
                isNewCategory = false;
                categorySelect.classList.remove('hidden');
                newCategoryInput.classList.add('hidden');
                newCategoryInput.value = '';
                commandTitleInput.value = '';
                commandTextInput.value = '';
                
                addModal.classList.remove('hidden');
            });

            cancelAddBtn.addEventListener('click', () => {
                addModal.classList.add('hidden');
            });

            toggleNewCategoryBtn.addEventListener('click', () => {
                isNewCategory = !isNewCategory;
                if (isNewCategory) {
                    categorySelect.classList.add('hidden');
                    newCategoryInput.classList.remove('hidden');
                    newCategoryInput.focus();
                    toggleNewCategoryBtn.textContent = "Cancelar Novo";
                } else {
                    categorySelect.classList.remove('hidden');
                    newCategoryInput.classList.add('hidden');
                    toggleNewCategoryBtn.textContent = "Novo";
                }
            });

            saveCommandBtn.addEventListener('click', async () => {
                let catId = categorySelect.value;
                let catName = newCategoryInput.value.trim();
                let title = commandTitleInput.value.trim();
                let text = commandTextInput.value.trim();

                if (isNewCategory) {
                    if (!catName) return alert('Digite o nome da nova categoria');
                } else {
                    if (!catId) return alert('Selecione uma categoria');
                }

                if (!text) return alert('Digite o comando SQL');
                
                // Se não digitou título, usa a categoria (ou .sql se preferir)
                if (!title) {
                    title = isNewCategory ? catName : categorySelect.options[categorySelect.selectedIndex].text;
                }

                saveCommandBtn.textContent = "Salvando...";
                saveCommandBtn.disabled = true;

                try {
                    const headers = { 
                        'apikey': SUPABASE_ANON_KEY, 
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    };

                    if (isNewCategory) {
                        const resCat = await fetch(`${SUPABASE_URL}/rest/v1/categorias_comandos`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ name: catName })
                        });
                        if (!resCat.ok) throw new Error('Erro ao salvar categoria');
                        const dataCat = await resCat.json();
                        catId = dataCat[0].id;
                    }

                    const resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ categoria_id: catId, name: title, command: text })
                    });
                    if (!resCmd.ok) throw new Error('Erro ao salvar comando');

                    addModal.classList.add('hidden');
                    await loadData(); // Reload UI
                } catch (e) {
                    alert('Ocorreu um erro ao salvar no banco de dados. ' + e.message);
                } finally {
                    saveCommandBtn.textContent = "Salvar Comando";
                    saveCommandBtn.disabled = false;
                }
            });

            // --- MÓDULOS ---
            const ThemeSwitcher = (() => { const DOM = { body: document.body, themeToggleBtn: document.getElementById('theme-toggle-btn'), themeIconSun: document.getElementById('theme-icon-sun'), themeIconMoon: document.getElementById('theme-icon-moon') }; const STORAGE_KEY = 'themePreference'; const applyTheme = (theme) => { DOM.body.dataset.theme = theme; localStorage.setItem(STORAGE_KEY, theme); DOM.themeIconSun.classList.toggle('hidden', theme === 'dark'); DOM.themeIconMoon.classList.toggle('hidden', theme === 'light'); }; const toggleTheme = () => { const currentTheme = DOM.body.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(currentTheme); }; const init = () => { const savedTheme = localStorage.getItem(STORAGE_KEY) || 'dark'; applyTheme(savedTheme); DOM.themeToggleBtn.addEventListener('click', toggleTheme); }; return { init }; })();
            const hideModal = () => infoModal.classList.add('hidden'); 
            infoOkBtn.addEventListener('click', hideModal);
            
            const initWebGLBackground = () => { const canvas = document.getElementById('webgl-bg'); if (!canvas) return; const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); const renderer = new THREE.WebGLRenderer({ canvas, alpha: true }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setClearColor(0x000000, 0); const geometry = new THREE.BufferGeometry(); const vertices = []; for (let i = 0; i < 1000; i++) { vertices.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000); } geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); const material = new THREE.PointsMaterial({ size: 2, color: 0x06B6D4 }); const points = new THREE.Points(geometry, material); scene.add(points); camera.position.z = 1000; const animate = () => { requestAnimationFrame(animate); points.rotation.x += 0.0005; points.rotation.y += 0.001; renderer.render(scene, camera); }; animate(); window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }); };

            // --- LÓGICA DE DADOS ---
            const SUPABASE_URL = 'https://jqllbwlfikckavipqtfr.supabase.co';
            const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxbGxid2xmaWtja2F2aXBxdGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzczMDQsImV4cCI6MjA5ODA1MzMwNH0.adNqWBWMY3PlIx_0OG1bMswbVR_TThtCmNWFptxkgRU';

            const loadData = async () => {
                categoriesContainer.classList.add('loading');
                try {
                    const headers = { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` };
                    const [resCat, resCmd] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/categorias_comandos?select=*`, { headers }),
                        fetch(`${SUPABASE_URL}/rest/v1/comandos?select=*`, { headers })
                    ]);
                    if (!resCat.ok || !resCmd.ok) throw new Error(`HTTP error from Supabase!`);
                    
                    const categoriasData = await resCat.json();
                    const comandosData = await resCmd.json();
                    
                    categories = categoriasData.map(cat => ({
                        id: cat.id,
                        name: cat.name,
                        subjects: comandosData.filter(cmd => cmd.categoria_id === cat.id).map(cmd => ({
                            name: cmd.name,
                            command: cmd.command
                        }))
                    }));

                    const suggestionSet = new Set();
                    categories.forEach(cat => { suggestionSet.add(cat.name); cat.subjects.forEach(sub => suggestionSet.add(sub.name)); });
                    allSuggestions = [...suggestionSet];
                    render(categories);
                    isDataLoaded = true;
                } catch (error) {
                    console.error("Erro ao carregar dados", error);
                } finally {
                    categoriesContainer.classList.remove('loading');
                }
            };

            const normalizeString = (str) => {
                if (!str) return '';
                return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]|-/g, '');
            };

            const highlightMatch = (text, searchTerm) => {
                if (!searchTerm || !text) return text;
                const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedTerm, 'gi');
                return text.replace(regex, (match) => `<mark class="bg-transparent text-blue-400 font-semibold not-italic">${match}</mark>`);
            };

            const renderSuggestions = (suggestions) => {
                suggestionsContainer.innerHTML = '<div></div>';
                if (suggestions.length === 0) {
                    suggestionsContainer.classList.remove('expanded');
                    return;
                }
                const wrapper = suggestionsContainer.querySelector('div');
                suggestions.forEach((suggestionText) => {
                    const item = document.createElement('div');
                    item.className = 'suggestion-item flex items-center gap-x-3';
                    const neuralIconSVG = `
                        <svg class="w-5 h-5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <circle class="neural-dot neural-dot-1" cx="4" cy="12" r="3"/>
                            <circle class="neural-dot neural-dot-2" cx="12" cy="12" r="3"/>
                            <circle class="neural-dot neural-dot-3" cx="20" cy="12" r="3"/>
                        </svg>
                    `;
                    item.innerHTML = `${neuralIconSVG}<span>${suggestionText}</span>`;
                    item.addEventListener('click', () => {
                        searchInput.value = suggestionText;
                        suggestionsContainer.classList.remove('expanded');
                        handleSearch();
                    });
                    wrapper.appendChild(item);
                });
                suggestionsContainer.classList.add('expanded');
                activeSuggestionIndex = -1;
            };

            const handleAutocomplete = () => {
                if (!isDataLoaded) return;
                handleSearch();
                const searchTerm = searchInput.value.trim();
                if (searchTerm.length < 1) {
                    suggestionsContainer.classList.remove('expanded');
                    return;
                }
                const normalizedSearchTerm = normalizeString(searchTerm);
                const filteredSuggestions = allSuggestions.filter(s => normalizeString(s).includes(normalizedSearchTerm)).slice(0, 4);
                renderSuggestions(filteredSuggestions);
            };

            // --- FUNÇÕES DE RENDERIZAÇÃO E BUSCA PRINCIPAL ---
            const render = (dataToRender = []) => {
                const searchTerm = searchInput.value.trim();
                categoriesContainer.innerHTML = '';
                if (dataToRender.length === 0) {
                    const message = searchTerm ? `Nenhum resultado encontrado para "${searchTerm}".` : "A lista de comandos está vazia.";
                    categoriesContainer.innerHTML = `<div class="text-center text-text-muted py-10">${message}</div>`;
                    return;
                }
                dataToRender.forEach(category => {
                    const subjectsToDisplay = category.subjectsToDisplay || category.subjects;
                    if (subjectsToDisplay.length === 0) return;

                    // Cabeçalho da Categoria
                    const catHeader = document.createElement('div');
                    catHeader.className = 'mb-2 mt-4 ml-1';
                    catHeader.innerHTML = `<h2 class="text-xl font-bold text-text-muted">${highlightMatch(category.name, searchTerm)}</h2>`;
                    categoriesContainer.appendChild(catHeader);

                    subjectsToDisplay.forEach((subject, index) => {
                        const isExpanded = subject.expanded || false; // default false
                        const encoded = encodeURIComponent(subject.command || '');
                        const subjectElement = document.createElement('div');
                        subjectElement.className = 'panel rounded-lg mb-3';

                        const isSql = subject.name.toLowerCase().endsWith('.sql');
                        let actionBtn = '';
                        if (isSql) {
                            actionBtn = `<button data-command="${encoded}" onclick="event.stopPropagation(); downloadFile(decodeURIComponent(this.getAttribute('data-command')), '${subject.name}')" class="px-3 py-1 bg-accent text-white rounded hover:opacity-90 transition-colors text-sm font-semibold flex items-center gap-1 shrink-0" title="Descarregar ficheiro">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download
                            </button>`;
                        }

                        subjectElement.innerHTML = `
                            <div class="group flex items-center justify-between p-4 cursor-pointer category-header">
                                <h3 class="text-lg font-semibold truncate pr-2 flex-grow">${highlightMatch(subject.name, searchTerm)}</h3>
                                <div class="flex items-center gap-3">
                                    <div class="relative flex flex-col items-center">
                                        <button data-command="${encoded}" onclick="event.stopPropagation(); copyCommand(decodeURIComponent(this.getAttribute('data-command')), this)" class="px-3 py-1 bg-surface border border-primary text-text rounded hover:bg-primary transition-colors text-sm font-semibold flex items-center gap-1 shrink-0" title="Copiar">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg> Copiar
                                        </button>
                                    </div>
                                    ${actionBtn}
                                    <svg class="w-6 h-6 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            <div class="subject-list ${isExpanded ? 'expanded' : ''}">
                                <div>
                                    <div class="p-4 border-t" style="border-color: var(--panel-border);">
                                        <textarea readonly class="w-full bg-[color:var(--color-search-bg)] text-text font-mono text-sm p-4 rounded-lg outline-none resize-y" rows="8" style="min-height: 100px;">${subject.command || ''}</textarea>
                                    </div>
                                </div>
                            </div>`;
                        categoriesContainer.appendChild(subjectElement);

                        const header = subjectElement.querySelector('.category-header');
                        header.addEventListener('click', () => {
                            subject.expanded = !subject.expanded;
                            render(dataToRender);
                        });
                    });
                });
            };

            const handleSearch = () => {
                if (!isDataLoaded) return;
                const searchTerm = normalizeString(searchInput.value.trim());
                if (!searchTerm) {
                    const resetData = categories.map(cat => ({ ...cat, subjectsToDisplay: cat.subjects }));
                    render(resetData);
                    return;
                }
                const searchResults = categories.map(cat => {
                    const catNameMatches = normalizeString(cat.name).includes(searchTerm);
                    const matchingSubjects = cat.subjects.filter(sub => normalizeString(sub.name).includes(searchTerm));
                    if (catNameMatches) return { ...cat, subjectsToDisplay: cat.subjects };
                    if (matchingSubjects.length > 0) return { ...cat, subjectsToDisplay: matchingSubjects };
                    return null;
                }).filter(Boolean);
                render(searchResults);
            };

            // (Listener antigo removido, agora o listener é adicionado no próprio elemento renderizado)

            // --- INICIALIZAÇÃO DA APLICAÇÃO ---
            const initializeApp = () => {
                ThemeSwitcher.init();
                initWebGLBackground();

                searchInput.addEventListener('input', handleAutocomplete);

                searchInput.addEventListener('keydown', (e) => {
                    const items = suggestionsContainer.querySelectorAll('.suggestion-item');
                    if (!suggestionsContainer.classList.contains('expanded') || items.length === 0) return;

                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                    }
                    items.forEach((item, index) => item.classList.toggle('active', index === activeSuggestionIndex));

                    if (e.key === 'Enter') {
                        e.preventDefault();
                        if (activeSuggestionIndex > -1 && items[activeSuggestionIndex]) {
                            items[activeSuggestionIndex].click();
                        } else {
                            suggestionsContainer.classList.remove('expanded');
                            handleSearch();
                        }
                    }
                });

                document.addEventListener('click', (e) => {
                    if (!e.target.closest('header')) {
                        suggestionsContainer.classList.remove('expanded');
                    }
                });

                loadData();
            };

            initializeApp();
        });
    