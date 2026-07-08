
        const SUPABASE_URL = 'https://jqllbwlfikckavipqtfr.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxbGxid2xmaWtja2F2aXBxdGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzczMDQsImV4cCI6MjA5ODA1MzMwNH0.adNqWBWMY3PlIx_0OG1bMswbVR_TThtCmNWFptxkgRU';

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
            let allComandos = [];
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
            window.addSubCommandField = (name = '', text = '', desc = '') => {
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
                container.prepend(div);
            };

            window.isAdminAuthenticated = false;
            let pendingAdminAction = null;
            const passwordPopover = document.getElementById('passwordPopover');
            const adminPasswordInput = document.getElementById('adminPasswordInput');
            const submitPasswordBtn = document.getElementById('submitPasswordBtn');
            const passwordError = document.getElementById('passwordError');

            window.requireAdmin = (actionCallback) => {
                if (window.isAdminAuthenticated) {
                    actionCallback();
                    return;
                }
                pendingAdminAction = actionCallback;
                passwordPopover.classList.remove('hidden');
                adminPasswordInput.value = '';
                passwordError.classList.add('hidden');
                adminPasswordInput.focus();
            };

            window.adminToken = null;

            const attemptLogin = async () => {
                const password = adminPasswordInput.value;
                if (!password) return;

                const submitBtn = document.getElementById('submitPasswordBtn');
                submitBtn.textContent = 'Verificando...';
                submitBtn.disabled = true;

                try {
                    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            email: 'admin@lcsistemas.com',
                            password: password
                        })
                    });
                    
                    const data = await res.json();
                    
                    if (data.access_token) {
                        window.adminToken = data.access_token;
                        window.isAdminAuthenticated = true;
                        passwordPopover.classList.add('hidden');
                        passwordError.classList.add('hidden');
                        if (pendingAdminAction) {
                            pendingAdminAction();
                            pendingAdminAction = null;
                        }
                    } else {
                        throw new Error('Senha incorreta');
                    }
                } catch (e) {
                    passwordError.classList.remove('hidden');
                } finally {
                    submitBtn.textContent = 'Confirmar';
                    submitBtn.disabled = false;
                }
            };

            submitPasswordBtn.addEventListener('click', attemptLogin);
            adminPasswordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') attemptLogin();
            });

            document.addEventListener('click', (e) => {
                if (!passwordPopover.contains(e.target) && !e.target.closest('#openAddModalBtn') && !e.target.closest('.edit-btn') && !e.target.closest('.delete-btn')) {
                    passwordPopover.classList.add('hidden');
                }
            });

            openAddModalBtn.addEventListener('click', () => {
                window.requireAdmin(() => {

                    window.editingCmdId = null;
                    
                    document.querySelector('#addModal h3').textContent = 'Adicionar Novo Comando';

                    document.getElementById('commandTitleInput').value = '';

                    const subCommandsContainer = document.getElementById('subCommandsContainer');
                    if (subCommandsContainer) {
                        subCommandsContainer.innerHTML = '';
                        addSubCommandField();
                    }

                    addModal.classList.remove('hidden');
                });
            });

            cancelAddBtn.addEventListener('click', () => {
                addModal.classList.add('hidden');
            });



            saveCommandBtn.addEventListener('click', async () => {
                let title = document.getElementById('commandTitleInput').value.trim();
                if (!title) return alert('Digite o Título do Comando');

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

                saveCommandBtn.textContent = 'Salvando...';
                saveCommandBtn.disabled = true;

                try {
                    const authHeader = window.adminToken ? `Bearer ${window.adminToken}` : `Bearer ${SUPABASE_ANON_KEY}`;
                    const headers = {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': authHeader,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    };

                    const commandJsonStr = JSON.stringify(subCommands);

                    let resCmd;
                    if (window.editingCmdId) {
                        resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${window.editingCmdId}`, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({ name: title, command: commandJsonStr })
                        });
                        window.editingCmdId = null;
                    } else {
                        resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ name: title, command: commandJsonStr })
                        });
                    }
                    if (!resCmd.ok) throw new Error('Erro ao salvar comando');

                    const addModal = document.getElementById('addModal');
                    if (addModal) addModal.classList.add('hidden');

                    document.getElementById('commandTitleInput').value = '';
                    const subCommandsContainer = document.getElementById('subCommandsContainer');
                    if (subCommandsContainer) subCommandsContainer.innerHTML = '';

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

            
            window.toggleActionDrawer = (drawerId) => {
                const drawer = document.getElementById(drawerId);
                if (!drawer) return;

                document.querySelectorAll('.action-drawer').forEach(d => {
                    if (d !== drawer) {
                        d.classList.remove('max-w-[200px]', 'opacity-100');
                        d.classList.add('max-w-0', 'opacity-0');
                    }
                });

                if (drawer.classList.contains('max-w-0')) {
                    drawer.classList.remove('max-w-0', 'opacity-0');
                    drawer.classList.add('max-w-[200px]', 'opacity-100');
                } else {
                    drawer.classList.add('max-w-0', 'opacity-0');
                    drawer.classList.remove('max-w-[200px]', 'opacity-100');
                }
            };

            let commandToDeleteId = null;

            window.deleteCommand = (cmdId) => {
                window.requireAdmin(() => {
                    commandToDeleteId = cmdId;
                    document.getElementById('deleteModal').classList.remove('hidden');
                });
            };

            document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
                commandToDeleteId = null;
                document.getElementById('deleteModal').classList.add('hidden');
            });

            document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
                if (!commandToDeleteId) return;
                
                const btn = document.getElementById('confirmDeleteBtn');
                btn.textContent = 'Excluindo...';
                btn.disabled = true;

                try {
                    const authHeader = window.adminToken ? `Bearer ${window.adminToken}` : `Bearer ${SUPABASE_ANON_KEY}`;
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${commandToDeleteId}`, {
                        method: 'DELETE',
                        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': authHeader }
                    });
                    if (!res.ok) throw new Error('Erro ao excluir');
                    await loadData();
                } catch (e) {
                    alert('Erro: ' + e.message);
                } finally {
                    commandToDeleteId = null;
                    document.getElementById('deleteModal').classList.add('hidden');
                    btn.textContent = 'Sim, Excluir';
                    btn.disabled = false;
                }
            });

            window.editingCmdId = null;
            window.editCommand = (cmdId) => {
                window.requireAdmin(() => {

                    let targetCmd = allComandos.find(s => String(s.id) === String(cmdId));
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
                        } catch (e) {
                            subCmds = [{ name: 'Comando', text: targetCmd.command || '' }];
                        }

                        if (subCmds.length === 0) {
                            addSubCommandField();
                        } else {
                            subCmds.forEach(sc => addSubCommandField(sc.name, sc.text, sc.desc || ''));
                        }
                    }

                    window.editingCmdId = targetCmd.id;
                    document.querySelector('#addModal h3').textContent = 'Editar Comando';
                    document.getElementById('addModal').classList.remove('hidden');
                });
            };

            const loadData = async () => {
                categoriesContainer.classList.add('loading');
                try {
                    const headers = {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    };

                    const resComandos = await fetch(`${SUPABASE_URL}/rest/v1/comandos?select=*`, { headers });

                    if (!resComandos.ok) {
                        throw new Error('HTTP error fetching from Supabase');
                    }

                    const rawComandos = await resComandos.json();

                    allComandos = rawComandos;
                    allComandos.sort((a, b) => a.name.localeCompare(b.name));

                    const suggestionSet = new Set();
                    allComandos.forEach(sub => {
                        suggestionSet.add(sub.name);
                        try {
                            const scs = JSON.parse(sub.command);
                            if (Array.isArray(scs)) {
                                scs.forEach(sc => suggestionSet.add(sc.name));
                            }
                        } catch (e) {}
                    });
                    allSuggestions = [...suggestionSet];

                    render(allComandos);
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
                const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '$&');
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

            
            window.switchTab = (event, subjectId, index) => {
                event.stopPropagation();
                document.querySelectorAll('.tab-panel-' + subjectId).forEach(p => p.classList.add('hidden'));
                const activePanel = document.getElementById('panel-' + subjectId + '-' + index);
                if (activePanel) activePanel.classList.remove('hidden');
                
                document.querySelectorAll('.tab-btn-' + subjectId).forEach((btn, idx) => {
                    if (idx === index) {
                        btn.className = `tab-btn-${subjectId} px-3 py-1.5 rounded-md text-sm font-medium transition-colors border shrink-0 bg-primary text-white border-primary`;
                    } else {
                        btn.className = `tab-btn-${subjectId} px-3 py-1.5 rounded-md text-sm font-medium transition-colors border shrink-0 bg-surface border-primary text-text hover:bg-primary hover:text-white`;
                    }
                });
            };

            
            window.showDescription = (encodedDesc) => {
                const desc = decodeURIComponent(encodedDesc);
                const infoMessage = document.getElementById('infoMessage');
                infoMessage.textContent = desc;
                document.getElementById('infoModal').classList.remove('hidden');
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
                dataToRender.forEach(subject => {
                    const categoryElement = document.createElement('div');
                    
                    const isSql = subject.name.toLowerCase().endsWith('.sql');
                    let subCommands = [];

                    try {
                        subCommands = JSON.parse(subject.command);
                        if (!Array.isArray(subCommands)) throw new Error('Not array');
                    } catch (e) {
                        subCommands = [{ name: 'Comando', text: subject.command || '' }];
                    }

                    const tabsHTML = subCommands.map((sc, scIdx) => {
                        const isActive = scIdx === 0;
                        const btnClass = isActive ? 'bg-primary text-white border-primary' : 'bg-surface border-primary text-text hover:bg-primary hover:text-white';
                        return `<button onclick="switchTab(event, '${subject.id}', ${scIdx})" class="tab-btn-${subject.id} px-3 py-1.5 rounded-md text-sm font-medium transition-colors border shrink-0 ${btnClass}">${highlightMatch(sc.name, searchTerm)}</button>`;
                    }).join('');

                    const panelsHTML = subCommands.map((sc, scIdx) => {
                        let displayText = (sc.text || '').trim();
                        let isDownloadLink = false;

                        if (displayText.startsWith('https://') || displayText.startsWith('http://')) {
                            isDownloadLink = true;
                            if (displayText.includes('drive.google.com/file/d/')) {
                                const match = displayText.match(/\/file\/d\/([^\/]+)/);
                                if (match && match[1]) {
                                    displayText = 'https://drive.google.com/uc?export=download&id=' + match[1];
                                }
                            }
                        }

                        const encoded = encodeURIComponent(displayText);
                        const encodedDesc = encodeURIComponent(sc.desc || 'Descrição não informada.');
                        const infoBtnHTML = `<button data-desc="${encodedDesc}" onclick="showDescription(this.getAttribute('data-desc'))" class="px-2 py-1 bg-surface border border-primary text-text rounded hover:bg-primary transition-colors text-xs font-bold flex items-center justify-center shrink-0" title="Descrição do Comando">!</button>`;
                        let actionBtn = '';

                        if (isSql) {
                            const fileName = sc.name.endsWith('.sql') ? sc.name : sc.name + '.sql';
                            actionBtn = `
                            ${infoBtnHTML}
                            <button data-command="${encoded}" onclick="downloadFile(decodeURIComponent(this.getAttribute('data-command')), '${fileName}')" class="px-3 py-1 bg-accent text-white rounded hover:opacity-90 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0" title="Descarregar ficheiro">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download
                            </button>`;
                        } else if (isDownloadLink) {
                            actionBtn = `
                            <div class="flex gap-2 items-center">
                                ${infoBtnHTML}
                                <a href="${displayText}" target="_blank" class="px-3 py-1 bg-surface border border-primary text-text rounded hover:bg-primary transition-colors text-xs font-semibold flex items-center gap-1 shrink-0" title="Download">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download
                                </a>
                            </div>`;
                        } else {
                            actionBtn = `
                            <div class="flex gap-2 items-center">
                                ${infoBtnHTML}
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

                        const hiddenClass = scIdx === 0 ? '' : 'hidden';
                        return `
                            <div id="panel-${subject.id}-${scIdx}" class="tab-panel-${subject.id} ${hiddenClass}">
                                <div class="flex justify-between items-start gap-4">
                                    <pre class="text-xs text-text-muted whitespace-pre-wrap flex-grow font-mono max-h-40 overflow-y-auto custom-scrollbar p-3 bg-black/20 rounded-md border border-[color:var(--panel-border)]">${displayText}</pre>
                                    ${actionBtn}
                                </div>
                            </div>
                        `;
                    }).join('');

                    categoryElement.innerHTML = `
                    <div class="panel border border-[color:var(--panel-border)] rounded-md mb-3 bg-white/5">
                        <div class="flex items-center justify-between p-3 cursor-pointer group hover:bg-white/10 transition-colors" onclick="if(event.target.closest('.action-buttons')) return; this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.cmd-chevron').classList.toggle('rotate-180');">
                            <div class="flex flex-col">
                                <span class="font-semibold text-text">${highlightMatch(subject.name, searchTerm)}</span>
                            </div>
                            <div class="flex items-center gap-4 action-buttons">
                                <div class="flex items-center gap-2 overflow-hidden transition-all duration-300 max-w-0 opacity-0 action-drawer" id="drawer-${subject.id}">
                                    <button onclick="event.stopPropagation(); deleteCommand('${subject.id}')" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors whitespace-nowrap" title="Excluir">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir
                                    </button>
                                    <button onclick="event.stopPropagation(); editCommand('${subject.id}')" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-blue-400 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap" title="Editar">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar
                                    </button>
                                </div>
                                <button onclick="event.stopPropagation(); toggleActionDrawer('drawer-${subject.id}')" class="p-1 hover:bg-primary rounded transition-colors text-text-muted shrink-0" title="Opções">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                </button>
                                <svg class="cmd-chevron w-5 h-5 text-text-muted transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        <div class="hidden p-3 pt-0 border-t border-[color:var(--panel-border)] bg-[color:var(--color-bg)] rounded-b-md">
                            <div class="flex overflow-x-auto custom-scrollbar gap-2 pb-3 mb-1 pt-3">
                                ${tabsHTML}
                            </div>
                            <div class="panels-container">
                                ${panelsHTML}
                            </div>
                        </div>
                    </div>
                    `;

                    categoriesContainer.appendChild(categoryElement);
                });
            };

            const handleSearch = () => {
                if (!isDataLoaded) return;
                const searchTerm = normalizeString(searchInput.value.trim());
                if (!searchTerm) {
                    render(allComandos);
                    return;
                }
                const searchResults = allComandos.filter(cmd => {
                    const catNameMatches = normalizeString(cmd.name).includes(searchTerm);
                    if (catNameMatches) return true;
                    
                    let subMatches = false;
                    try {
                        const scs = JSON.parse(cmd.command);
                        if (Array.isArray(scs)) {
                            subMatches = scs.some(sc => normalizeString(sc.name).includes(searchTerm));
                        }
                    } catch (e) {}
                    return subMatches;
                });
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
                            render(allComandos);
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
    