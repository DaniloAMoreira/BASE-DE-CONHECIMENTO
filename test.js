
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
            let isDevMode = false;
            let activeSuggestionIndex = -1;
            let isDataLoaded = false;

            
            // --- Lógica do Modal Adicionar Comando ---
            const addModal = document.getElementById('addModal');
            const openAddModalBtn = document.getElementById('openAddModalBtn');
            const cancelAddBtn = document.getElementById('cancelAddBtn');
            const saveCommandBtn = document.getElementById('saveCommandBtn');
            const commandTitleInput = document.getElementById('commandTitleInput');
            const commandTextInput = document.getElementById('commandTextInput');

            // --- Lógica para Gavetas Internas Dinâmicas (Modal) ---
            window.addSubCommandField = (name = '', text = '') => {
                const container = document.getElementById('subCommandsContainer');
                if (!container) return;
                const div = document.createElement('div');
                div.className = 'subcommand-item p-3 border border-[color:var(--panel-border)] rounded-lg mb-2 relative';
                div.innerHTML = `
                    <button onclick="this.parentElement.remove()" class="absolute top-2 right-2 text-red-500 hover:text-red-700" title="Remover Gaveta">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <label class="block text-xs font-medium text-text-muted mb-1">Nome da Gaveta Interna (Ex: Select)</label>
                    <input type="text" value="${name.replace(/"/g, '&quot;')}" class="subcommand-name w-full rounded-md px-3 py-1.5 mb-2 bg-[color:var(--color-bg)] border border-[color:var(--color-search-border)] text-text focus:outline-none focus:ring-1 focus:ring-accent text-sm">
                    <label class="block text-xs font-medium text-text-muted mb-1">Comando SQL</label>
                    <textarea rows="3" class="subcommand-text w-full rounded-md px-3 py-1.5 bg-[color:var(--color-bg)] border border-[color:var(--color-search-border)] text-text focus:outline-none focus:ring-1 focus:ring-accent font-mono text-xs">${text}</textarea>
                `;
                container.appendChild(div);
            };

            openAddModalBtn.addEventListener('click', () => {
                const senha = prompt('Digite a senha para cadastrar comandos:');
                if (senha !== 'Lcsuporteadmin') {
                    alert('Senha incorreta!');
                    return;
                }
                
                window.editingCmdId = null;
                window.editingCmdCategoryId = null; // reset category ID
                document.querySelector('#addModal h3').textContent = 'Adicionar Novo Comando';
                
                document.getElementById('commandTitleInput').value = '';
                
                const subCommandsContainer = document.getElementById('subCommandsContainer');
                if(subCommandsContainer) {
                    subCommandsContainer.innerHTML = '';
                    addSubCommandField();
                }
                
                addModal.classList.remove('hidden');
            });

            cancelAddBtn.addEventListener('click', () => {
                addModal.classList.add('hidden');
            });

            

            saveCommandBtn.addEventListener('click', async () => {
                let catId = categorySelect.value;
                let catName = newCategoryInput.value.trim();
                let title = commandTitleInput.value.trim();

                if (isNewCategory) {
                    if (!catName) return alert('Digite o nome da nova categoria');
                } else {
                    if (!catId) return alert('Selecione uma categoria');
                }
                
                const subCommandsElements = document.querySelectorAll('.subcommand-item');
                let subCommands = [];
                subCommandsElements.forEach(item => {
                    const name = item.querySelector('.subcommand-name').value.trim();
                    const text = item.querySelector('.subcommand-text').value.trim();
                    if (name || text) {
                        subCommands.push({ name: name || 'Comando', text: text });
                    }
                });

                if (subCommands.length === 0) {
                    return alert('Adicione pelo menos um subcomando (Gaveta interna).');
                }

                if (!title) {
                    title = isNewCategory ? catName : categorySelect.options[categorySelect.selectedIndex].text;
                }

                saveCommandBtn.textContent = 'Salvando...';
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

                    const commandJsonStr = JSON.stringify(subCommands);

                    let resCmd;
                    if (window.editingCmdId) {
                        resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${window.editingCmdId}`, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({ categoria_id: catId, name: title, command: commandJsonStr })
                        });
                        window.editingCmdId = null;
                    } else {
                        resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ categoria_id: catId, name: title, command: commandJsonStr })
                        });
                    }
                    if (!resCmd.ok) throw new Error('Erro ao salvar comando');

                    addModal.classList.add('hidden');
                    await loadData();
                } catch (e) {
                    alert('Ocorreu um erro ao salvar no banco de dados. ' + e.message);
                } finally {
                    saveCommandBtn.textContent = 'Salvar Comando';
                    saveCommandBtn.disabled = false;
                }
            });

            // --- MÓDULOS ---
            const ThemeSwitcher = (() => { const DOM = { body: document.body, themeToggleBtn: document.getElementById('theme-toggle-btn'), themeIconSun: document.getElementById('theme-icon-sun'), themeIconMoon: document.getElementById('theme-icon-moon') }; const STORAGE_KEY = 'themePreference'; const applyTheme = (theme) => { DOM.body.dataset.theme = theme; localStorage.setItem(STORAGE_KEY, theme); DOM.themeIconSun.classList.toggle('hidden', theme === 'dark'); DOM.themeIconMoon.classList.toggle('hidden', theme === 'light'); }; const toggleTheme = () => { const currentTheme = DOM.body.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(currentTheme); }; const init = () => { const savedTheme = localStorage.getItem(STORAGE_KEY) || 'dark'; applyTheme(savedTheme); DOM.themeToggleBtn.addEventListener('click', toggleTheme); }; return { init }; })();
            const hideModal = () => infoModal.classList.add('hidden'); 
            infoOkBtn.addEventListener('click', hideModal);
            
            const initWebGLBackground = () => { const canvas = document.getElementById('webgl-bg'); if (!canvas) return; const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); const renderer = new THREE.WebGLRenderer({ canvas, alpha: true }); renderer.setSize(window.innerWidth, window.innerHeight); renderer.setClearColor(0x000000, 0); const geometry = new THREE.BufferGeometry(); const vertices = []; for (let i = 0; i < 1000; i++) { vertices.push((Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000, (Math.random() - 0.5) * 2000); } geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); const material = new THREE.PointsMaterial({ size: 2, color: 0x06B6D4 }); const points = new THREE.Points(geometry, material); scene.add(points); camera.position.z = 1000; const animate = () => { requestAnimationFrame(animate); points.rotation.x += 0.0005; points.rotation.y += 0.001; renderer.render(scene, camera); }; animate(); window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }); };

            // --- LÓGICA DE DADOS ---
            
            window.toggleDevMenu = (btn) => {
                const menu = btn.nextElementSibling;
                document.querySelectorAll('.dev-menu').forEach(m => { if (m !== menu) m.classList.add('hidden') });
                menu.classList.toggle('hidden');
            };

            window.deleteCommand = async (cmdId) => {
                if (!confirm('Tem certeza que deseja excluir este comando?')) return;
                try {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${cmdId}`, {
                        method: 'DELETE',
                        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
                    });
                    if (!res.ok) throw new Error('Erro ao excluir');
                    await loadData();
                } catch (e) {
                    alert('Erro: ' + e.message);
                }
            };

            window.editingCmdId = null;
            window.editCommand = (cmdId) => {
                const senha = prompt('Digite a senha para editar comandos:');
                if (senha !== 'Lcsuporteadmin') {
                    alert('Senha incorreta!');
                    return;
                }

                let targetCmd = null;
                for (let cat of categories) {
                    targetCmd = cat.subjects.find(s => String(s.id) === String(cmdId));
                    if (targetCmd) break;
                }
                if (!targetCmd) return;
                
                window.editingCmdCategoryId = targetCmd.categoria_id;
                document.getElementById('commandTitleInput').value = targetCmd.name;
                
                const subCommandsContainer = document.getElementById('subCommandsContainer');
                if (subCommandsContainer) {
                    subCommandsContainer.innerHTML = '';
                    let subCmds = [];
                    try {
                        subCmds = JSON.parse(targetCmd.command);
                        if (!Array.isArray(subCmds)) throw new Error('Not array');
                    } catch(e) {
                        subCmds = [{ name: 'Comando', text: targetCmd.command || '' }];
                    }
                    
                    if (subCmds.length === 0) {
                        addSubCommandField();
                    } else {
                        subCmds.forEach(sc => addSubCommandField(sc.name, sc.text));
                    }
                }
                
                window.editingCmdId = targetCmd.id;
                document.querySelector('#addModal h3').textContent = 'Editar Comando';
                document.getElementById('addModal').classList.remove('hidden');
            };

            const loadData = async () => {
                categoriesContainer.classList.add('loading');
                try {
                    const headers = { 
                        'apikey': SUPABASE_ANON_KEY, 
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    };
                    
                    const [resCategorias, resComandos] = await Promise.all([
                        fetch(`${SUPABASE_URL}/rest/v1/categorias_comandos?select=*`, { headers }),
                        fetch(`${SUPABASE_URL}/rest/v1/comandos?select=*`, { headers })
                    ]);

                    if (!resCategorias.ok || !resComandos.ok) {
                        throw new Error('HTTP error fetching from Supabase');
                    }

                    const rawCategorias = await resCategorias.json();
                    const rawComandos = await resComandos.json();

                    categories = rawCategorias.map(cat => {
                        const comandosDaCategoria = rawComandos.filter(cmd => String(cmd.categoria_id) === String(cat.id));
                        return {
                            id: cat.id,
                            name: cat.name,
                            subjects: comandosDaCategoria
                        };
                    });
                    
                    categories.sort((a, b) => a.name.localeCompare(b.name));

                    const suggestionSet = new Set();
                    categories.forEach(cat => { 
                        suggestionSet.add(cat.name); 
                        cat.subjects.forEach(sub => suggestionSet.add(sub.name)); 
                    });
                    allSuggestions = [...suggestionSet];
                    
                    render(categories);
                    isDataLoaded = true;
                } catch (error) {
                    console.error('Erro ao carregar dados', error);
                    const infoMessage = document.getElementById('infoMessage');
                    infoMessage.textContent = 'Não foi possível carregar os comandos do banco de dados.';
                    infoModal.classList.remove('hidden');
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
                    const isExpanded = category.expanded || false;
                    const categoryElement = document.createElement('div');
                    categoryElement.className = 'panel rounded-lg';
                    const subjectsToDisplay = category.subjectsToDisplay || category.subjects;
                    
                    const subjectsHTML = subjectsToDisplay.length > 0
                        ? subjectsToDisplay.map((subject) => {
                            const isSql = subject.name.toLowerCase().endsWith('.sql');
                            let subCommands = [];
                            
                            try {
                                subCommands = JSON.parse(subject.command);
                                if(!Array.isArray(subCommands)) throw new Error('Not array');
                            } catch(e) {
                                subCommands = [{ name: 'Comando', text: subject.command || '' }];
                            }

                            const innerAccordionsHTML = subCommands.map((sc, scIdx) => {
                                const encoded = encodeURIComponent(sc.text || '');
                                let actionBtn = '';
                                
                                if (isSql) {
                                    const fileName = sc.name.endsWith('.sql') ? sc.name : sc.name + '.sql';
                                    actionBtn = `
                                    <button data-command="${encoded}" onclick="downloadFile(decodeURIComponent(this.getAttribute('data-command')), '${fileName}')" class="px-3 py-1 bg-accent text-white rounded hover:opacity-90 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0" title="Descarregar ficheiro">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download
                                    </button>`;
                                } else {
                                    actionBtn = `
                                    <div class="flex gap-2 items-center">
                                        <button data-command="${encoded}" onclick="viewCommand(decodeURIComponent(this.getAttribute('data-command')))" class="px-2 py-1 bg-surface border border-primary text-text rounded hover:bg-primary transition-colors text-xs font-semibold flex items-center justify-center shrink-0" title="Observar comando">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        </button>
                                        <div class="relative flex flex-col items-center">
                                            <button data-command="${encoded}" onclick="copyCommand(decodeURIComponent(this.getAttribute('data-command')), this)" class="px-3 py-1 bg-surface border border-primary text-text rounded hover:bg-primary transition-colors text-xs font-semibold flex items-center gap-1 shrink-0" title="Copiar">
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg> Copiar
                                            </button>
                                        </div>
                                    </div>`;
                                }

                                return `
                                    <div class="inner-accordion panel bg-black/20 rounded-md mt-2 overflow-hidden border border-[color:var(--panel-border)]">
                                        <div class="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors" onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('svg').classList.toggle('rotate-180');">
                                            <span class="text-sm font-medium text-text">${highlightMatch(sc.name, searchTerm)}</span>
                                            <svg class="w-5 h-5 text-text-muted transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                        <div class="hidden p-3 border-t border-[color:var(--panel-border)]">
                                            <div class="flex justify-between items-start gap-4">
                                                <pre class="text-xs text-text-muted whitespace-pre-wrap flex-grow font-mono max-h-40 overflow-y-auto custom-scrollbar p-2 bg-[color:var(--color-surface)] rounded">${sc.text}</pre>
                                                ${actionBtn}
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('');

                            return `
                            <div class="panel border border-[color:var(--panel-border)] rounded-md mb-3 bg-white/5">
                                <div class="flex items-center justify-between p-3 cursor-pointer group hover:bg-white/10 transition-colors" onclick="if(event.target.closest('.action-buttons')) return; this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.cmd-chevron').classList.toggle('rotate-180');">
                                    <div class="flex flex-col">
                                        <span class="font-semibold text-text">${highlightMatch(subject.name, searchTerm)}</span>
                                    </div>
                                    <div class="flex items-center gap-2 action-buttons">
                                        <div class="relative dev-menu hidden">
                                            <div class="absolute right-0 mt-2 w-32 bg-surface border border-primary/50 rounded-lg shadow-xl z-50 flex flex-col py-1 overflow-hidden">
                                                <button onclick="editCommand('${subject.id}')" class="px-4 py-2 text-sm text-left hover:bg-primary transition-colors flex items-center gap-2 text-blue-400">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar
                                                </button>
                                                <button onclick="deleteCommand('${subject.id}')" class="px-4 py-2 text-sm text-left hover:bg-primary transition-colors flex items-center gap-2 text-red-400">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir
                                                </button>
                                            </div>
                                        </div>
                                        <button onclick="event.stopPropagation(); toggleDevMenu(this)" class="p-1 hover:bg-primary rounded transition-colors text-text-muted" title="Opções">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                        </button>
                                        <svg class="cmd-chevron w-5 h-5 text-text-muted transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                                <div class="hidden p-3 pt-0 border-t border-[color:var(--panel-border)] bg-[color:var(--color-bg)] rounded-b-md">
                                    ${innerAccordionsHTML}
                                </div>
                            </div>
                            `;
                        }).join('')
                        : '<div class="text-text-muted text-sm ml-2">Nenhum comando nesta categoria.</div>';

                    categoryElement.innerHTML = `
                        <div class="group flex items-center justify-between p-4 cursor-pointer category-header" data-id="${category.id}">
                            <h3 class="text-lg font-semibold truncate pr-2">${highlightMatch(category.name, searchTerm)}</h3>
                            <div class="flex items-center gap-3">
                                <svg class="w-6 h-6 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        <div class="subject-list ${isExpanded ? 'expanded' : ''}">
                            <div><div class="p-4 border-t" style="border-color: var(--panel-border);"><div class="space-y-2 mb-4">${subjectsHTML}</div></div></div>
                        </div>`;
                    categoriesContainer.appendChild(categoryElement);
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
                    if (e.key === 'Enter') {
                        const val = searchInput.value.trim().toLowerCase();
                        if (val === 'admin') {
                            e.preventDefault();
                            isDevMode = !isDevMode;
                            searchInput.value = '';
                            suggestionsContainer.classList.remove('expanded');
                            render(categories);
                            return;
                        }
                    }
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
                    if (!e.target.closest('.dev-menu') && !e.target.closest('button[onclick*="toggleDevMenu"]')) {
                        document.querySelectorAll('.dev-menu').forEach(m => m.classList.add('hidden'));
                    }
                    if (!e.target.closest('header')) {
                        suggestionsContainer.classList.remove('expanded');
                    }
                });

                loadData();
            };

            initializeApp();
        });
    