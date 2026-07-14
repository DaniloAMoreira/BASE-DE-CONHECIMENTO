import re

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace view-comandos header
cmd_header_old = """<header class="mb-6">
                    

                    <div class="relative flex gap-6 mb-6 px-1 w-max">
                        <button id="tabFilterAll" onclick="window.setFilterTab('all')" class="relative z-10 pb-3 text-sm font-semibold text-accent-solid transition-colors">Todos os Comandos</button>
                        <button id="tabFilterMine" onclick="window.setFilterTab('mine')" class="relative z-10 pb-3 text-sm font-semibold text-text-muted hover:text-text-high transition-colors">Meus Comandos</button>
                        <div id="tabIndicator" class="absolute bottom-0 left-0 h-0.5 bg-accent-solid transition-all duration-300 pointer-events-none" style="width: 0px; transform: translateX(0px); transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
                    </div>

                    <div class="relative flex gap-2 w-full items-center">
                        <div class="relative flex-grow">
                            <input type="text" id="cmdSearchInput" placeholder="Pesquisar por categorias e comandos..."
                                class="w-full bg-bg-panel border border-transparent rounded-lg pl-10 pr-4 py-3 focus:border-transparent text-text-high transition-all duration-300 placeholder:text-text-muted"
                                style="outline: none !important; box-shadow: none !important;"
                                autocomplete="off">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg class="w-5 h-5 search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>
                        </div>
                        
                        <div class="relative flex gap-2">
                            <button id="openAddModalBtn" class="bg-accent-solid text-white p-3 rounded-lg hover:opacity-90 transition-opacity" title="Adicionar Comando">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div id="cmdSuggestionsContainer" class="mt-1"></div>
                </header>"""

cmd_header_new = """<header class="mb-6">
                    <div class="relative flex gap-6 mb-6 px-1 w-max">
                        <button id="tabFilterAll" onclick="window.setFilterTab('all')" class="relative z-10 pb-3 text-sm font-semibold text-accent-solid transition-colors">Todos os Comandos</button>
                        <button id="tabFilterMine" onclick="window.setFilterTab('mine')" class="relative z-10 pb-3 text-sm font-semibold text-text-muted hover:text-text-high transition-colors">Meus Comandos</button>
                        <div id="tabIndicator" class="absolute bottom-0 left-0 h-0.5 bg-accent-solid transition-all duration-300 pointer-events-none" style="width: 0px; transform: translateX(0px); transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);"></div>
                    </div>

                    <div class="relative flex gap-2 w-full items-center">
                        <div class="relative flex-grow">
                            <input type="text" id="cmdSearchInput" placeholder="Pesquisar por categorias e comandos..."
                                class="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:border-white/20 hover:bg-white/10 focus:bg-white/10 text-white transition-all duration-300 placeholder:text-white/50"
                                style="outline: none !important; box-shadow: none !important;"
                                autocomplete="off">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg class="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>
                        </div>
                        
                        <div class="relative flex gap-2">
                            <button id="openAddModalBtn" class="bg-accent-solid text-white p-3 rounded-lg hover:opacity-90 transition-opacity" title="Adicionar Comando">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div id="cmdSuggestionsContainer" class="mt-1"></div>
                </header>"""

# Replace view-base header
base_header_old = """<header class="mb-6">
                    
                    <div class="relative">
                        <input type="text" id="baseSearchInput" placeholder="Pesquisar por categorias e assuntos..."
                            class="w-full rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent transition-all duration-300"
                            autocomplete="off">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="w-5 h-5 search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                    </div>
                    <div id="baseSuggestionsContainer" class="mt-1"></div>
                </header>"""

base_header_new = """<header class="mb-6">
                    <div class="relative flex gap-6 mb-6 px-1 w-max invisible pointer-events-none select-none">
                        <button class="relative z-10 pb-3 text-sm font-semibold">Spacer</button>
                    </div>
                    
                    <div class="relative flex gap-2 w-full items-center">
                        <div class="relative flex-grow">
                            <input type="text" id="baseSearchInput" placeholder="Pesquisar por categorias e assuntos..."
                                class="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-lg pl-10 pr-4 py-3 focus:border-white/20 hover:bg-white/10 focus:bg-white/10 text-white transition-all duration-300 placeholder:text-white/50"
                                style="outline: none !important; box-shadow: none !important;"
                                autocomplete="off">
                            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg class="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="relative flex gap-2 invisible pointer-events-none select-none">
                            <button class="p-3 rounded-lg">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                            </button>
                        </div>
                    </div>
                    <div id="baseSuggestionsContainer" class="mt-1"></div>
                </header>"""

html = html.replace(cmd_header_old, cmd_header_new)
html = html.replace(base_header_old, base_header_new)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
