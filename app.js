
function initSynapsesCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;
    let particles = [];
    const maxParticles = 70;
    
    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    class Particle {
        constructor() {
            this.x = (window.secureRandom ? secureRandom() : Math.random()) * width;
            this.y = (window.secureRandom ? secureRandom() : Math.random()) * height;
            this.vx = ((window.secureRandom ? secureRandom() : Math.random()) - 0.5) * 1.5;
            this.vy = ((window.secureRandom ? secureRandom() : Math.random()) - 0.5) * 1.5;
            this.radius = (window.secureRandom ? secureRandom() : Math.random()) * 2 + 1;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > width) this.vx = -this.vx;
            if (this.y < 0 || this.y > height) this.vy = -this.vy;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 162, 199, 0.8)';
            ctx.fill();
        }
    }

    for (let i = 0; i < maxParticles; i++) {
        particles.push(new Particle());
    }

    function animateSynapses() {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < maxParticles; i++) {
            particles[i].update();
            particles[i].draw();
            for (let j = i + 1; j < maxParticles; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 162, 199, ${0.3 - dist / 500})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
        requestAnimationFrame(animateSynapses);
    }
    animateSynapses();
}

document.addEventListener('DOMContentLoaded', () => {
    initSynapsesCanvas('site-synapses-canvas');
    initSynapsesCanvas('synapses-canvas');
});

        
        if (sessionStorage.getItem('supabaseToken')) {
            document.getElementById('login-overlay').style.display = 'none';
        }
        const secureRandom = () => {
            const array = new Uint32Array(1);
            window.crypto.getRandomValues(array);
            return array[0] / (0xffffffff + 1);
        };
        // Animação de Sinapses para o Login
        
        const SUPABASE_URL = 'https://jqllbwlfikckavipqtfr.supabase.co';
        const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxbGxid2xmaWtja2F2aXBxdGZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NzczMDQsImV4cCI6MjA5ODA1MzMwNH0.adNqWBWMY3PlIx_0OG1bMswbVR_TThtCmNWFptxkgRU';
        let sessionToken = sessionStorage.getItem('supabaseToken');
        let sessionUser = JSON.parse(sessionStorage.getItem('supabaseUser') || 'null');

        const parseCommandData = (cmdStr) => {
            try {
                const parsed = typeof cmdStr === 'string' ? JSON.parse(cmdStr) : cmdStr;
                if (Array.isArray(parsed)) {
                    return { is_private: false, subCommands: parsed };
                } else if (parsed && typeof parsed === 'object') {
                    if (Array.isArray(parsed.subCommands)) {
                        return { 
                            is_private: !!parsed.is_private, 
                            subCommands: parsed.subCommands,
                            deleted_at: parsed.deleted_at 
                        };
                    }
                }
            } catch(e) {}
            return { is_private: false, subCommands: [{ name: 'Comando', text: typeof cmdStr === 'string' ? cmdStr : '' }] };
        };

        function getAuthHeaders() {
            const headers = {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            };
            if (sessionToken) {
                headers['Authorization'] = `Bearer ${sessionToken}`;
            } else {
                headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
            }
            return headers;
        }

        function checkAuth() {
            const loginOverlay = document.getElementById('login-overlay');
            const mainContent = document.getElementById('main-content');
            const userMenuContainer = document.getElementById('user-menu-container');
            
            if (sessionToken && sessionUser) {
                if(loginOverlay) loginOverlay.style.display = 'none';
                if(mainContent) {
                    mainContent.classList.remove('hidden');
                    // Small delay to allow display:block to apply before animating opacity
                    setTimeout(() => {
                        mainContent.classList.remove('opacity-0');
                        if (window.setFilterTab && window.currentFilterTab) {
                            window.setFilterTab(window.currentFilterTab);
                        }
                    }, 50);
                }
                if(userMenuContainer) {
                    userMenuContainer.classList.remove('hidden');
                    const name = sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User';
                    document.getElementById('user-name-display').textContent = name;
                    document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
                }
                
                const openAddModalBtn = document.getElementById('openAddModalBtn');
                if (openAddModalBtn) {
                    if (sessionUser.email === 'visitante@lcsistemas.com') {
                        openAddModalBtn.style.display = 'none';
                    } else {
                        openAddModalBtn.style.display = 'block';
                    }
                }
                
                return true;
            } else {
                if(loginOverlay) loginOverlay.style.display = 'flex';
                if(mainContent) mainContent.classList.add('hidden', 'opacity-0');
                if(userMenuContainer) userMenuContainer.classList.add('hidden');
                return false;
            }
        }

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
                    else window.showCustomAlert('Erro: Não foi possível copiar o comando.');
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
            
            // --- AUTH INIT ---
            if (checkAuth()) {
                // Initial load handled further down or we can just let it flow
            }

            document.getElementById('login-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                let email = document.getElementById('login-user').value.trim().toLowerCase();
                if (!email) {
                    email = 'admin@lcsistemas.com';
                } else if (!email.includes('@')) {
                    email = email + '@lcsistemas.com';
                }
                const password = document.getElementById('login-password').value;
                const btn = document.getElementById('login-btn');
                const spinner = document.getElementById('login-spinner');
                const errorDiv = document.getElementById('login-error');
                
                btn.disabled = true;
                spinner.classList.remove('hidden');
                errorDiv.classList.add('hidden');
                
                try {
                    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const data = await res.json();
                    
                    if (!res.ok) throw new Error(data.error_description || data.msg || 'Erro ao logar');
                    
                    sessionToken = data.access_token;
                    sessionUser = data.user;
                    sessionStorage.setItem('supabaseToken', sessionToken);
                    sessionStorage.setItem('supabaseUser', JSON.stringify(sessionUser));
                    
                    checkAuth();
                    if(typeof loadData === 'function') loadData();
                } catch (err) {
                    console.error('Login Error:', err);
                    errorDiv.textContent = err.message || 'Usuário ou senha incorretos.';
                    errorDiv.classList.remove('hidden');
                } finally {
                    btn.disabled = false;
                    spinner.classList.add('hidden');
                }
            });

            // Toggle forgot password form
            const loginForm = document.getElementById('login-form');
            const forgotForm = document.getElementById('forgot-password-form');
            
            // Visitor Login
            document.getElementById('visitor-login-btn')?.addEventListener('click', async () => {
                const btn = document.getElementById('visitor-login-btn');
                const spinner = document.getElementById('visitor-spinner');
                const errorDiv = document.getElementById('login-error');
                
                btn.disabled = true;
                spinner.classList.remove('hidden');
                errorDiv.classList.add('hidden');
                
                try {
                    const resLogin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email: 'visitante@lcsistemas.com', password: 'visitante123' })
                    });
                    
                    if (resLogin.ok) {
                        const data = await resLogin.json();
                        sessionToken = data.access_token;
                        sessionUser = data.user;
                        sessionUser.is_visitor = true; // flag
                        localStorage.setItem('supabaseToken', sessionToken);
                        localStorage.setItem('supabaseUser', JSON.stringify(sessionUser));
                        
                        checkAuth();
                        if(typeof loadData === 'function') loadData();
                    } else {
                        errorDiv.textContent = 'Conta visitante ainda não configurada no Supabase.';
                        errorDiv.classList.remove('hidden');
                    }
                } catch (err) {
                    errorDiv.textContent = 'Erro ao entrar como visitante.';
                    errorDiv.classList.remove('hidden');
                } finally {
                    btn.disabled = false;
                    spinner.classList.add('hidden');
                }
            });

            document.getElementById('forgot-password-link')?.addEventListener('click', () => {
                loginForm.classList.add('hidden');
                forgotForm.classList.remove('hidden');
            });
            
            document.getElementById('back-to-login-btn')?.addEventListener('click', () => {
                forgotForm.classList.add('hidden');
                loginForm.classList.remove('hidden');
            });
            
            document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
                e.preventDefault();
                let username = document.getElementById('forgot-user').value.trim().toLowerCase();
                const newPassword = document.getElementById('forgot-new-password').value;
                const confirmPassword = document.getElementById('forgot-confirm-password').value;
                
                const btn = document.getElementById('forgot-btn');
                const spinner = document.getElementById('forgot-spinner');
                const errorDiv = document.getElementById('forgot-error');
                const successDiv = document.getElementById('forgot-success');
                
                errorDiv.classList.add('hidden');
                successDiv.classList.add('hidden');
                
                const validTeamNames = ['rafael', 'leandro', 'danilo', 'ana', 'carlos', 'renato', 'gabriel', 'lucas', 'pedro', 'joao'];
                if (!validTeamNames.includes(username)) {
                    errorDiv.textContent = 'Nome de usuário inválido ou não encontrado.';
                    errorDiv.classList.remove('hidden');
                    return;
                }
                
                if (newPassword !== confirmPassword) {
                    errorDiv.textContent = 'As senhas não coincidem.';
                    errorDiv.classList.remove('hidden');
                    return;
                }
                
                btn.disabled = true;
                spinner.classList.remove('hidden');
                
                try {
                    // 1. Inserir pedido no banco (usando anon key)
                    const resInsert = await fetch(`${SUPABASE_URL}/rest/v1/password_requests`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Content-Type': 'application/json',
                            'Prefer': 'return=representation'
                        },
                        body: JSON.stringify({
                            username: username,
                            new_password: newPassword
                        })
                    });
                    
                    if (!resInsert.ok) {
                        throw new Error('Erro ao salvar solicitação no banco.');
                    }
                    
                    successDiv.classList.remove('hidden');
                    
                    // 2. Fazer login como visitante
                    // Autologin com conta genérica de visitante (para ter permissão de leitura)
                    const resLogin = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                        method: 'POST',
                        headers: {
                            'apikey': SUPABASE_ANON_KEY,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ email: 'visitante@lcsistemas.com', password: 'visitante123' })
                    });
                    
                    if (resLogin.ok) {
                        const data = await resLogin.json();
                        sessionToken = data.access_token;
                        sessionUser = data.user;
                        // Forçamos uma role customizada no sessionStorage para identificar o visitante no frontend
                        sessionUser.is_visitor = true;
                        sessionStorage.setItem('supabaseToken', sessionToken);
                        sessionStorage.setItem('supabaseUser', JSON.stringify(sessionUser));
                        
                        setTimeout(() => {
                            checkAuth();
                            if(typeof loadData === 'function') loadData();
                        }, 1500);
                    } else {
                        // Se a conta visitante não existir ainda no Supabase, logamos com um token mockado de leitura
                        // (Isso falhará caso o Supabase exija token válido no SELECT, mas o usuário deve criar a conta)
                        errorDiv.textContent = 'Aviso: Conta visitante@lcsistemas.com não criada no Supabase ainda. Acesso limitado.';
                        errorDiv.classList.remove('hidden');
                        successDiv.classList.add('hidden');
                    }
                    
                } catch (err) {
                    console.error('Forgot Password Error:', err);
                    errorDiv.textContent = err.message || 'Ocorreu um erro ao enviar.';
                    errorDiv.classList.remove('hidden');
                } finally {
                    btn.disabled = false;
                    spinner.classList.add('hidden');
                }
            });

            document.getElementById('logout-btn')?.addEventListener('click', () => {
                sessionToken = null;
                sessionUser = null;
                sessionStorage.removeItem('supabaseToken');
                sessionStorage.removeItem('supabaseUser');
                document.getElementById('login-password').value = '';
                checkAuth();
            });
            // --- END AUTH INIT ---

            try {
                // --- Typewriter Effect for Search Input ---
                const searchInput = document.getElementById('cmdSearchInput');
                if (searchInput) {
                    const phrases = [
                        "Pesquisar por categorias...",
                        "Buscar produtos com preço menor que custo...",
                        "Como zerar o IPI?",
                        "Tirar caracteres especiais...",
                        "Ajuste de estoque...",
                        "ERRO IMENDES...",
                        "Set Produto...",
                        "Comandos SQL úteis...",
                        "Buscar produtos sem NCM...",
                        "Corrigir tributação..."
                    ];
                    let currentPhraseIndex = 0;
                    let currentCharacterIndex = 0;
                    let isDeleting = false;
                    let typingTimeout;

                    function typeWriter() {
                        if (searchInput === document.activeElement) return; // Don't animate while focused
                        
                        const currentPhrase = phrases[currentPhraseIndex];
                        
                        if (isDeleting) {
                            searchInput.setAttribute('placeholder', currentPhrase.substring(0, currentCharacterIndex - 1));
                            currentCharacterIndex--;
                        } else {
                            searchInput.setAttribute('placeholder', currentPhrase.substring(0, currentCharacterIndex + 1) + '|');
                            currentCharacterIndex++;
                        }

                        let typingSpeed = isDeleting ? 30 : 60;

                        if (!isDeleting && currentCharacterIndex === currentPhrase.length) {
                            searchInput.setAttribute('placeholder', currentPhrase); // Remove cursor when pausing
                            typingSpeed = 2000;
                            isDeleting = true;
                        } else if (isDeleting && currentCharacterIndex === 0) {
                            isDeleting = false;
                            currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
                            typingSpeed = 500;
                        }

                        typingTimeout = setTimeout(typeWriter, typingSpeed);
                    }

                    typeWriter();

                    searchInput.addEventListener('focus', () => {
                        clearTimeout(typingTimeout);
                        searchInput.setAttribute('placeholder', 'Pesquisar...');
                    });
                    
                    searchInput.addEventListener('blur', () => {
                        if (searchInput.value === '') {
                            isDeleting = false;
                            currentCharacterIndex = 0;
                            typeWriter();
                        }
                    });
                }
            } catch(e) {
                console.error("Typewriter error:", e);
            }

        window.expandCommand = (subjectId, scIdx) => {
            document.getElementById('pre-preview-' + subjectId + '-' + scIdx).classList.add('hidden');
            document.getElementById('pre-expand-overlay-' + subjectId + '-' + scIdx).classList.add('hidden');
            document.getElementById('pre-full-' + subjectId + '-' + scIdx).classList.remove('hidden');
        };

        window.showCustomAlert = (message, title = 'Aviso') => {
            document.getElementById('alertModalTitle').textContent = title;
            document.getElementById('alertModalMessage').textContent = message;
            const modal = document.getElementById('alertModal');
            modal.classList.remove('hidden');
            setTimeout(() => { modal.classList.remove('opacity-0'); modal.children[0].classList.remove('scale-95'); }, 10);
            
            return new Promise(resolve => {
                const btn = document.getElementById('alertModalBtn');
                btn.onclick = () => {
                    modal.classList.add('opacity-0'); modal.children[0].classList.add('scale-95');
                    setTimeout(() => { modal.classList.add('hidden'); resolve(); }, 300);
                };
            });
        };

        window.showCustomConfirm = (message, title = 'Confirmação') => {
            document.getElementById('confirmModalTitle').textContent = title;
            document.getElementById('confirmModalMessage').textContent = message;
            const modal = document.getElementById('confirmModal');
            modal.classList.remove('hidden');
            setTimeout(() => { modal.classList.remove('opacity-0'); modal.children[0].classList.remove('scale-95'); }, 10);
            
            return new Promise(resolve => {
                const cancelBtn = document.getElementById('confirmModalCancelBtn');
                const okBtn = document.getElementById('confirmModalOkBtn');
                
                const cleanup = (result) => {
                    modal.classList.add('opacity-0'); modal.children[0].classList.add('scale-95');
                    setTimeout(() => { modal.classList.add('hidden'); resolve(result); }, 300);
                    cancelBtn.onclick = null;
                    okBtn.onclick = null;
                };
                
                cancelBtn.onclick = () => cleanup(false);
                okBtn.onclick = () => cleanup(true);
            });
        };

            // --- Elementos do DOM ---
            const searchInput = document.getElementById('cmdSearchInput');
            const categoriesContainer = document.getElementById('categoriesContainer');
            const suggestionsContainer = document.getElementById('cmdSuggestionsContainer');
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
            
            window.modalSubCommands = [];
            window.activeModalTabIndex = 0;

            window.renderModalSubCommands = () => {
                const tabsContainer = document.getElementById('modalTabsContainer');
                const contentContainer = document.getElementById('modalContentContainer');
                if (!tabsContainer || !contentContainer) return;

                tabsContainer.innerHTML = '';
                contentContainer.innerHTML = '';

                if (window.modalSubCommands.length === 0) {
                    contentContainer.innerHTML = '<div class="text-text-muted text-sm flex items-center justify-center h-full text-center">Nenhuma aba criada.<br>Clique no "+" ao lado para adicionar.</div>';
                    return;
                }

                window.modalSubCommands.forEach((sc, idx) => {
                    const isActive = idx === window.activeModalTabIndex;
                    const btnClass = isActive ? 'bg-bg-solid text-white border-border-element shadow-md scale-[1.02]' : 'bg-bg-panel border-border-element text-text-high hover:bg-bg-solid-hover hover:text-white hover:shadow-md hover:scale-[1.02] transition-all';
                    tabsContainer.innerHTML += `<button type="button" onclick="switchModalTab(${idx})" class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors border truncate shrink-0 ${btnClass}">${sc.name || 'Nova Aba'}</button>`;
                });

                const activeSc = window.modalSubCommands[window.activeModalTabIndex];
                contentContainer.innerHTML = `
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-xs font-medium text-text-muted">Nome da Aba (Ex: Select)</label>
                        <button type="button" onclick="removeModalTab(${window.activeModalTabIndex})" class="text-red-500 hover:text-red-700 flex items-center justify-center p-1 rounded-md hover:bg-red-500/10 transition-all hover:scale-110 hover:shadow-sm" title="Remover Aba">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                        </button>
                    </div>
                    <input type="text" value="${(activeSc.name || '').replace(/"/g, '&quot;')}" class="w-full rounded-md px-3 py-1.5 mb-3 bg-[color:var(--bg-app)] border border-border-element text-text-high focus:outline-none focus:ring-1 focus:ring-accent text-sm" oninput="updateActiveModalTab('name', this.value)">
                    
                    <label class="block text-xs font-medium text-text-muted mb-1">Descrição (Obrigatório)</label>
                    <input type="text" value="${(activeSc.desc || '').replace(/"/g, '&quot;')}" class="w-full rounded-md px-3 py-1.5 mb-3 bg-[color:var(--bg-app)] border border-border-element text-text-high focus:outline-none focus:ring-1 focus:ring-accent text-sm" placeholder="Para que serve este comando?" oninput="updateActiveModalTab('desc', this.value)">
                    
                    <label class="block text-xs font-medium text-text-muted mb-1">Anexo de Mídia (Opcional)</label>
                    <div class="mb-3 flex items-center gap-3">
                        ${activeSc.media_url ? `
                            <div class="relative group shrink-0">
                                <img src="${activeSc.media_url}" class="h-10 w-10 object-cover rounded border border-border-element bg-black/5" alt="Preview">
                                <button type="button" onclick="removeMediaModal()" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:scale-110 transition-transform" title="Remover Imagem">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        ` : ''}
                        <label class="cursor-pointer flex items-center justify-center px-3 py-1.5 bg-[color:var(--bg-app)] border border-border-element rounded-md hover:bg-bg-solid-hover transition-colors text-xs font-medium text-text-high">
                            <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <span id="mediaUploadBtnLabel">${activeSc.media_url ? 'Trocar Imagem' : 'Anexar Imagem'}</span>
                            <input type="file" accept="image/*" class="hidden" onchange="uploadMediaModal(this)">
                        </label>
                    </div>

                    <label class="block text-xs font-medium text-text-muted mb-1">Comando SQL</label>
                    <textarea rows="4" class="w-full rounded-md px-3 py-1.5 bg-[color:var(--bg-app)] border border-border-element text-text-high focus:outline-none focus:ring-1 focus:ring-accent font-mono text-xs custom-scrollbar flex-grow min-h-[80px]" oninput="updateActiveModalTab('text', this.value)">${activeSc.text || ''}</textarea>
                `;
            };

            window.uploadMediaModal = async (fileInput) => {
                const file = fileInput.files[0];
                if (!file) return;
                
                const activeSc = window.modalSubCommands[window.activeModalTabIndex];
                const btnLabel = document.getElementById('mediaUploadBtnLabel');
                const origText = btnLabel.textContent;
                btnLabel.textContent = 'Enviando...';
                fileInput.disabled = true;

                try {
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${Date.now()}-${secureRandom().toString(36).substring(2)}.${fileExt}`;
                    const filePath = `uploads/${fileName}`;

                    const authHeaders = getAuthHeaders();
                    authHeaders['Content-Type'] = file.type || 'application/octet-stream';

                    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/comandos-midia/${filePath}`, {
                        method: 'POST',
                        headers: authHeaders,
                        body: file
                    });

                    if (!res.ok) {
                        const errText = await res.text();
                        throw new Error(`Upload failed: ${res.status} - ${errText}`);
                    }

                    activeSc.media_url = `${SUPABASE_URL}/storage/v1/object/public/comandos-midia/${filePath}`;
                    window.renderModalSubCommands();
                } catch (e) {
                    window.showCustomAlert('Erro ao enviar imagem: ' + e.message);
                } finally {
                    if(btnLabel) btnLabel.textContent = origText;
                    if(fileInput) fileInput.disabled = false;
                }
            };
            
            window.removeMediaModal = () => {
                const activeSc = window.modalSubCommands[window.activeModalTabIndex];
                activeSc.media_url = null;
                window.renderModalSubCommands();
            };

            window.addNewModalSubCommand = () => {
                window.modalSubCommands.push({ name: '', text: '', desc: '' });
                window.activeModalTabIndex = window.modalSubCommands.length - 1;
                window.renderModalSubCommands();
            };

            window.switchModalTab = (idx) => {
                window.activeModalTabIndex = idx;
                window.renderModalSubCommands();
            };

            window.removeModalTab = (idx) => {
                window.modalSubCommands.splice(idx, 1);
                if (window.activeModalTabIndex >= window.modalSubCommands.length) {
                    window.activeModalTabIndex = Math.max(0, window.modalSubCommands.length - 1);
                }
                window.renderModalSubCommands();
            };

            window.updateActiveModalTab = (field, value) => {
                if (window.modalSubCommands[window.activeModalTabIndex]) {
                    window.modalSubCommands[window.activeModalTabIndex][field] = value;
                    if (field === 'name') {
                        const tabs = document.getElementById('modalTabsContainer').children;
                        if (tabs[window.activeModalTabIndex]) {
                            tabs[window.activeModalTabIndex].textContent = value || 'Nova Aba';
                        }
                    }
                }
            };


            window.requireAdmin = (actionCallback) => {
                actionCallback();
            };

            openAddModalBtn.addEventListener('click', () => {
                window.requireAdmin(() => {

                    window.editingCmdId = null;
                    
                    document.querySelector('#addModal h3').textContent = 'Adicionar Novo Comando';

                    document.getElementById('commandTitleInput').value = '';
                    document.getElementById('commandVisibilityInput').value = 'public';

                    window.modalSubCommands = [];
                    window.addNewModalSubCommand();

                    addModal.classList.remove('hidden');
                });
            });

            cancelAddBtn.addEventListener('click', async () => {
                let hasContent = false;
                if (document.getElementById('commandTitleInput').value.trim() !== '') hasContent = true;
                if (window.modalSubCommands && window.modalSubCommands.some(sc => (sc.name && sc.name.trim() !== '') || (sc.desc && sc.desc.trim() !== '') || (sc.text && sc.text.trim() !== '') || sc.media_url)) {
                    hasContent = true;
                }
                
                if (hasContent) {
                    const confirmed = await window.showCustomConfirm('Tem certeza que deseja cancelar? Todos os dados preenchidos serão perdidos.');
                    if (!confirmed) {
                        return;
                    }
                }
                addModal.classList.add('hidden');
            });



            saveCommandBtn.addEventListener('click', async () => {
                let title = document.getElementById('commandTitleInput').value.trim();
                if (!title) return window.showCustomAlert('O Título do Comando é obrigatório!');

                const subCommands = window.modalSubCommands.map(sc => ({
                    name: sc.name.trim(),
                    text: sc.text.trim(),
                    desc: sc.desc.trim(),
                    ...(sc.media_url && { media_url: sc.media_url })
                }));

                const hasEmptyName = subCommands.some(sc => !sc.name);
                if (hasEmptyName) return window.showCustomAlert('O Nome da Aba de todas as gavetas é obrigatório!');
                
                const hasEmptyDesc = subCommands.some(sc => !sc.desc);
                if (hasEmptyDesc) return window.showCustomAlert('A descrição de todas as gavetas é obrigatória!');

                const hasEmptyText = subCommands.some(sc => !sc.text);
                if (hasEmptyText) return window.showCustomAlert('O Comando SQL de todas as gavetas é obrigatório!');

                 if (subCommands.length === 0) {
                    return window.showCustomAlert('Adicione pelo menos um subcomando (Gaveta interna).');
                }

                const isEditing = !!window.editingCmdId;
                let editReason = null;
                
                if (isEditing) {
                    editReason = await new Promise((resolve) => {
                        const modal = document.getElementById('reasonModal');
                        const input = document.getElementById('reasonInput');
                        const okBtn = document.getElementById('reasonOkBtn');
                        const cancelBtn = document.getElementById('reasonCancelBtn');
                        const cancelTopBtn = document.getElementById('reasonCancelTopBtn');

                        input.value = '';
                        modal.classList.remove('hidden');
                        input.focus();

                        const onOk = () => {
                            const reason = input.value.trim();
                            if (!reason) {
                                window.showCustomAlert('O motivo da alteração é obrigatório!');
                                return;
                            }
                            cleanup();
                            resolve(reason);
                        };

                        const onCancel = () => {
                            cleanup();
                            resolve(null);
                        };

                        const cleanup = () => {
                            modal.classList.add('hidden');
                            okBtn.removeEventListener('click', onOk);
                            cancelBtn.removeEventListener('click', onCancel);
                            cancelTopBtn.removeEventListener('click', onCancel);
                        };

                        okBtn.addEventListener('click', onOk);
                        cancelBtn.addEventListener('click', onCancel);
                        cancelTopBtn.addEventListener('click', onCancel);
                    });

                    if (editReason === null) {
                        return; // User canceled
                    }
                }

                saveCommandBtn.textContent = 'Salvando...';
                saveCommandBtn.disabled = true;

                try {
                    const isPrivate = document.getElementById('commandVisibilityInput').value === 'private';
                    const data = { name: title, command: JSON.stringify({ is_private: isPrivate, subCommands: subCommands }) };
                    const targetUrl = isEditing 
                        ? `${SUPABASE_URL}/rest/v1/comandos?id=eq.${window.editingCmdId}`
                        : `${SUPABASE_URL}/rest/v1/comandos`;
                        
                    const method = isEditing ? 'PATCH' : 'POST';
                    const headers = getAuthHeaders();
                    headers['Prefer'] = 'return=representation'; // Always return so we get ID
                    
                    const userName = sessionUser?.user_metadata?.name || sessionUser?.email?.split('@')[0] || 'Desconhecido';
                    if (!isEditing) {
                        data.created_by_name = userName;
                    }

                    let resCmd;
                    try {
                        const oldCmd = isEditing ? allComandos.find(c => c.id === window.editingCmdId) : null;

                        resCmd = await fetch(targetUrl, {
                            method: method,
                            headers: headers,
                            body: JSON.stringify(data)
                        });
                        
                        if (!resCmd.ok) {
                            const errData = await resCmd.json();
                            throw new Error(errData.message || 'Erro ao salvar o comando no Supabase.');
                        }

                        const savedData = await resCmd.json();
                        const savedCmd = Array.isArray(savedData) ? savedData[0] : savedData;
                        const commandId = savedCmd.id;

                        // Delete orphaned media files if editing
                        if (isEditing && oldCmd) {
                            try {
                                const oldParsed = parseCommandData(oldCmd.command);
                                const oldUrls = [];
                                if (oldParsed && Array.isArray(oldParsed.subCommands)) {
                                    oldParsed.subCommands.forEach(sc => {
                                        if (sc.media_url && sc.media_url.includes('/comandos-midia/')) {
                                            oldUrls.push(sc.media_url);
                                        }
                                    });
                                }
                                const newUrls = subCommands.map(sc => sc.media_url).filter(Boolean);
                                const urlsToDelete = oldUrls.filter(url => !newUrls.includes(url));
                                
                                for (const url of urlsToDelete) {
                                    const oldFileName = url.split('/').pop();
                                    if (oldFileName) {
                                        const deleteHeaders = getAuthHeaders();
                                        deleteHeaders['Content-Type'] = 'application/json';
                                        fetch(`${SUPABASE_URL}/storage/v1/object/comandos-midia`, {
                                            method: 'DELETE',
                                            headers: deleteHeaders,
                                            body: JSON.stringify({ prefixes: [`uploads/${oldFileName}`] })
                                        }).then(async res => {
                                            if (!res.ok) {
                                                const errText = await res.text();
                                                window.showCustomAlert(`Aviso: O comando foi salvo, mas não conseguimos excluir a imagem antiga do Supabase (comandos-midia). Verifique as permissões (RLS) de DELETE. Detalhes: ${errText}`);
                                            } else {
                                                const deletedData = await res.json();
                                                console.log('Delete response:', deletedData);
                                            }
                                        }).catch(err => console.warn('Erro ao deletar mídia órfã:', err));
                                    }
                                }
                            } catch (e) {
                                console.warn('Erro ao limpar mídias antigas:', e);
                            }
                        }

                        // Save History
                        const historyPayload = {
                            command_id: commandId,
                            action: isEditing ? 'UPDATE' : 'CREATE',
                            user_name: userName,
                            old_content: oldCmd ? { name: oldCmd.name, command: oldCmd.command } : null,
                            new_content: { name: title, command: JSON.stringify({ is_private: isPrivate, subCommands: subCommands }), ...(editReason ? { reason: editReason } : {}) }
                        };

                        await fetch(`${SUPABASE_URL}/rest/v1/command_history`, {
                            method: 'POST',
                            headers: Object.assign(getAuthHeaders(), { 'Prefer': 'return=minimal' }),
                            body: JSON.stringify(historyPayload)
                        });

                    } catch (e) {
                        throw e;
                    }

                    const addModal = document.getElementById('addModal');
                    if (addModal) addModal.classList.add('hidden');

                    document.getElementById('commandTitleInput').value = '';
                    const subCommandsContainer = document.getElementById('subCommandsContainer');
                    if (subCommandsContainer) subCommandsContainer.innerHTML = '';

                    window.editingCmdId = null;
                    await loadData();
                } catch (e) {
                    if (e.message && e.message.toLowerCase().includes('jwt expired')) {
                        window.showCustomAlert('Sua sessão expirou por segurança. Faça login novamente.');
                        document.getElementById('logout-btn')?.click();
                    } else {
                        window.showCustomAlert('Ocorreu um erro ao salvar no banco de dados. ' + e.message);
                    }
                } finally {
                    saveCommandBtn.textContent = 'Salvar Comando';
                    saveCommandBtn.disabled = false;
                }
            });

            // --- MÓDULOS ---
            const ThemeSwitcher = (() => { const DOM = { body: document.body, themeToggleBtn: document.getElementById('theme-toggle-btn'), themeIconSun: document.getElementById('theme-icon-sun'), themeIconMoon: document.getElementById('theme-icon-moon') }; const STORAGE_KEY = 'themePreference'; const applyTheme = (theme) => { DOM.body.dataset.theme = theme; localStorage.setItem(STORAGE_KEY, theme); DOM.themeIconSun.classList.toggle('hidden', theme === 'dark'); DOM.themeIconMoon.classList.toggle('hidden', theme === 'light'); }; const toggleTheme = () => { const currentTheme = DOM.body.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(currentTheme); }; const init = () => { const savedTheme = localStorage.getItem(STORAGE_KEY) || 'dark'; applyTheme(savedTheme); DOM.themeToggleBtn.onclick = toggleTheme; }; return { init }; })();
            const hideModal = () => infoModal.classList.add('hidden');
            infoOkBtn.addEventListener('click', hideModal);

            

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

            window.viewHistory = async (cmdId, cmdName) => {
                document.getElementById('historyCommandName').textContent = decodeURIComponent(cmdName);
                const modal = document.getElementById('historyModal');
                const loading = document.getElementById('historyLoading');
                const empty = document.getElementById('historyEmpty');
                const list = document.getElementById('historyListContainer');
                
                modal.classList.remove('hidden');
                loading.classList.remove('hidden');
                empty.classList.add('hidden');
                list.innerHTML = '';
                
                try {
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/command_history?command_id=eq.${cmdId}&order=created_at.desc`, {
                        headers: getAuthHeaders()
                    });
                    if (!res.ok) throw new Error('Erro ao buscar histórico');
                    const historyData = await res.json();
                    
                    loading.classList.add('hidden');
                    if (historyData.length === 0) {
                        empty.classList.remove('hidden');
                        return;
                    }
                    
                    historyData.forEach(item => {
                        const date = new Date(item.created_at).toLocaleString('pt-BR');
                        const isUpdate = item.action === 'UPDATE';
                        
                        let diffHTML = '';
                        
                        const formatCommandForDiff = (cmdJsonStr) => {
                            try {
                                const parsedData = parseCommandData(cmdJsonStr);
                                const subCommands = parsedData.subCommands;
                                if (!Array.isArray(subCommands)) return typeof cmdJsonStr === 'string' ? cmdJsonStr : JSON.stringify(cmdJsonStr, null, 2);
                                return subCommands.map((sc, i) => {
                                    let res = `[GAVETA ${i + 1}] ${sc.name || 'Sem título'}`;
                                    if (sc.desc) res += `\nDescrição: ${sc.desc}`;
                                    if (sc.text) res += `\nCódigo:\n${sc.text}`;
                                    return res;
                                }).join('\n\n------------------------\n\n');
                            } catch(e) {
                                return typeof cmdJsonStr === 'string' ? cmdJsonStr : JSON.stringify(cmdJsonStr, null, 2);
                            }
                        };

                        const escapeHTML = (str) => {
                            if (!str) return '';
                            return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                        };

                        if (isUpdate && item.old_content && item.new_content) {
                            try {
                                const oldName = item.old_content.name || 'Sem título';
                                const newName = item.new_content.name || 'Sem título';
                                const oldStr = `TÍTULO PRINCIPAL: ${oldName}\n\n` + formatCommandForDiff(item.old_content.command);
                                const newStr = `TÍTULO PRINCIPAL: ${newName}\n\n` + formatCommandForDiff(item.new_content.command);
                                
                                const diff = window.Diff.diffLines(oldStr, newStr);
                                
                                diffHTML = '<div class="mt-3 bg-bg-panel-active rounded p-2 overflow-x-auto text-xs font-mono">';
                                let hasChanges = false;
                                diff.forEach(part => {
                                    if (part.added) {
                                        hasChanges = true;
                                        diffHTML += `<div class="text-green-400 bg-green-500/10 px-2 py-1 whitespace-pre-wrap border-l-2 border-green-500">+ ${escapeHTML(part.value)}</div>`;
                                    } else if (part.removed) {
                                        hasChanges = true;
                                        diffHTML += `<div class="text-red-400 bg-red-500/10 px-2 py-1 whitespace-pre-wrap border-l-2 border-red-500">- ${escapeHTML(part.value)}</div>`;
                                    }
                                });
                                if (!hasChanges) {
                                    diffHTML += `<div class="text-gray-400 px-2 py-1 italic">Nenhuma alteração textual detectada.</div>`;
                                }
                                diffHTML += '</div>';
                            } catch(e) {
                                diffHTML = '<div class="text-xs text-red-400 mt-2">Não foi possível calcular as diferenças.</div>';
                            }
                        } else if (!isUpdate && item.new_content) {
                            try {
                                const newName = item.new_content.name || 'Sem título';
                                const newStr = `TÍTULO PRINCIPAL: ${newName}\n\n` + formatCommandForDiff(item.new_content.command);
                                diffHTML = `<div class="mt-3 bg-bg-panel-active rounded p-3 overflow-x-auto text-xs font-mono whitespace-pre-wrap text-text-muted border-l-2 border-green-500 bg-green-500/5">${escapeHTML(newStr)}</div>`;
                            } catch(e) {}
                        }
                        
                        if (item.new_content && item.new_content.reason) {
                            diffHTML += `<div class="mt-3 bg-accent-solid/10 border-l-2 border-accent-solid p-3 rounded text-sm text-text-high font-sans"><strong>Motivo da alteração:</strong> <span class="text-text-muted">${escapeHTML(item.new_content.reason)}</span></div>`;
                        }
                        
                        const el = document.createElement('details');
                        el.className = 'group bg-black/5 border border-border-subtle rounded-lg mb-3 last:mb-0';
                        el.innerHTML = `
                            <summary class="flex justify-between items-start p-4 cursor-pointer hover:bg-white/5 transition-colors list-none rounded-lg [&::-webkit-details-marker]:hidden">
                                <div>
                                    <span class="inline-block px-2 py-1 rounded text-xs font-bold ${isUpdate ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'} mb-1">
                                        ${isUpdate ? 'EDITADO' : 'CRIADO'}
                                    </span>
                                    <p class="text-text-high font-medium text-sm">Por: ${item.user_name || 'Desconhecido'}</p>
                                </div>
                                <div class="flex flex-col items-end gap-2">
                                    <span class="text-xs text-text-muted">${date}</span>
                                    <svg class="w-4 h-4 text-text-muted group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </summary>
                            <div class="p-4 pt-0 border-t border-border-subtle/30 mt-1">
                                ${diffHTML}
                            </div>
                        `;
                        list.appendChild(el);
                    });
                } catch (e) {
                    loading.classList.add('hidden');
                    window.showCustomAlert('Erro ao carregar o histórico: ' + e.message);
                }
            };

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
                    const headers = Object.assign(getAuthHeaders(), { 'Prefer': 'return=minimal' });
                    
                    // Fetch current command to preserve its JSON
                    const resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${commandToDeleteId}&select=command`, { headers: getAuthHeaders() });
                    if (!resCmd.ok) throw new Error('Erro ao buscar o comando');
                    const cmdDataArr = await resCmd.json();
                    if (cmdDataArr.length === 0) throw new Error('Comando não encontrado');
                    
                    const parsedData = parseCommandData(cmdDataArr[0].command);
                    parsedData.deleted_at = new Date().toISOString();
                    
                    const res = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${commandToDeleteId}`, {
                        method: 'PATCH',
                        headers: headers,
                        body: JSON.stringify({ command: JSON.stringify(parsedData) })
                    });
                    
                    if (!res.ok) throw new Error('Erro ao mover para a lixeira');
                    await loadData();
                } catch (e) {
                    if (e.message && e.message.toLowerCase().includes('jwt expired')) {
                        window.showCustomAlert('Sua sessão expirou por segurança. Faça login novamente.');
                        document.getElementById('logout-btn')?.click();
                    } else {
                        window.showCustomAlert('Erro: ' + e.message);
                    }
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

                    const parsedData = parseCommandData(targetCmd.command);
                    let subCmds = parsedData.subCommands;

                    if (subCmds.length === 0) {
                        subCmds = [{ name: '', text: '', desc: '' }];
                    }
                    
                    document.getElementById('commandVisibilityInput').value = parsedData.is_private ? 'private' : 'public';
                    
                    window.modalSubCommands = subCmds;
                    window.activeModalTabIndex = 0;
                    window.renderModalSubCommands();

                    window.editingCmdId = targetCmd.id;
                    document.querySelector('#addModal h3').textContent = 'Editar Comando';
                    document.getElementById('addModal').classList.remove('hidden');
                });
            };

            const loadData = async () => {
                categoriesContainer.classList.add('loading');
                try {
                    const headers = getAuthHeaders();

                    const resComandos = await fetch(`${SUPABASE_URL}/rest/v1/comandos?select=*`, { headers });

                    if (!resComandos.ok) {
                        let errMsg = 'HTTP error fetching from Supabase';
                        try {
                            const errData = await resComandos.json();
                            errMsg = errData.message || errMsg;
                        } catch(e) {}
                        throw new Error(errMsg);
                    }

                    const rawComandos = await resComandos.json();

                    const userName = sessionUser?.user_metadata?.name || sessionUser?.email?.split('@')[0] || 'Desconhecido';
                    const isAdmin = sessionUser?.email === 'admin@lcsistemas.com';
                    
                    const trashBtn = document.getElementById('openTrashModalBtn');
                    if (trashBtn) {
                        if (isAdmin) trashBtn.classList.remove('hidden');
                        else trashBtn.classList.add('hidden');
                    }

                    const now = new Date();
                    window.trashComandos = [];
                    
                    allComandos = rawComandos.filter(cmd => {
                        const parsedData = parseCommandData(cmd.command);
                        
                        // Garbage Collection
                        if (parsedData.deleted_at) {
                            const deletedAt = new Date(parsedData.deleted_at);
                            const hoursDiff = (now - deletedAt) / (1000 * 60 * 60);
                            
                            if (hoursDiff >= 48) {
                                // Delete permanently in background
                                fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${cmd.id}`, {
                                    method: 'DELETE',
                                    headers: getAuthHeaders()
                                }).catch(err => console.error('Failed to garbage collect:', err));
                                return false; // Exclude from everything
                            } else {
                                window.trashComandos.push({ ...cmd, deleted_at: parsedData.deleted_at });
                                return false; // Exclude from allComandos
                            }
                        }

                        // Normal visibility rules
                        if (parsedData.is_private && cmd.created_by_name !== userName && !isAdmin) {
                            return false;
                        }
                        return true;
                    });

                    allComandos.sort((a, b) => a.name.localeCompare(b.name));

                    const suggestionSet = new Set();
                    allComandos.forEach(sub => {
                        suggestionSet.add(sub.name);
                        const parsedData = parseCommandData(sub.command);
                        parsedData.subCommands.forEach(sc => suggestionSet.add(sc.name));
                    });
                    allSuggestions = [...suggestionSet];

                    render(allComandos);
                    isDataLoaded = true;
                } catch (error) {
                    console.error('Erro ao carregar dados', error);
                    if (error.message && error.message.toLowerCase().includes('jwt expired')) {
                        window.showCustomAlert('Sua sessão expirou por segurança. Faça login novamente.');
                        document.getElementById('logout-btn')?.click();
                    } else {
                        const infoMessage = document.getElementById('infoMessage');
                        infoMessage.textContent = 'Erro ao carregar banco de dados: ' + error.message;
                        document.getElementById('infoModal').classList.remove('hidden');
                    }
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
                return text.replace(regex, (match) => `<mark class="bg-transparent text-accent-solid font-semibold not-italic">${match}</mark>`);
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
                        <svg class="w-5 h-5 text-accent-solid flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
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
                        btn.className = `tab-btn-${subjectId} px-4 py-2 rounded-t-md rounded-b-none text-sm font-medium transition-colors border shrink-0 bg-bg-panel-active text-text-high border-border-element border-b-0 z-10 relative`;
                    } else {
                        btn.className = `tab-btn-${subjectId} px-4 py-2 rounded-t-md rounded-b-none text-sm font-medium transition-colors border shrink-0 bg-transparent border-border-element text-text-muted hover:bg-bg-panel hover:text-text-high`;
                    }
                });
            };

            
            window.showDescription = (encodedDesc, encodedMedia = '') => {
                document.getElementById('infoModalTitle').textContent = 'Descrição';
                const descText = decodeURIComponent(encodedDesc);
                const mediaUrl = encodedMedia ? decodeURIComponent(encodedMedia) : '';
                const infoMessage = document.getElementById('infoMessage');
                
                infoMessage.innerHTML = '';
                const p = document.createElement('p');
                p.className = 'whitespace-pre-wrap';
                p.textContent = descText;
                infoMessage.appendChild(p);
                
                if (mediaUrl) {
                    const div = document.createElement('div');
                    div.className = 'mt-4 border-t border-border-subtle pt-4 flex justify-center bg-black/10 rounded-lg p-2';
                    div.innerHTML = `<a href="${mediaUrl}" target="_blank" title="Clique para abrir imagem original"><img src="${mediaUrl}" class="max-w-full rounded hover:opacity-90 transition-opacity shadow-sm" style="max-height: 400px; object-fit: contain;"></a>`;
                    infoMessage.appendChild(div);
                }
                
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
                    const parsedData = parseCommandData(subject.command);
                    let subCommands = parsedData.subCommands;

                    const tabsHTML = subCommands.map((sc, scIdx) => {
                        const isActive = scIdx === 0;
                        const btnClass = isActive ? 'bg-bg-panel-active text-text-high border-border-element border-b-0 z-10 relative' : 'bg-transparent border-border-element text-text-muted hover:bg-bg-panel hover:text-text-high';
                        return `<button onclick="switchTab(event, '${subject.id}', ${scIdx})" class="tab-btn-${subject.id} px-4 py-2 rounded-t-md rounded-b-none text-sm font-medium transition-colors border shrink-0 ${btnClass}" style="margin-bottom: -1px;">${highlightMatch(sc.name, searchTerm)}</button>`;
                    }).join('');

                    const panelsHTML = subCommands.map((sc, scIdx) => {
                        let isSql = sc.name.toLowerCase().endsWith('.sql');
                        let isDownloadLink = false;
                        let displayText = (sc.text || '').trim();
                        
                        if (displayText.startsWith('http')) {
                            isDownloadLink = true;
                            if (displayText.includes('drive.google.com/file/d/')) {
                                const match = displayText.match(/\/file\/d\/([^\/]+)/);
                                if (match && match[1]) {
                                    displayText = 'https://drive.google.com/uc?export=download&id=' + match[1];
                                }
                            }
                        }

                        const encoded = encodeURIComponent(displayText);
                        const encodedDesc = encodeURIComponent(sc.desc || 'Descrição não informada.').replace(/'/g, "%27");
                        const encodedMedia = sc.media_url ? encodeURIComponent(sc.media_url).replace(/'/g, "%27") : '';
                        
                        const descHeaderHTML = (sc.desc && sc.desc.trim() !== '') ? `
                            <div class="inline-flex items-center gap-2 mb-2 p-2 -ml-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors group w-fit" onclick="showDescription('${encodedDesc}', '${encodedMedia}')">
                                <div class="w-6 h-6 rounded-full bg-orange-500 group-hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0 group-hover:scale-110 transition-all shadow-md" title="Ver descrição">!</div>
                                <span class="text-sm font-medium text-text-high group-hover:text-accent-solid transition-colors">Para que serve este comando?</span>
                                ${sc.media_url ? '<svg class="w-4 h-4 text-orange-400 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>' : ''}
                            </div>
                        ` : '';
                        
                        let actionBtn = '';
                        const historyBtnHTML = `
                                    <button onclick="event.stopPropagation(); viewHistory('${subject.id}', '${encodeURIComponent(subject.name.replace(/'/g, "\\'"))}')" class="px-3 py-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded hover:bg-orange-500/20 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center" title="Histórico">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Histórico
                                    </button>
                        `;

                        if (isSql) {
                            const fileName = sc.name.endsWith('.sql') ? sc.name : sc.name + '.sql';
                            actionBtn = `
                            <div class="relative flex flex-col items-center gap-2">
                                <button data-command="${encoded}" onclick="downloadFile(decodeURIComponent(this.getAttribute('data-command')), '${fileName}')" class="px-3 py-1 bg-accent-solid text-white rounded hover:opacity-90 transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center" title="Descarregar ficheiro">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download
                                </button>
                                ${historyBtnHTML}
                            </div>`;
                        } else if (isDownloadLink) {
                            actionBtn = `
                            <div class="relative flex flex-col items-center gap-2">
                                <a href="${displayText}" target="_blank" class="px-3 py-1 bg-bg-panel border border-border-element text-text-high rounded hover:bg-bg-solid-hover transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center" title="Download">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download
                                </a>
                                ${historyBtnHTML}
                            </div>`;
                        } else {
                            actionBtn = `
                            <div class="relative flex flex-col items-center gap-2">
                                <button data-command="${encoded}" onclick="copyCommand(decodeURIComponent(this.getAttribute('data-command')), this)" class="px-3 py-1 bg-bg-panel border border-border-element text-text-high rounded hover:bg-bg-solid-hover transition-colors text-xs font-semibold flex items-center gap-1 shrink-0 w-full justify-center" title="Copiar">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg> Copiar
                                </button>
                                ${historyBtnHTML}
                            </div>`;
                        }

                        const hiddenClass = scIdx === 0 ? '' : 'hidden';
                        
                        return `
                            <div id="panel-${subject.id}-${scIdx}" class="tab-panel-${subject.id} ${hiddenClass}">
                                ${descHeaderHTML}
                                <div class="flex justify-between items-start gap-4">
                                    ${(() => {
                                        const lines = displayText.split('\n');
                                        const formatComment = (text) => text.replace(/#([\s\S]*?)#/g, '<span class="text-orange-500 font-bold">#$1#</span>');
                                        
                                        if (lines.length > 10) {
                                            const previewText = lines.slice(0, 10).join('\n');
                                            return `
                                            <div class="relative w-full flex-grow min-w-0">
                                                <pre id="pre-preview-${subject.id}-${scIdx}" class="text-xs text-text-muted whitespace-pre-wrap font-mono p-3 pb-8 bg-black/5 rounded-md border border-border-subtle overflow-hidden">${formatComment(previewText)}</pre>
                                                <div id="pre-expand-overlay-${subject.id}-${scIdx}" class="absolute bottom-2 left-0 right-0 flex items-center justify-center">
                                                    <button onclick="expandCommand('${subject.id}', '${scIdx}')" class="text-accent-solid text-xs font-bold hover:underline bg-transparent border-none cursor-pointer">Expandir</button>
                                                </div>
                                                <pre id="pre-full-${subject.id}-${scIdx}" class="hidden text-xs text-text-muted whitespace-pre-wrap font-mono max-h-[300px] overflow-y-auto custom-scrollbar p-3 bg-black/5 rounded-md border border-border-subtle">${formatComment(displayText)}</pre>
                                            </div>
                                            `;
                                        } else {
                                            return `<pre class="text-xs text-text-muted whitespace-pre-wrap flex-grow min-w-0 font-mono overflow-y-auto custom-scrollbar p-3 bg-black/5 rounded-md border border-border-subtle w-full">${formatComment(displayText)}</pre>`;
                                        }
                                    })()}
                                    ${actionBtn}
                                </div>
                            </div>
                        `;
                    }).join('');

                    categoryElement.innerHTML = `
                    <div class="panel border border-border-subtle rounded-md mb-3 bg-white/5">
                        <div class="flex items-center justify-between p-3 cursor-pointer group hover:bg-white/10 transition-colors" onclick="if(event.target.closest('.action-buttons')) return; const content = this.nextElementSibling; content.classList.toggle('hidden'); this.querySelector('.cmd-chevron').classList.toggle('rotate-180'); if(content.classList.contains('hidden')){ content.querySelectorAll('[id^=\\'pre-preview-\\']').forEach(el => el.classList.remove('hidden')); content.querySelectorAll('[id^=\\'pre-expand-overlay-\\']').forEach(el => el.classList.remove('hidden')); content.querySelectorAll('[id^=\\'pre-full-\\']').forEach(el => el.classList.add('hidden')); }">
                            <div class="flex flex-col">
                                <span class="font-semibold text-text-high">${highlightMatch(subject.name, searchTerm)}</span>
                            </div>
                            <div class="flex items-center gap-4 action-buttons">
                                ${sessionUser?.email === 'visitante@lcsistemas.com' ? '' : `
                                <div class="flex items-center gap-2 overflow-hidden transition-all duration-300 max-w-0 opacity-0 action-drawer" id="drawer-${subject.id}">
                                    <button onclick="event.stopPropagation(); deleteCommand('${subject.id}')" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors whitespace-nowrap" title="Excluir">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Excluir
                                    </button>
                                    <button onclick="event.stopPropagation(); editCommand('${subject.id}')" class="px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium text-accent-solid border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors whitespace-nowrap" title="Editar">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Editar
                                    </button>
                                </div>
                                <button onclick="event.stopPropagation(); toggleActionDrawer('drawer-${subject.id}')" class="p-1 hover:bg-bg-solid-hover rounded transition-colors text-text-muted shrink-0" title="Opções">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                                </button>
                                `}
                                <svg class="cmd-chevron w-5 h-5 text-text-muted transition-transform duration-300 ${searchTerm.length > 0 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        <div class="${searchTerm.length > 0 ? '' : 'hidden'} pt-0 border-t border-border-subtle bg-[color:var(--bg-app)] rounded-b-md">
                            <div class="flex overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden gap-1 pt-3 px-3 border-b border-border-element">
                                ${tabsHTML}
                            </div>
                            <div class="panels-container p-3 bg-bg-panel-active rounded-b-md">
                                ${panelsHTML}
                            </div>
                        </div>
                    </div>
                    `;

                    categoriesContainer.appendChild(categoryElement);
                });
            };

            window.currentFilterTab = 'all';

            window.setFilterTab = (tab) => {
                window.currentFilterTab = tab;
                
                const tabAll = document.getElementById('tabFilterAll');
                const tabMine = document.getElementById('tabFilterMine');
                const indicator = document.getElementById('tabIndicator');
                
                if (tab === 'all') {
                    tabAll.className = "relative z-10 pb-3 text-sm font-semibold text-accent-solid transition-colors";
                    tabMine.className = "relative z-10 pb-3 text-sm font-semibold text-text-muted hover:text-text-high transition-colors";
                    if (indicator && tabAll.offsetWidth) {
                        indicator.style.width = tabAll.offsetWidth + 'px';
                        indicator.style.transform = `translateX(${tabAll.offsetLeft}px)`;
                    }
                } else {
                    tabMine.className = "relative z-10 pb-3 text-sm font-semibold text-accent-solid transition-colors";
                    tabAll.className = "relative z-10 pb-3 text-sm font-semibold text-text-muted hover:text-text-high transition-colors";
                    if (indicator && tabMine.offsetWidth) {
                        indicator.style.width = tabMine.offsetWidth + 'px';
                        indicator.style.transform = `translateX(${tabMine.offsetLeft}px)`;
                    }
                }
                
                handleSearch(); // Apply filter
            };

            // Initializar a posição da linha animada ao carregar
            setTimeout(() => {
                if (window.setFilterTab && window.currentFilterTab) {
                    window.setFilterTab(window.currentFilterTab);
                }
            }, 100);

            const handleSearch = () => {
                if (!isDataLoaded) return;
                const searchTerm = normalizeString(searchInput.value.trim());
                
                const searchResults = allComandos.filter(cmd => {
                    if (window.currentFilterTab === 'mine') {
                        const userName = sessionUser?.user_metadata?.name || sessionUser?.email?.split('@')[0] || 'Desconhecido';
                        if (cmd.created_by_name !== userName) {
                            return false;
                        }
                    }

                    if (!searchTerm) return true;

                    const catNameMatches = normalizeString(cmd.name).includes(searchTerm);
                    if (catNameMatches) return true;
                    
                    let subMatches = false;
                    try {
                        const parsedData = parseCommandData(cmd.command);
                        const scs = parsedData.subCommands;
                        if (Array.isArray(scs)) {
                            subMatches = scs.some(sc => {
                                const nameMatches = normalizeString(sc.name).includes(searchTerm);
                                const descMatches = sc.desc && normalizeString(sc.desc).includes(searchTerm);
                                const textMatches = sc.text && normalizeString(sc.text).includes(searchTerm);
                                return nameMatches || descMatches || textMatches;
                            });
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
                    if (!e.target.closest('.action-drawer') && !e.target.closest('button[onclick*="toggleActionDrawer"]')) {
                        document.querySelectorAll('.action-drawer').forEach(d => {
                            d.classList.add('max-w-0', 'opacity-0');
                            d.classList.remove('max-w-[200px]', 'opacity-100');
                        });
                    }
                    if (!e.target.closest('#user-menu-container')) {
                        const userDropdown = document.getElementById('user-dropdown');
                        if (userDropdown) {
                            userDropdown.classList.add('hidden');
                        }
                    }
                    if (!e.target.closest('header')) {
                        suggestionsContainer.classList.remove('expanded');
                    }
                });

                loadData();
            };

                window.renderTrashList = () => {
                    const list = document.getElementById('trashList');
                    list.innerHTML = '';
                    if (!window.trashComandos || window.trashComandos.length === 0) {
                        list.innerHTML = '<p class="text-text-muted text-center py-8">Nenhum comando na lixeira.</p>';
                        return;
                    }
                    window.trashComandos.forEach(cmd => {
                        const parsed = parseCommandData(cmd.command);
                        const deletedAt = new Date(parsed.deleted_at);
                        const expiresAt = new Date(deletedAt.getTime() + 48 * 60 * 60 * 1000);
                        
                        const div = document.createElement('div');
                        div.className = 'bg-bg-panel border border-border-element p-4 rounded-lg flex justify-between items-center';
                        div.innerHTML = `
                            <div>
                                <h4 class="font-medium text-text-high mb-1">${cmd.name}</h4>
                                <p class="text-xs text-text-muted">Deletado: ${deletedAt.toLocaleString()}</p>
                                <p class="text-xs text-red-400">Expira: ${expiresAt.toLocaleString()}</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="window.restoreCommand(${cmd.id})" class="p-2 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors" title="Restaurar">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                </button>
                                <button onclick="window.forceDeleteCommand(${cmd.id})" class="p-2 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors" title="Excluir Permanentemente">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        `;
                        list.appendChild(div);
                    });
                };

                document.getElementById('openTrashModalBtn')?.addEventListener('click', () => {
                    window.renderTrashList();
                    document.getElementById('trashModal').classList.remove('hidden');
                });

                document.getElementById('closeTrashBtn')?.addEventListener('click', () => {
                    document.getElementById('trashModal').classList.add('hidden');
                });

                window.restoreCommand = async (id) => {
                    try {
                        const headers = Object.assign(getAuthHeaders(), { 'Prefer': 'return=minimal' });
                        const resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${id}&select=command`, { headers: getAuthHeaders() });
                        if (!resCmd.ok) throw new Error('Erro ao buscar o comando');
                        const cmdDataArr = await resCmd.json();
                        if (cmdDataArr.length === 0) throw new Error('Comando não encontrado');
                        
                        const parsedData = parseCommandData(cmdDataArr[0].command);
                        delete parsedData.deleted_at;
                        
                        const res = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${id}`, {
                            method: 'PATCH',
                            headers: headers,
                            body: JSON.stringify({ command: JSON.stringify(parsedData) })
                        });
                        
                        if (!res.ok) throw new Error('Erro ao restaurar');
                        await loadData();
                        window.renderTrashList();
                    } catch (e) {
                        window.showCustomAlert('Erro: ' + e.message);
                    }
                };

                window.forceDeleteCommand = async (id) => {
                    if (!confirm('Deseja realmente excluir este comando permanentemente?')) return;
                    try {
                        // First, fetch the command to extract media URLs
                        const resCmd = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${id}&select=command`, { headers: getAuthHeaders() });
                        if (resCmd.ok) {
                            const cmdDataArr = await resCmd.json();
                            if (cmdDataArr.length > 0) {
                                const parsedData = parseCommandData(cmdDataArr[0].command);
                                if (parsedData && Array.isArray(parsedData.subCommands)) {
                                    for (const sc of parsedData.subCommands) {
                                        if (sc.media_url && sc.media_url.includes('/comandos-midia/')) {
                                            const oldFileName = sc.media_url.split('/').pop();
                                            if (oldFileName) {
                                                const deleteHeaders = getAuthHeaders();
                                                deleteHeaders['Content-Type'] = 'application/json';
                                                fetch(`${SUPABASE_URL}/storage/v1/object/comandos-midia`, {
                                                    method: 'DELETE',
                                                    headers: deleteHeaders,
                                                    body: JSON.stringify({ prefixes: [`uploads/${oldFileName}`] })
                                                }).then(async res => {
                                                    if (res.ok) {
                                                        console.log('Force delete media response:', await res.json());
                                                    }
                                                }).catch(err => console.warn('Erro ao deletar mídia antiga:', err));
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Now delete the command itself
                        const res = await fetch(`${SUPABASE_URL}/rest/v1/comandos?id=eq.${id}`, {
                            method: 'DELETE',
                            headers: getAuthHeaders()
                        });
                        if (!res.ok) throw new Error('Erro ao excluir');
                        await loadData();
                        window.renderTrashList();
                    } catch (e) {
                        window.showCustomAlert('Erro: ' + e.message);
                    }
                };

            initializeApp();
        });


// ==================== BASE DE CONHECIMENTO LOGIC ====================

        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'bg-app': 'var(--bg-app)',
                        'bg-subtle': 'var(--bg-subtle)',
                        'bg-panel': 'var(--bg-panel)',
                        'bg-panel-hover': 'var(--bg-panel-hover)',
                        'bg-panel-active': 'var(--bg-panel-active)',
                        'border-subtle': 'var(--border-subtle)',
                        'border-element': 'var(--border-element)',
                        'border-hover': 'var(--border-hover)',
                        'bg-solid': 'var(--bg-solid)',
                        'bg-solid-hover': 'var(--bg-solid-hover)',
                        'text-muted': 'var(--text-muted)',
                        'text-high': 'var(--text-high)',

                        'accent-app': 'var(--accent-app)',
                        'accent-subtle': 'var(--accent-subtle)',
                        'accent-panel': 'var(--accent-panel)',
                        'accent-panel-hover': 'var(--accent-panel-hover)',
                        'accent-panel-active': 'var(--accent-panel-active)',
                        'accent-border-subtle': 'var(--accent-border-subtle)',
                        'accent-border-element': 'var(--accent-border-element)',
                        'accent-border-hover': 'var(--accent-border-hover)',
                        'accent-solid': 'var(--accent-solid)',
                        'accent-solid-hover': 'var(--accent-solid-hover)',
                        'accent-text-muted': 'var(--accent-text-muted)',
                        'accent-text-high': 'var(--accent-text-high)',
                    }
                }
            }
        };
        document.addEventListener('DOMContentLoaded', () => {
            // --- Elementos do DOM ---
            const searchInput = document.getElementById('baseSearchInput');
            const categoriesContainer = document.getElementById('baseCategoriesContainer');
            const suggestionsContainer = document.getElementById('baseSuggestionsContainer');
            const infoModal = document.getElementById('infoModal');
            const infoMessage = document.getElementById('infoMessage');
            const infoOkBtn = document.getElementById('infoOkBtn');

            // --- Variáveis de Estado ---
            let categories = [];
            let allSuggestions = [];
            let activeSuggestionIndex = -1;
            let isDataLoaded = false;

            // --- MÓDULOS (Tema, Modal, WebGL) ---
            const ThemeSwitcher = (() => { const DOM = { body: document.body, themeToggleBtn: document.getElementById('theme-toggle-btn'), themeIconSun: document.getElementById('theme-icon-sun'), themeIconMoon: document.getElementById('theme-icon-moon') }; const STORAGE_KEY = 'themePreference'; const applyTheme = (theme) => { DOM.body.dataset.theme = theme; localStorage.setItem(STORAGE_KEY, theme); DOM.themeIconSun.classList.toggle('hidden', theme === 'dark'); DOM.themeIconMoon.classList.toggle('hidden', theme === 'light'); }; const toggleTheme = () => { const currentTheme = DOM.body.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(currentTheme); }; const init = () => { const savedTheme = localStorage.getItem(STORAGE_KEY) || 'dark'; applyTheme(savedTheme); DOM.themeToggleBtn.onclick = toggleTheme; }; return { init }; })();
            const showModal = (message) => { infoMessage.textContent = message; infoModal.classList.remove('hidden'); }; const hideModal = () => infoModal.classList.add('hidden'); infoOkBtn.addEventListener('click', hideModal);
            

            // --- LÓGICA DE DADOS ---
            const loadData = async () => {
                categoriesContainer.classList.add('loading');
                try {
                    const response = await fetch('./database.json');
                    if (!response.ok) throw new Error(`HTTP error!`);
                    const data = await response.json();
                    categories = data;
                    const suggestionSet = new Set();
                    categories.forEach(cat => { suggestionSet.add(cat.name); cat.subjects.forEach(sub => suggestionSet.add(sub.name)); });
                    allSuggestions = [...suggestionSet];
                    render(categories);
                    isDataLoaded = true;
                } catch (error) {
                    console.error("Erro ao carregar dados", error);
                    // showModal('Não foi possível carregar a base de conhecimento.');
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
                return text.replace(regex, (match) => `<mark class="bg-transparent text-accent-solid font-semibold not-italic">${match}</mark>`);
            };

            // --- LÓGICA DE SUGESTÕES (AUTOCOMPLETE) ---
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
                        <svg class="w-5 h-5 text-accent-solid flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
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
                    const message = searchTerm ? `Nenhum resultado encontrado para "${searchTerm}".` : "A base de conhecimento está vazia.";
                    categoriesContainer.innerHTML = `<div class="text-center text-text-muted py-10">${message}</div>`;
                    return;
                }
                dataToRender.forEach(category => {
                    const isExpanded = searchTerm.length > 0 ? true : (category.expanded || false);
                    const categoryElement = document.createElement('div');
                    categoryElement.className = 'panel rounded-lg';
                    const subjectsToDisplay = category.subjectsToDisplay || category.subjects;
                    const subjectsHTML = subjectsToDisplay.length > 0
                        ? subjectsToDisplay.map((subject) => `<li class="flex items-center justify-between text-text-high ml-2 p-1 rounded-md"><span class="truncate pr-2">${highlightMatch(subject.name, searchTerm)}</span></li>`).join('')
                        : '<li class="text-text-muted text-sm ml-2">Nenhum assunto nesta categoria.</li>';

                    categoryElement.innerHTML = `
                        <div class="group flex items-center justify-between p-4 cursor-pointer category-header" data-id="${category.id}">
                            <h3 class="text-lg font-semibold truncate pr-2">${highlightMatch(category.name, searchTerm)}</h3>
                            <div class="flex items-center gap-3">
                                <svg class="w-6 h-6 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                        </div>
                        <div class="subject-list ${isExpanded ? 'expanded' : ''}">
                            <div><div class="p-4 border-t" style="border-color: var(--border-subtle);"><ul class="space-y-1 mb-4">${subjectsHTML}</ul></div></div>
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

            categoriesContainer.addEventListener('click', (e) => {
                const header = e.target.closest('.category-header');
                if (header) {
                    const categoryId = Number(header.dataset.id);
                    const category = categories.find(c => c.id === categoryId);
                    if (category) {
                        category.expanded = !category.expanded;
                        const subjectList = header.nextElementSibling;
                        const icon = header.querySelector('svg');
                        if (subjectList) {
                            subjectList.classList.toggle('expanded');
                        }
                        if (icon) {
                            icon.classList.toggle('rotate-180');
                        }
                    }
                }
            });

            // --- INICIALIZAÇÃO DA APLICAÇÃO ---
            const initializeApp = () => {
                ThemeSwitcher.init();
                

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
                    if (!e.target.closest('#user-menu-container')) {
                        const dropdown = document.getElementById('user-dropdown');
                        if(dropdown) dropdown.classList.add('hidden');
                    }
                });

                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) {
                    logoutBtn.addEventListener('click', () => {
                        sessionStorage.removeItem('supabaseToken');
                        sessionStorage.removeItem('userData');
                        window.location.replace('index.html');
                    });
                }

                const sessionUserString = sessionStorage.getItem('supabaseUser');
                if (sessionUserString) {
                    try {
                        const sessionUser = JSON.parse(sessionUserString);
                        if (sessionUser) {
                            const name = sessionUser.user_metadata?.name || sessionUser.email?.split('@')[0] || 'User';
                            document.getElementById('user-name-display').textContent = name;
                            document.getElementById('user-avatar').textContent = name.charAt(0).toUpperCase();
                        }
                    } catch(e) {}
                }
                
                const userMenuContainer = document.getElementById('user-menu-container');
                if (userMenuContainer) {
                    userMenuContainer.classList.remove('hidden');
                }

                loadData();
            };

            initializeApp();
        });

// ==================== TAB SWITCHING LOGIC ====================
document.addEventListener('DOMContentLoaded', () => {
    const navBaseTab = document.getElementById('nav-base-tab');
    const navComandosTab = document.getElementById('nav-comandos-tab');
    
    const viewBase = document.getElementById('view-base');
    const viewComandos = document.getElementById('view-comandos');
    
    function switchTab(tab) {
        if (tab === 'base') {
            viewBase.classList.remove('hidden');
            viewComandos.classList.add('hidden');
            
            navBaseTab.classList.add('tab-active');
            navBaseTab.classList.remove('tab-inactive');
            navComandosTab.classList.add('tab-inactive');
            navComandosTab.classList.remove('tab-active');
        } else {
            viewComandos.classList.remove('hidden');
            viewBase.classList.add('hidden');
            
            navComandosTab.classList.add('tab-active');
            navComandosTab.classList.remove('tab-inactive');
            navBaseTab.classList.add('tab-inactive');
            navBaseTab.classList.remove('tab-active');
        }
    }
    
    if (navBaseTab && navComandosTab) {
        navBaseTab.addEventListener('click', () => switchTab('base'));
        navComandosTab.addEventListener('click', () => switchTab('comandos'));
    }
});
