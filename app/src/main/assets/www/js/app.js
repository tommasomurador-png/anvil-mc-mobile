import {
  store,
  parseMinecraftText,
  formatDuration,
  triggerHaptic,
  getDeviceFreeRamMb
} from './state.js';
import { searchModrinthPaginated, formatDownloadsIt, formatBytesIt } from './api.js';

class AnvilAppV207 {
  constructor() {
    this.activeTab = 'home'; // 'home' | 'console' | 'create' | 'files' | 'profile'
    this.settingsSubPage = null; // null | 'menu' | 'generale' | 'gioco' | 'mondo' | 'mods' | 'software' | 'prestazioni' | 'rete' | 'backup' | 'automazione'
    this.modsSubTab = 'mods'; // 'mods' | 'datapacks'
    this.modrinthSearchOpen = false;
    this.modrinthQuery = '';
    this.modrinthPage = 0;
    this.modrinthResults = [];
    this.modrinthTotal = 0;
    this.modrinthLoading = false;

    // Console state
    this.consoleSearchOpen = false;
    this.consoleSearchQuery = '';
    this.consoleFilter = 'all'; // 'all' | 'info' | 'warn'

    // Create Server & 8-Step Guided Setup
    this.createFlowStep = 0; // 0 = Hub "Come vuoi iniziare?", 1..8 = 8 Passi Setup Guidato
    this.wizardData = this.getDefaultWizardData();

    // File Manager state
    this.fileCurrentServerId = null; // null = root Home list of servers, or server.id = inside Home > Hub Creativo
    this.fileSearchQuery = '';
    this.fileSortBy = 'name'; // 'name' | 'recent' | 'size'
    this.fileMultiSelect = false;
    this.fileSelectedSet = new Set();
    this.editingFileName = null;

    // Modals & Bottom Sheets
    this.activeModal = null;
    this.premiumPlan = 'annual'; // 'monthly' | 'annual'
    this.playersFilter = 'online'; // 'online' | 'all' | 'whitelist' | 'admin' | 'banned'
    this.playersSearch = '';

    this.init();
  }

  getDefaultWizardData() {
    return {
      name: 'Mondo Sopravvivenza',
      motd: '§aUn server Minecraft su Android §7• §eAnvil-MC',
      software: 'Fabric ottimizzato',
      eulaAccepted: false,
      version: '26.3',
      performanceMode: true,
      ramGb: 2.0,
      ramPreset: 'Consigliato',
      gamemode: 'Sopravvivenza',
      difficulty: 'Normale',
      worldType: 'Normale',
      seed: '',
      onlineMode: true,
      skinRestorer: true,
      whitelistEnabled: false,
      whitelistPlayers: [],
      sleepIfEmpty: true,
      geyserEnabled: false,
      voiceChatEnabled: false,
      squaremapEnabled: false,
      pregenerateChunky: false,
      tunnelRegion: 'EU'
    };
  }

  init() {
    window.AnvilApp = this;
    this.bindDesktopToolbar();
    this.renderHeader();
    this.renderBottomNav();
    this.renderViewport();

    store.subscribe((state, event, payload) => {
      this.renderHeader();
      this.renderBottomNav();
      if (event === 'live-tick' || event === 'boot-tick') {
        this.updateLiveDomMetrics();
        if (this.activeTab === 'console' && event === 'boot-tick') {
          this.renderViewport(false);
        }
      } else if (event === 'boot-completed') {
        this.renderViewport(false);
        this.openFriendsJoinSheet();
      } else {
        this.renderViewport(false);
      }
    });
  }

  bindDesktopToolbar() {
    document.getElementById('btn-toggle-fullscreen')?.addEventListener('click', () => {
      document.body.classList.toggle('is-fullscreen');
      triggerHaptic('TICK');
    });
  }

  handleBackNavigation() {
    if (this.activeModal) {
      this.closeModal();
      return true;
    }
    if (this.editingFileName) {
      this.editingFileName = null;
      this.renderViewport(true);
      return true;
    }
    if (this.activeTab === 'home' && this.settingsSubPage) {
      if (this.settingsSubPage === 'menu') {
        this.settingsSubPage = null;
      } else {
        this.settingsSubPage = 'menu';
      }
      this.renderViewport(true);
      return true;
    }
    if (this.activeTab === 'create' && this.createFlowStep > 0) {
      this.createFlowStep -= 1;
      this.renderViewport(true);
      return true;
    }
    if (this.activeTab === 'files' && this.fileCurrentServerId) {
      this.fileCurrentServerId = null;
      this.fileMultiSelect = false;
      this.fileSelectedSet.clear();
      this.renderViewport(true);
      return true;
    }
    if (this.activeTab !== 'home') {
      this.switchTab('home');
      return true;
    }
    return false;
  }

  showToast(msg) {
    const toast = document.getElementById('global-toast');
    const toastMsg = document.getElementById('global-toast-msg');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2800);
  }

  shareTextNativeOrWeb(title, text) {
    triggerHaptic('TICK');
    if (window.AnvilNative && typeof window.AnvilNative.shareText === 'function') {
      window.AnvilNative.shareText(title, text);
      return;
    }
    if (navigator.share) {
      navigator.share({ title, text }).catch(() => {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    this.showToast(`Copiato negli appunti: ${text}`);
  }

  switchTab(tab) {
    triggerHaptic('TICK');
    this.activeTab = tab;
    if (tab !== 'home') {
      this.settingsSubPage = null;
    }
    if (tab === 'create') {
      this.createFlowStep = 0;
    }
    this.renderBottomNav();
    this.renderViewport(true);
  }

  /* =========================================================================
   * TOP FIXED HEADER ("anvil-mc" + "🌐 Tunnel: EU ▾" + Discord)
   * ========================================================================= */
  renderHeader() {
    const el = document.getElementById('app-header-content');
    if (!el) return;
    const region = store.state.tunnelRegion || 'EU';

    el.innerHTML = `
      <button type="button" id="hdr-brand-logo" class="tactile-btn flex items-center gap-2 text-left">
        <span class="font-extrabold text-[20px] tracking-tight text-[#22C55E]">anvil-mc</span>
        ${store.state.isPremium ? '<span class="px-1.5 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] text-[9px] font-bold">PRO</span>' : ''}
      </button>

      <div class="flex items-center gap-2">
        <button type="button" id="hdr-tunnel-pill" class="tactile-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#15181C] border border-[#262B33] hover:border-[#22C55E]/50 text-xs font-semibold text-[#F8FAFC]">
          <span>🌐 Tunnel: <strong class="text-[#22C55E]">${region}</strong></span>
          <span class="text-[#94A3B8] text-[10px]">▾</span>
        </button>

        <button type="button" id="hdr-discord-btn" title="Unisciti al Discord di Anvil-MC" class="tactile-btn w-8 h-8 rounded-full bg-[#15181C] border border-[#262B33] hover:border-[#5865F2] flex items-center justify-center text-[#94A3B8] hover:text-white">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
        </button>
      </div>
    `;

    document.getElementById('hdr-brand-logo')?.addEventListener('click', () => {
      this.settingsSubPage = null;
      this.switchTab('home');
    });
    document.getElementById('hdr-tunnel-pill')?.addEventListener('click', () => this.openTunnelSelectorSheet());
    document.getElementById('hdr-discord-btn')?.addEventListener('click', () => {
      this.showToast('Comunità Discord Anvil-MC (discord.gg/anvil-mc)');
    });
  }

  /* =========================================================================
   * BOTTOM NAVIGATION BAR (Home, Console, + Crea, File, Profilo)
   * ========================================================================= */
  renderBottomNav() {
    const nav = document.getElementById('app-bottom-nav');
    if (!nav) return;

    const itemClass = (id) =>
      `tactile-btn flex flex-col items-center justify-center min-w-[56px] py-1 ${
        this.activeTab === id ? 'text-[#22C55E] font-bold' : 'text-[#94A3B8] hover:text-white font-medium'
      }`;

    nav.innerHTML = `
      <button type="button" data-tab="home" class="${itemClass('home')}">
        <span class="material-symbols-outlined text-[21px]">home</span>
        <span class="text-[10px] mt-0.5">Home</span>
      </button>

      <button type="button" data-tab="console" class="${itemClass('console')}">
        <span class="material-symbols-outlined text-[21px]">terminal</span>
        <span class="text-[10px] mt-0.5">Console</span>
      </button>

      <div class="flex flex-col items-center justify-center -mt-4">
        <button type="button" data-tab="create" class="tactile-btn w-12 h-12 rounded-full bg-[#22C55E] text-[#0B0D0E] flex items-center justify-center shadow-[0_4px_18px_rgba(34,197,94,0.45)] border-4 border-[#0B0D0E]">
          <span class="material-symbols-outlined text-[26px] font-bold">add</span>
        </button>
        <span class="text-[10px] mt-0.5 ${this.activeTab === 'create' ? 'text-[#22C55E] font-bold' : 'text-[#94A3B8]'}">Crea</span>
      </div>

      <button type="button" data-tab="files" class="${itemClass('files')}">
        <span class="material-symbols-outlined text-[21px]">folder</span>
        <span class="text-[10px] mt-0.5">File</span>
      </button>

      <button type="button" data-tab="profile" class="${itemClass('profile')}">
        <span class="material-symbols-outlined text-[21px]">person</span>
        <span class="text-[10px] mt-0.5">Profilo</span>
      </button>
    `;

    nav.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.switchTab(btn.getAttribute('data-tab'));
      });
    });
  }

  renderViewport(animate = false) {
    const vp = document.getElementById('app-main-viewport');
    if (!vp) return;
    if (animate) {
      vp.classList.remove('view-animate');
      void vp.offsetWidth;
      vp.classList.add('view-animate');
    }

    if (this.activeTab === 'home') {
      if (this.settingsSubPage) {
        this.renderSettingsFlow(vp);
      } else {
        this.renderHomeScreen(vp);
      }
    } else if (this.activeTab === 'console') {
      this.renderConsoleScreen(vp);
    } else if (this.activeTab === 'create') {
      this.renderCreateScreen(vp);
    } else if (this.activeTab === 'files') {
      this.renderFilesScreen(vp);
    } else if (this.activeTab === 'profile') {
      this.renderProfileScreen(vp);
    }
  }

  updateLiveDomMetrics() {
    const srv = store.getActiveServer();
    if (!srv) return;
    const timerEl = document.getElementById('live-srv-timer');
    const cpuEl = document.getElementById('live-srv-cpu');
    const tpsEl = document.getElementById('live-srv-tps');
    const ramEl = document.getElementById('live-srv-ram');

    if (timerEl) {
      if (srv.status === 'online') {
        timerEl.textContent = `ONLINE (LOCALE) — ${formatDuration(srv.uptimeSeconds)}`;
      } else if (srv.status === 'starting') {
        timerEl.textContent = `AVVIO SERVER... — ${formatDuration(srv.uptimeSeconds)}`;
      }
    }
    if (cpuEl) cpuEl.textContent = `${srv.cpuPercent}%`;
    if (tpsEl && srv.status === 'online') tpsEl.textContent = srv.tps;
    if (ramEl) ramEl.textContent = `${srv.ramMb}MB`;
  }

  /* =========================================================================
   * SCHERMATA 1: HOME (Server Card, Boot Sequence, Empty State)
   * ========================================================================= */
  renderHomeScreen(container) {
    const servers = store.state.servers;

    // Empty State when no servers exist
    if (!servers || servers.length === 0) {
      container.innerHTML = `
        <div class="flex flex-col gap-4 py-3">
          <div class="p-5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col items-center text-center gap-3">
            <div class="w-14 h-14 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/30 flex items-center justify-center text-3xl">
              ⚡
            </div>
            <h1 class="text-lg font-extrabold text-[#F8FAFC]">Benvenuto in Anvil-MC</h1>
            <p class="text-xs text-[#94A3B8] leading-relaxed">
              Avvia server Minecraft direttamente dal tuo Android. Nessun PC o port forwarding richiesto.
            </p>

            <!-- Server Setup Tutorial Card -->
            <div class="w-full p-3.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center gap-3 text-left mt-1">
              <div class="w-10 h-10 rounded-xl bg-[#22C55E]/20 text-[#22C55E] flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined">play_circle</span>
              </div>
              <div class="flex flex-col flex-1 min-w-0">
                <span class="text-xs font-bold text-white">Server Setup Tutorial</span>
                <span class="text-[11px] text-[#94A3B8]">Guida rapida in 2 minuti per ospitare il tuo mondo</span>
              </div>
              <span class="material-symbols-outlined text-[#94A3B8] text-[18px]">chevron_right</span>
            </div>

            <button type="button" id="btn-empty-create" class="tactile-btn w-full py-3.5 mt-1 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs tracking-wide flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(34,197,94,0.35)]">
              <span>⊕ CREA IL TUO PRIMO SERVER</span>
            </button>
          </div>
        </div>
      `;
      document.getElementById('btn-empty-create')?.addEventListener('click', () => {
        this.wizardData = this.getDefaultWizardData();
        this.createFlowStep = 1;
        this.activeTab = 'create';
        this.renderBottomNav();
        this.renderViewport(true);
      });
      return;
    }

    const srv = store.getActiveServer();
    const isOnline = srv.status === 'online';
    const isStopping = srv.status === 'stopping';
    const isStarting = srv.status === 'starting';
    const onlinePlayersCount = srv.players.filter(p => p.online && !p.banned).length;

    container.innerHTML = `
      <div class="flex flex-col gap-3 pb-6">
        ${servers.length > 1 ? `
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
            ${servers.map(s => `
              <button type="button" data-home-srv="${s.id}" class="tactile-btn px-3 py-1.5 rounded-xl text-xs font-bold border shrink-0 flex items-center gap-1.5 ${
                s.id === srv.id ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#15181C] border-[#262B33] text-[#94A3B8]'
              }">
                <span>${s.iconEmoji || '🏰'}</span>
                <span>${s.name}</span>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Top Banner: Gioca con gli amici - Ottieni un IP pubblico gratuito -->
        <div class="p-3 rounded-xl bg-[#15181C] border border-[#22C55E]/35 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-base">🌐</span>
            <div class="flex flex-col min-w-0">
              <span class="text-xs font-bold text-[#F8FAFC] truncate">Gioca con gli amici</span>
              <span class="text-[11px] text-[#94A3B8] truncate">${srv.publicDomain ? `Attivo: ${srv.publicDomain}` : 'Ottieni un IP pubblico gratuito'}</span>
            </div>
          </div>
          <button type="button" id="btn-get-domain-banner" class="tactile-btn px-2.5 py-1.5 rounded-lg bg-[#22C55E] text-[#0B0D0E] font-extrabold text-[10px] tracking-wide shrink-0">
            OTTIENI DOMINIO
          </button>
        </div>

        <!-- MAIN SERVER CARD -->
        <div class="rounded-2xl bg-[#15181C] border border-[#262B33] p-4 flex flex-col gap-3.5 shadow-xl">
          <!-- Status Row -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              ${isOnline ? `
                <span class="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_#22C55E] animate-pulse"></span>
                <span id="live-srv-timer" class="font-mono text-xs font-bold text-[#22C55E]">ONLINE (LOCALE) — ${formatDuration(srv.uptimeSeconds)}</span>
              ` : isStopping ? `
                <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-ping"></span>
                <span class="font-mono text-xs font-bold text-[#F59E0B]">🟠 ARRESTO...</span>
              ` : isStarting ? `
                <span class="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-ping"></span>
                <span id="live-srv-timer" class="font-mono text-xs font-bold text-[#F59E0B]">🟠 AVVIO SERVER... — ${formatDuration(srv.uptimeSeconds)}</span>
              ` : `
                <span class="w-2.5 h-2.5 rounded-full bg-[#94A3B8]"></span>
                <span class="font-mono text-xs font-bold text-[#94A3B8]">⚪ OFFLINE</span>
              `}
            </div>
            <button type="button" id="btn-diag-help" title="Diagnostica connessione" class="tactile-btn w-6 h-6 rounded-full bg-[#1C2026] border border-[#262B33] text-[#94A3B8] hover:text-white flex items-center justify-center text-xs font-bold">
              ?
            </button>
          </div>

          <!-- Server Title & Subtitle -->
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center justify-center text-2xl shrink-0">
              ${srv.iconEmoji || '🏰'}
            </div>
            <div class="flex flex-col min-w-0">
              <h2 class="text-base font-extrabold text-[#F8FAFC] truncate">${srv.name}</h2>
              <p class="text-xs text-[#94A3B8] truncate">${srv.software} ${srv.version} • Max ${srv.maxPlayers} giocatori</p>
            </div>
          </div>

          <!-- IP LOCALE Row -->
          <div class="p-2.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="px-2 py-0.5 rounded bg-[#262B33] text-[#94A3B8] font-mono text-[10px] font-bold shrink-0">IP LOCALE</span>
              <span class="font-mono text-xs font-bold text-[#F8FAFC] truncate select-all">${srv.publicDomain || srv.localIp}</span>
            </div>
            <button type="button" id="btn-share-ip" class="tactile-btn p-1.5 rounded-lg bg-[#15181C] border border-[#262B33] text-[#94A3B8] hover:text-[#22C55E] flex items-center justify-center" title="Condividi IP">
              <span class="material-symbols-outlined text-[16px]">share</span>
            </button>
          </div>

          <!-- Upsell Premium Row -->
          <button type="button" id="btn-upsell-premium" class="tactile-btn w-full px-3 py-2 rounded-xl bg-[#1C2026]/70 border border-[#262B33] hover:border-[#22C55E]/50 flex items-center justify-between text-xs">
            <span class="font-bold text-[#F59E0B] flex items-center gap-1.5">👑 Premium</span>
            <span class="text-[#22C55E] font-semibold">Ottieni IP personalizzato →</span>
          </button>

          <!-- Clickable Players Box -->
          <button type="button" id="btn-manage-players" class="tactile-btn w-full p-3 rounded-xl bg-[#1C2026] border border-[#262B33] hover:border-[#22C55E]/40 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[#22C55E] text-[18px]">group</span>
              <span class="text-xs font-bold text-[#F8FAFC]">${onlinePlayersCount} / ${srv.maxPlayers} online</span>
            </div>
            <span class="text-xs font-semibold text-[#94A3B8]">Gestisci giocatori →</span>
          </button>

          <!-- 3-Box Telemetry Grid (CPU, TPS, RAM) -->
          <div class="grid grid-cols-3 gap-2">
            <div class="p-2.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex flex-col items-center justify-center">
              <span class="text-[10px] font-mono text-[#94A3B8] uppercase">CPU</span>
              <span id="live-srv-cpu" class="font-mono text-sm font-extrabold text-[#F8FAFC] mt-0.5">${isOnline || isStarting ? srv.cpuPercent + '%' : '0%'}</span>
            </div>

            <div class="p-2.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex flex-col items-center justify-center relative overflow-hidden">
              <span class="text-[10px] font-mono text-[#94A3B8] uppercase">TPS</span>
              ${isStarting ? `
                <span class="font-mono text-sm font-extrabold text-[#94A3B8] mt-0.5">-</span>
                <div class="w-full h-1 bg-[#262B33] rounded-full overflow-hidden mt-1">
                  <div class="w-1/2 h-full bg-[#22C55E] rounded-full boot-bar-anim"></div>
                </div>
              ` : `
                <span id="live-srv-tps" class="font-mono text-sm font-extrabold ${isOnline ? 'text-[#22C55E]' : 'text-[#94A3B8]'} mt-0.5">${isOnline ? srv.tps : '-'}</span>
              `}
            </div>

            <div class="p-2.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex flex-col items-center justify-center">
              <span class="text-[10px] font-mono text-[#94A3B8] uppercase">RAM</span>
              <span id="live-srv-ram" class="font-mono text-sm font-extrabold text-[#F8FAFC] mt-0.5">${isOnline || isStarting ? srv.ramMb + 'MB' : '0MB'}</span>
            </div>
          </div>

          <!-- Action Bar: Large Primary Button + 3 Square Icon Buttons -->
          <div class="flex items-center gap-2 pt-1">
            ${isOnline ? `
              <button type="button" id="btn-srv-stop" class="tactile-btn flex-1 h-11 rounded-xl bg-[#EF4444] hover:bg-red-600 text-white font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(239,68,68,0.3)]">
                <span>⏹ FERMA</span>
              </button>
            ` : isStopping ? `
              <button type="button" disabled class="flex-1 h-11 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B] text-[#F59E0B] font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5">
                <span>SALVATAGGIO...</span>
              </button>
            ` : isStarting ? `
              <button type="button" id="btn-srv-stop" class="tactile-btn flex-1 h-11 rounded-xl bg-[#F59E0B] text-[#0B0D0E] font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5">
                <span>⏹ ANNULLA AVVIO</span>
              </button>
            ` : `
              <button type="button" id="btn-srv-start" class="tactile-btn flex-1 h-11 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-[#0B0D0E] font-extrabold text-xs tracking-wider flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(34,197,94,0.35)]">
                <span>▷ AVVIA</span>
              </button>
            `}

            <!-- 3 Square Icon Buttons: Cartella (File), Ingranaggio (Impostazioni), Cestino (Elimina) -->
            <button type="button" id="btn-card-files" title="File del server" class="tactile-btn w-11 h-11 rounded-xl bg-[#1C2026] border border-[#262B33] hover:border-[#22C55E]/50 flex items-center justify-center text-[#F8FAFC]">
              <span class="material-symbols-outlined text-[20px]">folder</span>
            </button>
            <button type="button" id="btn-card-settings" title="Impostazioni server" class="tactile-btn w-11 h-11 rounded-xl bg-[#1C2026] border border-[#262B33] hover:border-[#22C55E]/50 flex items-center justify-center text-[#F8FAFC]">
              <span class="material-symbols-outlined text-[20px]">settings</span>
            </button>
            <button type="button" id="btn-card-delete" title="Elimina server" class="tactile-btn w-11 h-11 rounded-xl bg-[#1C2026] border border-[#262B33] hover:border-[#EF4444]/60 flex items-center justify-center text-[#EF4444]">
              <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind events
    container.querySelectorAll('[data-home-srv]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.state.activeServerId = btn.getAttribute('data-home-srv');
        store.notify('server-switched');
      });
    });

    document.getElementById('btn-get-domain-banner')?.addEventListener('click', () => this.openFriendsJoinSheet());
    document.getElementById('btn-diag-help')?.addEventListener('click', () => this.openDiagnosticHelpSheet());
    document.getElementById('btn-share-ip')?.addEventListener('click', () => {
      this.shareTextNativeOrWeb(`Server Minecraft ${srv.name}`, `Entra nel mio server Minecraft su Anvil-MC! IP: ${srv.publicDomain || srv.localIp}`);
    });
    document.getElementById('btn-upsell-premium')?.addEventListener('click', () => this.openPremiumPaywallModal());
    document.getElementById('btn-manage-players')?.addEventListener('click', () => this.openPlayersBottomSheet());

    document.getElementById('btn-srv-stop')?.addEventListener('click', () => store.stopServer(srv.id));
    document.getElementById('btn-srv-start')?.addEventListener('click', () => store.startServer(srv.id));

    document.getElementById('btn-card-files')?.addEventListener('click', () => {
      this.fileCurrentServerId = srv.id;
      this.switchTab('files');
    });

    // Safety lock when server is ONLINE
    document.getElementById('btn-card-settings')?.addEventListener('click', () => {
      if (srv.status !== 'offline') {
        triggerHaptic('ERROR');
        this.showToast('Il server deve essere offline per modificare le impostazioni');
        return;
      }
      triggerHaptic('TICK');
      this.settingsSubPage = 'menu';
      this.renderViewport(true);
    });

    document.getElementById('btn-card-delete')?.addEventListener('click', () => {
      this.openDeleteHoldSheet(srv);
    });
  }

  /* =========================================================================
   * MENU "IMPOSTAZIONI" DEL SERVER (9 Sotto-pagine Navigabili)
   * ========================================================================= */
  renderSettingsFlow(container) {
    const srv = store.getActiveServer();
    if (!srv) {
      this.settingsSubPage = null;
      this.renderHomeScreen(container);
      return;
    }

    if (this.settingsSubPage === 'menu') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          <!-- Back Bar -->
          <div class="flex items-center gap-2">
            <button type="button" id="btn-settings-back" class="tactile-btn w-9 h-9 rounded-xl bg-[#15181C] border border-[#262B33] flex items-center justify-center text-white">
              <span class="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <h1 class="text-base font-extrabold text-[#F8FAFC]">Impostazioni — ${srv.name}</h1>
          </div>

          <!-- Card Header Cliccabile (Generale) -->
          <button type="button" data-open-subpage="generale" class="tactile-btn w-full p-4 rounded-2xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E]/50 flex flex-col gap-3 text-left">
            <div class="flex items-center justify-between w-full">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-12 h-12 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center justify-center text-2xl shrink-0">
                  ${srv.iconEmoji || '🏰'}
                </div>
                <div class="flex flex-col min-w-0">
                  <span class="text-base font-extrabold text-white truncate">${srv.name}</span>
                  <span class="text-xs font-mono truncate">${parseMinecraftText(srv.motd)}</span>
                </div>
              </div>
              <span class="material-symbols-outlined text-[#94A3B8]">chevron_right</span>
            </div>
            <div class="grid grid-cols-3 gap-2 pt-2 border-t border-[#262B33] text-center font-mono text-xs">
              <div>
                <span class="text-[10px] text-[#94A3B8] block">Versione</span>
                <strong class="text-white">${srv.software} ${srv.version}</strong>
              </div>
              <div>
                <span class="text-[10px] text-[#94A3B8] block">Memoria</span>
                <strong class="text-[#22C55E]">${srv.allocatedRamGb.toFixed(1).replace('.', ',')} GB</strong>
              </div>
              <div>
                <span class="text-[10px] text-[#94A3B8] block">Giocatori Max</span>
                <strong class="text-white">${srv.maxPlayers}</strong>
              </div>
            </div>
          </button>

          <!-- Sezione GIOCO -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider px-1">GIOCO</span>
            <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
              ${this.renderSettingsMenuItem('gioco', 'sports_esports', 'Gioco', `${srv.gamemode} • ${srv.difficulty} • Preset ${srv.preset}`)}
              ${this.renderSettingsMenuItem('mondo', 'public', 'Mondo', `Tipo ${srv.worldType} • Seed ${srv.seed}`)}
              ${this.renderSettingsMenuItem('mods', 'extension', 'Mod & Plugin', `Mod (${srv.mods.length}) • Datapack (${srv.datapacks.length})`)}
            </div>
          </div>

          <!-- Sezione SERVER -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider px-1">SERVER</span>
            <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
              ${this.renderSettingsMenuItem('software', 'deployed_code', 'Software', `${srv.software} ${srv.version} • ${srv.javaVersion}`)}
              ${this.renderSettingsMenuItem('prestazioni', 'speed', 'Prestazioni', `RAM ${srv.allocatedRamGb.toFixed(1).replace('.', ',')} GB • Vista ${srv.viewDistance} chunk`)}
              ${this.renderSettingsMenuItem('rete', 'hub', 'Rete', `Porta ${srv.port} • ${srv.geyserEnabled ? 'Geyser Attivo' : 'Solo Java'}`)}
            </div>
          </div>

          <!-- Sezione MANUTENZIONE -->
          <div class="flex flex-col gap-1.5">
            <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider px-1">MANUTENZIONE</span>
            <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
              ${this.renderSettingsMenuItem('backup', 'cloud_upload', 'Backup', `${srv.backupsList.length} backup salvati • Google Drive`)}
              ${this.renderSettingsMenuItem('automazione', 'schedule', 'Automazione', `Dormi se vuoto (${srv.sleepTimeoutMin})`)}
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-settings-back')?.addEventListener('click', () => {
        this.settingsSubPage = null;
        this.renderViewport(true);
      });
      container.querySelectorAll('[data-open-subpage]').forEach(btn => {
        btn.addEventListener('click', () => {
          triggerHaptic('TICK');
          this.settingsSubPage = btn.getAttribute('data-open-subpage');
          this.renderViewport(true);
        });
      });
      return;
    }

    // Render one of the 9 subpages
    this.renderSpecificSettingsSubPage(container, srv);
  }

  renderSettingsMenuItem(id, icon, title, subtitle) {
    return `
      <button type="button" data-open-subpage="${id}" class="tactile-btn w-full p-3.5 flex items-center justify-between text-left hover:bg-[#1C2026]">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-[#1C2026] border border-[#262B33] text-[#22C55E] flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[19px]">${icon}</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="text-sm font-bold text-[#F8FAFC]">${title}</span>
            <span class="text-xs text-[#94A3B8] truncate">${subtitle}</span>
          </div>
        </div>
        <span class="material-symbols-outlined text-[#94A3B8] text-[18px]">chevron_right</span>
      </button>
    `;
  }

  renderSpecificSettingsSubPage(container, srv) {
    const page = this.settingsSubPage;
    const headerHtml = (title) => `
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <button type="button" id="btn-subpage-back" class="tactile-btn w-9 h-9 rounded-xl bg-[#15181C] border border-[#262B33] flex items-center justify-center text-white">
            <span class="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <h1 class="text-base font-extrabold text-[#F8FAFC]">${title}</h1>
        </div>
        <span class="text-[11px] font-mono text-[#22C55E]">Salvataggio auto</span>
      </div>
    `;

    // 1. GENERALE ("COME LO VEDONO I GIOCATORI")
    if (page === 'generale') {
      const cleanMotdLen = srv.motd.replace(/§[0-9a-fk-or]/gi, '').length;
      const colors = [
        { code: '§a', hex: '#22C55E' }, { code: '§b', hex: '#55FFFF' }, { code: '§e', hex: '#FFFF55' },
        { code: '§6', hex: '#FFAA00' }, { code: '§c', hex: '#EF4444' }, { code: '§d', hex: '#FF55FF' },
        { code: '§9', hex: '#5555FF' }, { code: '§f', hex: '#FFFFFF' }, { code: '§7', hex: '#AAAAAA' }
      ];
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Generale')}
          <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">COME LO VEDONO I GIOCATORI</span>

          <!-- Anteprima Live Server -->
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex items-center gap-3">
            <button type="button" id="btn-cycle-emoji" class="tactile-btn w-12 h-12 rounded-xl bg-[#1C2026] border border-[#22C55E] flex items-center justify-center text-2xl shrink-0" title="Cambia icona">
              ${srv.iconEmoji || '🏰'}
            </button>
            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center justify-between">
                <span id="gen-preview-name" class="text-sm font-extrabold text-white truncate">${srv.name}</span>
                <span class="font-mono text-[10px] text-[#94A3B8]">0/${srv.maxPlayers} 📶</span>
              </div>
              <div id="gen-preview-motd" class="font-mono text-xs truncate mt-0.5">${parseMinecraftText(srv.motd)}</div>
            </div>
          </div>

          <!-- Nome Server -->
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-1.5">
            <label class="text-xs font-bold text-[#94A3B8]">Nome server</label>
            <input id="gen-input-name" type="text" value="${srv.name}" class="w-full bg-[#1C2026] border border-[#262B33] focus:border-[#22C55E] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"/>
          </div>

          <!-- Messaggio nella lista (MOTD) -->
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-2.5">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-[#94A3B8]">Messaggio nella lista (MOTD)</label>
              <span id="gen-motd-counter" class="font-mono text-xs text-[#22C55E] font-bold">${cleanMotdLen}/45</span>
            </div>

            <!-- Pallini colorati di Minecraft -->
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              ${colors.map(c => `
                <button type="button" data-motd-inject="${c.code}" style="background:${c.hex}" class="tactile-btn w-6 h-6 rounded-full border border-white/20 shrink-0"></button>
              `).join('')}
            </div>

            <!-- Chip di formattazione -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              ${[
                { code: '§l', label: 'Grassetto', cls: 'font-bold' },
                { code: '§o', label: 'Corsivo', cls: 'italic' },
                { code: '§n', label: 'Sottolineato', cls: 'underline' },
                { code: '§m', label: 'Barrato', cls: 'line-through' },
                { code: '§k', label: 'Offuscato', cls: 'font-mono text-[#22C55E]' },
                { code: '§r', label: 'Reset', cls: 'text-[#EF4444]' }
              ].map(st => `
                <button type="button" data-motd-inject="${st.code}" class="tactile-btn px-2.5 py-1 rounded-lg bg-[#1C2026] border border-[#262B33] text-xs text-white shrink-0 ${st.cls}">
                  ${st.label}
                </button>
              `).join('')}
            </div>

            <input id="gen-input-motd" type="text" value="${srv.motd}" class="w-full bg-[#1C2026] border border-[#262B33] focus:border-[#22C55E] rounded-xl px-3 py-2.5 font-mono text-xs text-white focus:outline-none"/>
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      document.getElementById('btn-cycle-emoji')?.addEventListener('click', () => {
        const icons = ['🏰', '⚔️', '🌍', '💎', '🔥', '🚀', '🌲'];
        srv.iconEmoji = icons[(icons.indexOf(srv.iconEmoji) + 1) % icons.length];
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('gen-input-name')?.addEventListener('input', (e) => {
        srv.name = e.target.value || 'Hub Creativo';
        const prev = document.getElementById('gen-preview-name');
        if (prev) prev.textContent = srv.name;
        store.saveState();
      });
      const motdIn = document.getElementById('gen-input-motd');
      const updateMotdLive = () => {
        if (!motdIn) return;
        srv.motd = motdIn.value;
        const prev = document.getElementById('gen-preview-motd');
        const cnt = document.getElementById('gen-motd-counter');
        if (prev) prev.innerHTML = parseMinecraftText(srv.motd);
        if (cnt) cnt.textContent = `${srv.motd.replace(/§[0-9a-fk-or]/gi, '').length}/45`;
        store.saveState();
      };
      motdIn?.addEventListener('input', updateMotdLive);
      container.querySelectorAll('[data-motd-inject]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!motdIn) return;
          const code = btn.getAttribute('data-motd-inject');
          motdIn.value += code;
          triggerHaptic('TICK');
          updateMotdLive();
          motdIn.focus();
        });
      });
      return;
    }

    // 2. GIOCO
    if (page === 'gioco') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Gioco')}

          <!-- 3 Chip Preset: Standard, Rilassato, Costruire -->
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-2">
            <span class="text-xs font-bold text-[#94A3B8]">Preset rapidi</span>
            <div class="grid grid-cols-3 gap-2">
              ${['Standard', 'Rilassato', 'Costruire'].map(pr => `
                <button type="button" data-game-preset="${pr}" class="tactile-btn py-2 rounded-xl text-xs font-bold border ${
                  srv.preset === pr ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-[#94A3B8]'
                }">${pr}</button>
              `).join('')}
            </div>
          </div>

          <!-- Modalità di gioco & Difficoltà -->
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
            <div>
              <span class="text-xs font-bold text-[#94A3B8] block mb-1.5">Modalità di gioco</span>
              <div class="grid grid-cols-2 gap-2">
                ${['Sopravvivenza', 'Creativa', 'Avventura', 'Spettatore'].map(gm => `
                  <button type="button" data-set-gm="${gm}" class="tactile-btn py-2 rounded-xl text-xs font-bold border ${
                    srv.gamemode === gm ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-[#F8FAFC]'
                  }">${gm}</button>
                `).join('')}
              </div>
            </div>

            <div>
              <span class="text-xs font-bold text-[#94A3B8] block mb-1.5">Difficoltà</span>
              <div class="grid grid-cols-4 gap-1.5">
                ${['Pacifica', 'Facile', 'Normale', 'Difficile'].map(df => `
                  <button type="button" data-set-diff="${df}" class="tactile-btn py-2 rounded-xl text-[11px] font-bold border ${
                    srv.difficulty === df ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-[#F8FAFC]'
                  }">${df}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Toggle Regole di Gioco -->
          <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
            ${[
              { key: 'hardcore', label: 'Hardcore', sub: 'Morte permanente in sopravvivenza' },
              { key: 'keepInventory', label: 'Mantieni gli oggetti', sub: 'Non perdere l’inventario alla morte' },
              { key: 'mobGriefing', label: 'Danni dei mob', sub: 'I Creeper ed Enderman modificano i blocchi' },
              { key: 'daylightCycle', label: 'Ciclo giorno e notte', sub: 'Scorrimento naturale del sole' },
              { key: 'weatherCycle', label: 'Cambi di meteo', sub: 'Pioggia e temporali dinamici' },
              { key: 'pvp', label: 'Combattimento tra giocatori', sub: 'Consenti danni PvP' },
              { key: 'allowFlight', label: 'Consenti il volo', sub: 'Evita kick per volo con mod' },
              { key: 'commandBlocks', label: 'Blocchi comando', sub: 'Abilita esecuzione command block' }
            ].map(t => `
              <div class="p-3.5 flex items-center justify-between gap-3">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-white">${t.label}</span>
                  <span class="text-[11px] text-[#94A3B8]">${t.sub}</span>
                </div>
                <button type="button" data-toggle-prop="${t.key}" aria-checked="${Boolean(srv[t.key])}" class="anvil-toggle">
                  <span class="anvil-toggle-thumb"></span>
                </button>
              </div>
            `).join('')}
          </div>

          <!-- Sliders & Resource Pack -->
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
            <div>
              <div class="flex justify-between text-xs font-bold mb-1.5">
                <span class="text-white">Protezione dello spawn</span>
                <span class="text-[#22C55E] font-mono">${srv.spawnProtection} blocchi</span>
              </div>
              <input type="range" id="slider-spawn-prot" min="0" max="64" value="${srv.spawnProtection}" class="anvil-slider"/>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1.5">
                <span class="text-white">Espelli inattivi</span>
                <span class="text-[#22C55E] font-mono">${srv.idleKickMinutes === 0 ? 'Disattivato' : srv.idleKickMinutes + ' min'}</span>
              </div>
              <input type="range" id="slider-idle-kick" min="0" max="60" step="5" value="${srv.idleKickMinutes}" class="anvil-slider"/>
            </div>

            <div>
              <label class="text-xs font-bold text-[#94A3B8] block mb-1">Pacchetto risorse (URL .zip)</label>
              <input id="input-res-pack" type="url" value="${srv.resourcePackUrl}" placeholder="https://esempio.it/texturepack.zip" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white focus:border-[#22C55E] focus:outline-none"/>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      container.querySelectorAll('[data-game-preset]').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.getAttribute('data-game-preset');
          srv.preset = p;
          if (p === 'Standard') { srv.gamemode = 'Sopravvivenza'; srv.keepInventory = false; srv.mobGriefing = true; }
          if (p === 'Rilassato') { srv.gamemode = 'Sopravvivenza'; srv.keepInventory = true; srv.mobGriefing = false; }
          if (p === 'Costruire') { srv.gamemode = 'Creativa'; srv.keepInventory = true; srv.mobGriefing = false; srv.allowFlight = true; }
          triggerHaptic('TICK');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      container.querySelectorAll('[data-set-gm]').forEach(btn => {
        btn.addEventListener('click', () => {
          srv.gamemode = btn.getAttribute('data-set-gm');
          triggerHaptic('TICK');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      container.querySelectorAll('[data-set-diff]').forEach(btn => {
        btn.addEventListener('click', () => {
          srv.difficulty = btn.getAttribute('data-set-diff');
          triggerHaptic('TICK');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      container.querySelectorAll('[data-toggle-prop]').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-toggle-prop');
          srv[k] = !srv[k];
          triggerHaptic('TICK');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      document.getElementById('slider-spawn-prot')?.addEventListener('input', (e) => {
        srv.spawnProtection = Number(e.target.value);
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('slider-idle-kick')?.addEventListener('input', (e) => {
        srv.idleKickMinutes = Number(e.target.value);
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('input-res-pack')?.addEventListener('change', (e) => {
        srv.resourcePackUrl = e.target.value;
        store.saveState();
      });
      return;
    }

    // 3. MONDO
    if (page === 'mondo') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Mondo')}

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
            <span class="text-xs font-bold text-[#94A3B8]">Tipo di mondo</span>
            <div class="grid grid-cols-2 gap-2">
              ${['Normale', 'Piatto', 'Grandi Biomi', 'Amplificato'].map(wt => `
                <button type="button" data-world-type="${wt}" class="tactile-btn py-2.5 rounded-xl text-xs font-bold border ${
                  srv.worldType === wt ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-white'
                }">${wt}</button>
              `).join('')}
            </div>

            <div>
              <label class="text-xs font-bold text-[#94A3B8] block mb-1">Seed del mondo</label>
              <input id="world-seed-input" type="text" value="${srv.seed}" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 font-mono text-xs text-white focus:border-[#22C55E] focus:outline-none"/>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button type="button" id="btn-world-backup-now" class="tactile-btn p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E] flex flex-col items-center gap-1.5">
              <span class="material-symbols-outlined text-[#22C55E]">backup</span>
              <span class="text-xs font-bold text-white">Fai il backup ora</span>
            </button>
            <button type="button" id="btn-world-import-zip" class="tactile-btn p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E] flex flex-col items-center gap-1.5">
              <span class="material-symbols-outlined text-[#22C55E]">folder_zip</span>
              <span class="text-xs font-bold text-white">Importa mondo (ZIP)</span>
            </button>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-white">Mappa del mondo live [squaremap]</span>
              <span class="text-[11px] text-[#94A3B8]">Visualizza la mappa 2D nel browser sulla porta 8080</span>
            </div>
            <button type="button" id="toggle-squaremap" aria-checked="${srv.squaremapEnabled}" class="anvil-toggle">
              <span class="anvil-toggle-thumb"></span>
            </button>
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      container.querySelectorAll('[data-world-type]').forEach(btn => {
        btn.addEventListener('click', () => {
          srv.worldType = btn.getAttribute('data-world-type');
          triggerHaptic('TICK');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      document.getElementById('world-seed-input')?.addEventListener('change', (e) => {
        srv.seed = e.target.value;
        store.saveState();
      });
      document.getElementById('btn-world-backup-now')?.addEventListener('click', () => {
        srv.backupsList.unshift({
          id: 'bkp-' + Date.now(),
          name: `${srv.name.replace(/\s+/g, '_')}_Manuale.zip`,
          size: '50,4 MB',
          date: 'Adesso'
        });
        store.saveState();
        this.showToast('Backup del mondo completato!');
      });
      document.getElementById('btn-world-import-zip')?.addEventListener('click', () => {
        this.showToast('Mondo ZIP importato e verificato con successo!');
      });
      document.getElementById('toggle-squaremap')?.addEventListener('click', () => {
        srv.squaremapEnabled = !srv.squaremapEnabled;
        triggerHaptic('TICK');
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      return;
    }

    // 4. MOD & PLUGIN (Tab Mod (7), Tab Datapack (1), Real Modrinth Search + Pagination)
    if (page === 'mods') {
      const list = this.modsSubTab === 'mods' ? srv.mods : srv.datapacks;
      container.innerHTML = `
        <div class="flex flex-col gap-3 pb-8">
          ${headerHtml('Mod & Plugin')}

          <!-- Tabs: Mod (7) | Datapack (1) -->
          <div class="grid grid-cols-2 p-1 rounded-xl bg-[#15181C] border border-[#262B33]">
            <button type="button" data-mods-tab="mods" class="tactile-btn py-2 rounded-lg text-xs font-bold ${
              this.modsSubTab === 'mods' ? 'bg-[#22C55E] text-[#0B0D0E]' : 'text-[#94A3B8]'
            }">Mod (${srv.mods.length})</button>
            <button type="button" data-mods-tab="datapacks" class="tactile-btn py-2 rounded-lg text-xs font-bold ${
              this.modsSubTab === 'datapacks' ? 'bg-[#22C55E] text-[#0B0D0E]' : 'text-[#94A3B8]'
            }">Datapack (${srv.datapacks.length})</button>
          </div>

          <!-- Action Buttons: + Carica la tua mod/datapack & Cerca su Modrinth -->
          <div class="grid grid-cols-2 gap-2">
            <button type="button" id="btn-upload-custom-mod" class="tactile-btn py-2.5 px-3 rounded-xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E] text-xs font-bold text-white flex items-center justify-center gap-1.5">
              <span>+ Carica la tua ${this.modsSubTab === 'mods' ? 'mod' : 'datapack'}</span>
            </button>
            <button type="button" id="btn-toggle-modrinth" class="tactile-btn py-2.5 px-3 rounded-xl ${
              this.modrinthSearchOpen ? 'bg-[#22C55E] text-[#0B0D0E]' : 'bg-[#22C55E]/15 border border-[#22C55E]/40 text-[#22C55E]'
            } text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">travel_explore</span>
              <span>Esplora Modrinth</span>
            </button>
          </div>

          <!-- Modrinth Live Search Panel with Pagination -->
          ${this.modrinthSearchOpen ? `
            <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#22C55E]/40 flex flex-col gap-3">
              <form id="modrinth-search-form" class="flex items-center gap-2">
                <input id="modrinth-query-input" type="text" value="${this.modrinthQuery}" placeholder="Cerca mod o plugin su Modrinth..." class="flex-1 bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white focus:border-[#22C55E] focus:outline-none"/>
                <button type="submit" class="tactile-btn px-3.5 py-2 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-bold text-xs">Cerca</button>
              </form>

              ${this.modrinthLoading ? `
                <div class="py-6 text-center text-xs text-[#22C55E] font-mono">Ricerca su api.modrinth.com/v2/search...</div>
              ` : `
                <div class="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
                  ${this.modrinthResults.map(m => {
                    const installed = srv.mods.some(x => x.id === m.slug || x.name.toLowerCase() === m.name.toLowerCase());
                    return `
                      <div class="p-2.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center justify-between gap-2.5">
                        <div class="flex items-center gap-2.5 min-w-0">
                          <img src="${m.iconUrl}" onerror="this.src='https://mc-heads.net/avatar/MHF_Chest/64'" class="w-9 h-9 rounded-lg object-cover bg-[#0B0D0E] shrink-0"/>
                          <div class="flex flex-col min-w-0">
                            <span class="text-xs font-bold text-white truncate">${m.name}</span>
                            <span class="text-[10px] text-[#94A3B8] truncate">${m.description}</span>
                            <span class="text-[9px] font-mono text-[#22C55E]">⬇ ${formatDownloadsIt(m.downloads)} • ${m.size}</span>
                          </div>
                        </div>
                        <button type="button" data-install-modrinth="${m.slug}" data-mod-name="${m.name}" data-mod-size="${m.size}" data-mod-ver="${m.version}" class="tactile-btn px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 ${
                          installed ? 'bg-[#262B33] text-[#22C55E]' : 'bg-[#22C55E] text-[#0B0D0E]'
                        }">
                          ${installed ? '✓ Installata' : 'Installa'}
                        </button>
                      </div>
                    `;
                  }).join('')}
                </div>

                <!-- Pagination Controls -->
                <div class="flex items-center justify-between pt-1 border-t border-[#262B33] text-xs">
                  <button type="button" id="modrinth-prev-page" ${this.modrinthPage === 0 ? 'disabled' : ''} class="tactile-btn px-2.5 py-1 rounded bg-[#1C2026] text-[#94A3B8] disabled:opacity-40">← Prec</button>
                  <span class="font-mono text-[11px] text-[#94A3B8]">Pagina ${this.modrinthPage + 1}</span>
                  <button type="button" id="modrinth-next-page" class="tactile-btn px-2.5 py-1 rounded bg-[#1C2026] text-[#22C55E]">Succ →</button>
                </div>
              `}
            </div>
          ` : ''}

          <!-- Installed Mods / Datapacks List -->
          <div class="flex flex-col gap-2">
            ${list.map(item => `
              <div class="p-3 rounded-xl bg-[#15181C] border border-[#262B33] flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-xl bg-[#1C2026] border border-[#262B33] text-[#22C55E] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                    JAR
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-bold text-white truncate">${item.name}</span>
                    <span class="text-[10px] font-mono text-[#94A3B8]">${item.version} • ${item.size}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button type="button" data-toggle-mod="${item.id}" aria-checked="${item.enabled}" class="anvil-toggle">
                    <span class="anvil-toggle-thumb"></span>
                  </button>
                  <button type="button" data-remove-mod="${item.id}" class="text-[#EF4444] p-1">
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      container.querySelectorAll('[data-mods-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.modsSubTab = btn.getAttribute('data-mods-tab');
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      document.getElementById('btn-upload-custom-mod')?.addEventListener('click', () => {
        const name = prompt(`Nome del file ${this.modsSubTab === 'mods' ? '.jar' : '.zip'} da caricare:`, this.modsSubTab === 'mods' ? 'CustomMod-26.3.jar' : 'CustomPack.zip');
        if (name && name.trim()) {
          const targetArr = this.modsSubTab === 'mods' ? srv.mods : srv.datapacks;
          targetArr.push({
            id: 'custom-' + Date.now(),
            name: name.trim(),
            version: '1.0.0',
            size: '380 kB',
            enabled: true
          });
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
          this.showToast(`${name.trim()} aggiunto con successo!`);
        }
      });
      document.getElementById('btn-toggle-modrinth')?.addEventListener('click', () => {
        this.modrinthSearchOpen = !this.modrinthSearchOpen;
        if (this.modrinthSearchOpen && this.modrinthResults.length === 0) {
          this.runModrinthSearch(container, srv);
        } else {
          this.renderSpecificSettingsSubPage(container, srv);
        }
      });
      document.getElementById('modrinth-search-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        this.modrinthQuery = document.getElementById('modrinth-query-input')?.value || '';
        this.modrinthPage = 0;
        this.runModrinthSearch(container, srv);
      });
      document.getElementById('modrinth-prev-page')?.addEventListener('click', () => {
        if (this.modrinthPage > 0) {
          this.modrinthPage -= 1;
          this.runModrinthSearch(container, srv);
        }
      });
      document.getElementById('modrinth-next-page')?.addEventListener('click', () => {
        this.modrinthPage += 1;
        this.runModrinthSearch(container, srv);
      });
      container.querySelectorAll('[data-install-modrinth]').forEach(btn => {
        btn.addEventListener('click', () => {
          const slug = btn.getAttribute('data-install-modrinth');
          const name = btn.getAttribute('data-mod-name');
          const size = btn.getAttribute('data-mod-size');
          const ver = btn.getAttribute('data-mod-ver');
          if (!srv.mods.some(x => x.id === slug)) {
            srv.mods.push({ id: slug, name, version: ver, size, enabled: true });
            triggerHaptic('SUCCESS');
            store.saveState();
            this.renderSpecificSettingsSubPage(container, srv);
            this.showToast(`${name} installata nella cartella /mods!`);
          }
        });
      });
      container.querySelectorAll('[data-toggle-mod]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle-mod');
          const arr = this.modsSubTab === 'mods' ? srv.mods : srv.datapacks;
          const found = arr.find(x => x.id === id);
          if (found) found.enabled = !found.enabled;
          triggerHaptic('TICK');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      container.querySelectorAll('[data-remove-mod]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-remove-mod');
          if (this.modsSubTab === 'mods') {
            srv.mods = srv.mods.filter(x => x.id !== id);
          } else {
            srv.datapacks = srv.datapacks.filter(x => x.id !== id);
          }
          triggerHaptic('DELETE');
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
      return;
    }

    // 5. SOFTWARE
    if (page === 'software') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Software')}

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
            <label class="text-xs font-bold text-[#94A3B8]">Selettore File JAR</label>
            <select id="sw-jar-select" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:border-[#22C55E] focus:outline-none">
              ${['Fabric 26.3', 'Paper 1.21.4', 'Vanilla 26.3', 'Purpur 1.21.4', 'NeoForge 1.21.4'].map(j => `
                <option value="${j}" ${(`${srv.software} ${srv.version}`) === j ? 'selected' : ''}>${j}</option>
              `).join('')}
            </select>

            <label class="text-xs font-bold text-[#94A3B8]">Versione Java</label>
            <select id="sw-java-select" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2.5 text-xs text-[#22C55E] font-bold focus:border-[#22C55E] focus:outline-none">
              ${['Java 25', 'Java 21 (LTS)', 'Java 17 (Legacy)'].map(jv => `
                <option value="${jv}" ${srv.javaVersion === jv ? 'selected' : ''}>${jv}</option>
              `).join('')}
            </select>

            <label class="text-xs font-bold text-[#94A3B8]">Avanzate (Flag Java)</label>
            <textarea id="sw-java-flags" rows="3" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl p-3 font-mono text-xs text-white focus:border-[#22C55E] focus:outline-none">${srv.javaFlags}</textarea>
          </div>
        </div>
      `;
      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      document.getElementById('sw-jar-select')?.addEventListener('change', (e) => {
        const parts = e.target.value.split(' ');
        srv.software = parts[0];
        srv.version = parts[1] || '26.3';
        store.saveState();
        this.showToast(`File JAR impostato su ${e.target.value}`);
      });
      document.getElementById('sw-java-select')?.addEventListener('change', (e) => {
        srv.javaVersion = e.target.value;
        store.saveState();
      });
      document.getElementById('sw-java-flags')?.addEventListener('change', (e) => {
        srv.javaFlags = e.target.value;
        store.saveState();
      });
      return;
    }

    // 6. PRESTAZIONI
    if (page === 'prestazioni') {
      const freeRamMb = getDeviceFreeRamMb();
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Prestazioni')}

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
            <div class="flex justify-between items-center">
              <span class="text-xs font-bold text-white">RAM allocata</span>
              <span class="font-mono text-sm font-extrabold text-[#22C55E]">${srv.allocatedRamGb.toFixed(1).replace('.', ',')} GB</span>
            </div>
            <input id="perf-ram-slider" type="range" min="0.5" max="3.0" step="0.5" value="${srv.allocatedRamGb}" class="anvil-slider"/>
            <div class="flex justify-between font-mono text-[10px] text-[#94A3B8]">
              <span>0,5 GB</span>
              <span>1,5 GB</span>
              <span>3,0 GB</span>
            </div>

            <div class="p-2.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-[11px] leading-relaxed">
              ⚠️ Memoria libera rilevata sul dispositivo: <strong>${freeRamMb} MB</strong>. Allocare oltre 2,5 GB potrebbe causare la chiusura in background da parte di Android.
            </div>
          </div>

          <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
            <div class="p-3.5 flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white">Modalità prestazioni</span>
                <span class="text-[11px] text-[#94A3B8]">Priorità CPU massima e GC ottimizzato</span>
              </div>
              <button type="button" id="perf-toggle-mode" aria-checked="${srv.performanceMode}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
            </div>
            <div class="p-3.5 flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white">Ottimizza per telefono</span>
                <span class="text-[11px] text-[#94A3B8]">Riduce tick entità lontane per risparmiare batteria</span>
              </div>
              <button type="button" id="perf-toggle-phone" aria-checked="${srv.optimizeForPhone}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3.5">
            <div>
              <div class="flex justify-between text-xs font-bold mb-1.5">
                <span class="text-white">Distanza visiva</span>
                <span class="text-[#22C55E] font-mono">${srv.viewDistance} chunk</span>
              </div>
              <input id="perf-view-slider" type="range" min="3" max="16" value="${srv.viewDistance}" class="anvil-slider"/>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1.5">
                <span class="text-white">Distanza di simulazione</span>
                <span class="text-[#22C55E] font-mono">${srv.simulationDistance} chunk</span>
              </div>
              <input id="perf-sim-slider" type="range" min="3" max="12" value="${srv.simulationDistance}" class="anvil-slider"/>
            </div>

            <div>
              <div class="flex justify-between text-xs font-bold mb-1.5">
                <span class="text-white">Giocatori max</span>
                <span class="text-[#22C55E] font-mono">${srv.maxPlayers}</span>
              </div>
              <input id="perf-maxp-slider" type="range" min="2" max="50" value="${srv.maxPlayers}" class="anvil-slider"/>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      document.getElementById('perf-ram-slider')?.addEventListener('input', (e) => {
        srv.allocatedRamGb = Number(e.target.value);
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('perf-toggle-mode')?.addEventListener('click', () => {
        srv.performanceMode = !srv.performanceMode;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('perf-toggle-phone')?.addEventListener('click', () => {
        srv.optimizeForPhone = !srv.optimizeForPhone;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('perf-view-slider')?.addEventListener('input', (e) => {
        srv.viewDistance = Number(e.target.value);
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('perf-sim-slider')?.addEventListener('input', (e) => {
        srv.simulationDistance = Number(e.target.value);
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('perf-maxp-slider')?.addEventListener('input', (e) => {
        srv.maxPlayers = Number(e.target.value);
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      return;
    }

    // 7. RETE
    if (page === 'rete') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Rete')}

          <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
            <div class="p-3.5 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-white">Blocca giocatori non autenticati</span>
                  <span class="text-[11px] text-[#94A3B8]">Richiede account Minecraft ufficiale (online-mode)</span>
                </div>
                <button type="button" id="net-toggle-online" aria-checked="${srv.onlineMode}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
              </div>
              ${!srv.onlineMode ? `
                <div class="p-2.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-[11px]">
                  ⚠️ Attenzione: disattivando il blocco chiunque potrà entrare usando qualsiasi nickname (modalità Cracked/SP).
                </div>
                <div class="pt-2 flex items-center justify-between border-t border-[#262B33]">
                  <span class="text-xs font-bold text-white">Skin dei giocatori (Skin Restorer)</span>
                  <button type="button" id="net-toggle-skins" aria-checked="${srv.skinRestorer}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
                </div>
              ` : ''}
            </div>

            <div class="p-3.5 flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white">Whitelist</span>
                <span class="text-[11px] text-[#94A3B8]">Solo i giocatori approvati possono entrare</span>
              </div>
              <button type="button" id="net-toggle-wl" aria-checked="${srv.whitelistEnabled}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
            </div>

            <div class="p-3.5 flex items-center justify-between">
              <span class="text-xs font-bold text-white">Porta server</span>
              <input id="net-input-port" type="number" value="${srv.port}" class="w-24 bg-[#1C2026] border border-[#262B33] rounded-xl px-2.5 py-1.5 text-center font-mono text-xs text-[#22C55E] font-bold"/>
            </div>

            <div class="p-3.5 flex items-center justify-between">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white">Supporto Bedrock [Geyser]</span>
                <span class="text-[11px] text-[#94A3B8]">Consenti accesso da telefono, Xbox, PS5 e Switch</span>
              </div>
              <button type="button" id="net-toggle-geyser" aria-checked="${srv.geyserEnabled}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
            </div>

            <div class="p-3.5 flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-white">Simple Voice Chat</span>
                  <span class="text-[11px] text-[#94A3B8]">Chat vocale di prossimità UDP</span>
                </div>
                <button type="button" id="net-toggle-voice" aria-checked="${srv.voiceChatEnabled}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
              </div>
              ${srv.geyserEnabled && srv.voiceChatEnabled ? `
                <div class="p-2.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] text-[11px]">
                  ⚠️ Simple Voice Chat e Geyser condividono la porta UDP secondaria nel tunnel gratuito: attiva solo uno dei due.
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      document.getElementById('net-toggle-online')?.addEventListener('click', () => {
        srv.onlineMode = !srv.onlineMode;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('net-toggle-skins')?.addEventListener('click', () => {
        srv.skinRestorer = !srv.skinRestorer;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('net-toggle-wl')?.addEventListener('click', () => {
        srv.whitelistEnabled = !srv.whitelistEnabled;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('net-input-port')?.addEventListener('change', (e) => {
        srv.port = Number(e.target.value) || 25565;
        store.saveState();
      });
      document.getElementById('net-toggle-geyser')?.addEventListener('click', () => {
        srv.geyserEnabled = !srv.geyserEnabled;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      document.getElementById('net-toggle-voice')?.addEventListener('click', () => {
        srv.voiceChatEnabled = !srv.voiceChatEnabled;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      return;
    }

    // 8. BACKUP
    if (page === 'backup') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Backup')}

          <button type="button" id="bkp-drive-now" class="tactile-btn w-full p-3.5 rounded-2xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px]">cloud_upload</span>
            <span>Fai il backup ora (Google Drive)</span>
          </button>

          <button type="button" id="bkp-export-zip" class="tactile-btn w-full p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] text-white font-bold text-xs flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-[18px] text-[#22C55E]">download</span>
            <span>Esporta mondo (ZIP)</span>
          </button>

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex items-center justify-between">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-white">Backup automatici</span>
              <span class="text-[11px] text-[#94A3B8]">Salva una copia ad ogni arresto del server</span>
            </div>
            <button type="button" id="bkp-toggle-auto" aria-checked="${srv.autoBackup}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
          </div>

          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-2">
            <span class="text-xs font-bold text-[#94A3B8]">↺ Vedi backup (${srv.backupsList.length})</span>
            ${srv.backupsList.map(b => `
              <div class="p-2.5 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-white">${b.name}</span>
                  <span class="text-[10px] font-mono text-[#94A3B8]">${b.date} • ${b.size}</span>
                </div>
                <button type="button" class="text-xs font-bold text-[#22C55E]">Ripristina</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      document.getElementById('bkp-drive-now')?.addEventListener('click', () => {
        srv.backupsList.unshift({
          id: 'bkp-' + Date.now(),
          name: `${srv.name.replace(/\s+/g, '_')}_GDrive.zip`,
          size: '49,1 MB',
          date: 'Adesso'
        });
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
        this.showToast('Backup caricato su Google Drive!');
      });
      document.getElementById('bkp-export-zip')?.addEventListener('click', () => {
        if (window.AnvilNative && typeof window.AnvilNative.exportServerFile === 'function') {
          window.AnvilNative.exportServerFile(`${srv.name}_world.zip`, 'PK_ANVIL_MC_WORLD_BACKUP_ARCHIVE');
        }
        this.showToast(`Esportato ${srv.name}_world.zip in Download/AnvilMC`);
      });
      document.getElementById('bkp-toggle-auto')?.addEventListener('click', () => {
        srv.autoBackup = !srv.autoBackup;
        store.saveState();
        this.renderSpecificSettingsSubPage(container, srv);
      });
      return;
    }

    // 9. AUTOMAZIONE
    if (page === 'automazione') {
      container.innerHTML = `
        <div class="flex flex-col gap-3.5 pb-8">
          ${headerHtml('Automazione')}

          <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">DORMI SE VUOTO</span>
          <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-white">Timeout inattività</span>
              <select id="auto-timeout-sel" class="bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-1.5 text-xs text-[#22C55E] font-bold">
                ${['5 min', '15 min', '30 min', '1 ora'].map(t => `<option value="${t}" ${srv.sleepTimeoutMin === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>

            <div>
              <label class="text-xs font-bold text-[#94A3B8] block mb-1">Messaggio di pausa</label>
              <input id="auto-sleep-msg" type="text" value="${srv.sleepMessage}" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white"/>
            </div>

            <div>
              <label class="text-xs font-bold text-[#94A3B8] block mb-1">Messaggio di risveglio</label>
              <input id="auto-wake-msg" type="text" value="${srv.wakeMessage}" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white"/>
            </div>
          </div>

          <div class="flex items-center justify-between mt-1">
            <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider">ATTIVITÀ PIANIFICATE</span>
            <button type="button" id="btn-add-task" class="text-xs font-bold text-[#22C55E]">+ Aggiungi attività</button>
          </div>
          <div class="flex flex-col gap-2">
            ${srv.scheduledTasks.map(tk => `
              <div class="p-3 rounded-xl bg-[#15181C] border border-[#262B33] flex items-center justify-between">
                <div class="flex flex-col">
                  <span class="text-xs font-bold text-white">${tk.name}</span>
                  <span class="text-[10px] font-mono text-[#94A3B8]">${tk.cron}</span>
                </div>
                <button type="button" data-toggle-task="${tk.id}" aria-checked="${tk.enabled}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      document.getElementById('btn-subpage-back')?.addEventListener('click', () => {
        this.settingsSubPage = 'menu';
        this.renderViewport(true);
      });
      document.getElementById('auto-timeout-sel')?.addEventListener('change', (e) => {
        srv.sleepTimeoutMin = e.target.value;
        store.saveState();
      });
      document.getElementById('auto-sleep-msg')?.addEventListener('change', (e) => {
        srv.sleepMessage = e.target.value;
        store.saveState();
      });
      document.getElementById('auto-wake-msg')?.addEventListener('change', (e) => {
        srv.wakeMessage = e.target.value;
        store.saveState();
      });
      document.getElementById('btn-add-task')?.addEventListener('click', () => {
        const name = prompt('Nome nuova attività pianificata:', 'Annuncio automatico /say');
        if (name && name.trim()) {
          srv.scheduledTasks.push({ id: 'tsk-' + Date.now(), name: name.trim(), cron: 'Ogni 60 min', enabled: true });
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        }
      });
      container.querySelectorAll('[data-toggle-task]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-toggle-task');
          const t = srv.scheduledTasks.find(x => x.id === id);
          if (t) t.enabled = !t.enabled;
          store.saveState();
          this.renderSpecificSettingsSubPage(container, srv);
        });
      });
    }
  }

  async runModrinthSearch(container, srv) {
    this.modrinthLoading = true;
    this.renderSpecificSettingsSubPage(container, srv);
    const res = await searchModrinthPaginated({
      query: this.modrinthQuery,
      offset: this.modrinthPage * 10,
      limit: 10
    });
    this.modrinthResults = res.items;
    this.modrinthTotal = res.totalHits;
    this.modrinthLoading = false;
    this.renderSpecificSettingsSubPage(container, srv);
  }

  /* =========================================================================
   * SCHERMATA 2: CONSOLE (Output in diretta)
   * ========================================================================= */
  renderConsoleScreen(container) {
    const srv = store.getActiveServer();
    if (!srv) {
      container.innerHTML = `<div class="p-8 text-center text-xs text-[#94A3B8]">Nessun server attivo. Crea un server dalla scheda +.</div>`;
      return;
    }

    const allLogs = srv.logs || [];
    const infoCount = allLogs.filter(l => l.level === 'INFO').length;
    const warnCount = allLogs.filter(l => l.level === 'WARN' || l.level === 'ERROR').length;

    const filteredLogs = allLogs.filter(l => {
      if (this.consoleFilter === 'info' && l.level !== 'INFO') return false;
      if (this.consoleFilter === 'warn' && l.level === 'INFO') return false;
      if (this.consoleSearchQuery) {
        return l.text.toLowerCase().includes(this.consoleSearchQuery.toLowerCase());
      }
      return true;
    });

    const quickChips = [
      { cmd: '/stop', label: '✕ /stop', danger: true },
      { cmd: '/help', label: '/help' },
      { cmd: '/list', label: '/list' },
      { cmd: '/op ', label: '/op' },
      { cmd: '/kick ', label: '/kick' },
      { cmd: '/ban ', label: '/ban' },
      { cmd: '/say ', label: '/say' },
      { cmd: '/time day', label: '/time day' },
      { cmd: '/time night', label: '/time night' },
      { cmd: '/weather clear', label: '/weather clear' },
      { cmd: '/tp ', label: '/tp' }
    ];

    container.innerHTML = `
      <div class="flex flex-col h-full gap-2.5 pb-4">
        <!-- Console Header -->
        <div class="flex items-center justify-between">
          <h1 class="text-base font-extrabold text-[#F8FAFC]">Console</h1>
          <div class="flex items-center gap-1.5">
            <button type="button" id="btn-web-console" class="tactile-btn px-2.5 py-1 rounded-lg bg-[#15181C] border border-[#262B33] text-[11px] font-bold text-[#22C55E]">
              ↗ WEB CONSOLE
            </button>
            <button type="button" id="btn-con-search-toggle" class="tactile-btn w-8 h-8 rounded-lg bg-[#15181C] border ${this.consoleSearchOpen ? 'border-[#22C55E] text-[#22C55E]' : 'border-[#262B33] text-[#94A3B8]'} flex items-center justify-center text-xs">
              🔍
            </button>
            <button type="button" id="btn-con-share" class="tactile-btn w-8 h-8 rounded-lg bg-[#15181C] border border-[#262B33] text-[#94A3B8] flex items-center justify-center">
              <span class="material-symbols-outlined text-[16px]">share</span>
            </button>
          </div>
        </div>

        <!-- Expandable Search & Filter Chips (Tutto, Info, ⚠️ Avvisi) -->
        ${this.consoleSearchOpen ? `
          <div class="p-2.5 rounded-xl bg-[#15181C] border border-[#262B33] flex flex-col gap-2">
            <input id="con-search-input" type="text" value="${this.consoleSearchQuery}" placeholder="Cerca nei log..." class="w-full bg-[#1C2026] border border-[#262B33] rounded-lg px-3 py-1.5 text-xs text-white focus:border-[#22C55E] focus:outline-none"/>
            <div class="flex items-center gap-1.5">
              <button type="button" data-con-filter="all" class="tactile-btn px-2.5 py-1 rounded-lg text-[11px] font-bold ${this.consoleFilter === 'all' ? 'bg-[#22C55E] text-[#0B0D0E]' : 'bg-[#1C2026] text-[#94A3B8]'}">Tutto (${allLogs.length})</button>
              <button type="button" data-con-filter="info" class="tactile-btn px-2.5 py-1 rounded-lg text-[11px] font-bold ${this.consoleFilter === 'info' ? 'bg-[#22C55E] text-[#0B0D0E]' : 'bg-[#1C2026] text-[#94A3B8]'}">Info (${infoCount})</button>
              <button type="button" data-con-filter="warn" class="tactile-btn px-2.5 py-1 rounded-lg text-[11px] font-bold ${this.consoleFilter === 'warn' ? 'bg-[#F59E0B] text-[#0B0D0E]' : 'bg-[#1C2026] text-[#F59E0B]'}">⚠️ Avvisi (${warnCount})</button>
            </div>
          </div>
        ` : ''}

        <!-- Horizontal Quick Command Chips -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          ${quickChips.map(c => `
            <button type="button" data-quick-cmd="${c.cmd}" class="tactile-btn px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold shrink-0 border ${
              c.danger
                ? 'bg-[#EF4444]/15 border-[#EF4444]/40 text-[#EF4444]'
                : 'bg-[#15181C] border-[#262B33] text-[#F8FAFC] hover:border-[#22C55E]'
            }">${c.label}</button>
          `).join('')}
        </div>

        <!-- Real-Time Log Stream Box -->
        <div class="relative flex-1 min-h-[340px] max-h-[430px] rounded-2xl bg-[#08090A] border border-[#262B33] p-3 overflow-y-auto font-mono text-[11px] leading-relaxed flex flex-col gap-1.5" id="console-log-stream">
          ${filteredLogs.map(l => `
            <div class="break-words">
              <span class="text-[#64748B]">${l.time}</span>
              <span class="font-bold ${l.level === 'WARN' ? 'text-[#F59E0B]' : l.level === 'ERROR' ? 'text-[#EF4444]' : 'text-[#22C55E]'}"> ${l.level}</span>
              <span class="text-[#F8FAFC]"> ${l.text}</span>
            </div>
          `).join('')}

          <button type="button" id="btn-scroll-latest" class="tactile-btn sticky bottom-1 self-end px-3 py-1 rounded-full bg-[#1C2026] border border-[#22C55E]/40 text-[#22C55E] font-sans text-[11px] font-bold shadow-lg">
            ↓ Ultime
          </button>
        </div>

        <!-- Bottom Command Input Bar -->
        <form id="con-cmd-form" class="flex items-center gap-2 bg-[#15181C] border border-[#262B33] focus-within:border-[#22C55E] rounded-xl px-3 py-1.5">
          <span class="font-mono text-[#22C55E] font-bold text-sm">/</span>
          <input id="con-cmd-input" type="text" autocomplete="off" placeholder="Inserisci comando..." class="flex-1 bg-transparent text-xs font-mono text-white focus:outline-none py-1.5"/>
          <button type="submit" class="tactile-btn px-3 py-1.5 rounded-lg bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs">
            Invia
          </button>
        </form>
      </div>
    `;

    const logBox = document.getElementById('console-log-stream');
    if (logBox) logBox.scrollTop = logBox.scrollHeight;

    document.getElementById('btn-web-console')?.addEventListener('click', () => {
      this.showToast(`Web Console attiva su http://${srv.localIp.split(':')[0]}:8080`);
    });
    document.getElementById('btn-con-search-toggle')?.addEventListener('click', () => {
      this.consoleSearchOpen = !this.consoleSearchOpen;
      this.renderConsoleScreen(container);
    });
    document.getElementById('btn-con-share')?.addEventListener('click', () => {
      const fullLog = allLogs.map(l => `${l.time} ${l.level}: ${l.text}`).join('\n');
      this.shareTextNativeOrWeb(`Log Console ${srv.name}`, fullLog);
    });
    document.getElementById('con-search-input')?.addEventListener('input', (e) => {
      this.consoleSearchQuery = e.target.value;
      this.renderConsoleScreen(container);
      const ref = document.getElementById('con-search-input');
      if (ref) { ref.focus(); ref.setSelectionRange(ref.value.length, ref.value.length); }
    });
    container.querySelectorAll('[data-con-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.consoleFilter = btn.getAttribute('data-con-filter');
        this.renderConsoleScreen(container);
      });
    });
    container.querySelectorAll('[data-quick-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-quick-cmd');
        const input = document.getElementById('con-cmd-input');
        if (cmd.endsWith(' ')) {
          if (input) {
            input.value = cmd;
            input.focus();
          }
        } else {
          store.executeConsoleCommand(cmd);
        }
      });
    });
    document.getElementById('btn-scroll-latest')?.addEventListener('click', () => {
      if (logBox) logBox.scrollTop = logBox.scrollHeight;
    });
    document.getElementById('con-cmd-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('con-cmd-input');
      if (!input || !input.value.trim()) return;
      store.executeConsoleCommand(input.value);
      input.value = '';
    });
  }

  /* =========================================================================
   * SCHERMATA 3 (+): CREATE SERVER & SETUP GUIDATO IN 8 PASSI
   * ========================================================================= */
  renderCreateScreen(container) {
    // Step 0: Create Server Hub ("Come vuoi iniziare?")
    if (this.createFlowStep === 0) {
      const options = [
        { id: 'guided', icon: 'auto_awesome', title: 'Setup guidato ~2 minuti', sub: 'Consigliato: crea il tuo server passo dopo passo in 8 semplici scelte', highlight: true },
        { id: 'modpack', icon: 'inventory_2', title: 'Configurazione Modpack', sub: 'Importa un pacchetto CurseForge o Modrinth (.mrpack)' },
        { id: 'gamemode', icon: 'sports_esports', title: 'Modalità di gioco', sub: 'OneBlock, SkyBlock, BedWars o Parkour preconfigurati' },
        { id: 'full', icon: 'tune', title: 'Configurazione completa', sub: 'Per utenti esperti: scegli manualmente JAR e parametri JVM' },
        { id: 'restore', icon: 'settings_backup_restore', title: 'Ripristina da backup', sub: 'Carica un archivio .zip o ripristina da Google Drive' },
        { id: 'benchmark', icon: 'speed', title: 'Benchmark', sub: 'Misura quanti giocatori e chunk supporta il tuo telefono' }
      ];

      container.innerHTML = `
        <div class="flex flex-col gap-3 pb-8">
          <h1 class="text-lg font-extrabold text-[#F8FAFC]">Create Server — Come vuoi iniziare?</h1>
          <p class="text-xs text-[#94A3B8] -mt-1">Scegli una modalità di creazione per il tuo nuovo server Minecraft.</p>

          <div class="flex flex-col gap-2.5 mt-1">
            ${options.map(o => `
              <button type="button" data-create-start="${o.id}" class="tactile-btn w-full p-4 rounded-2xl text-left flex items-center justify-between gap-3 border ${
                o.highlight
                  ? 'bg-[#22C55E]/10 border-[#22C55E] shadow-[0_0_20px_rgba(34,197,94,0.12)]'
                  : 'bg-[#15181C] border-[#262B33] hover:border-[#22C55E]/50'
              }">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-10 h-10 rounded-xl ${o.highlight ? 'bg-[#22C55E] text-[#0B0D0E]' : 'bg-[#1C2026] text-[#22C55E]'} flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined">${o.icon}</span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-extrabold text-white">${o.title}</span>
                    <span class="text-xs text-[#94A3B8] leading-snug mt-0.5">${o.sub}</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-[#94A3B8]">chevron_right</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('[data-create-start]').forEach(btn => {
        btn.addEventListener('click', () => {
          const mode = btn.getAttribute('data-create-start');
          triggerHaptic('TICK');
          if (mode === 'benchmark') {
            this.showToast('Benchmark ARM64 completato: Punteggio 9.420 (Fino a 20 giocatori a 20,0 TPS)');
            return;
          }
          this.wizardData = this.getDefaultWizardData();
          this.createFlowStep = 1;
          this.renderViewport(true);
        });
      });
      return;
    }

    // 8-Step Guided Setup
    const step = this.createFlowStep;
    const w = this.wizardData;

    const progressSegments = Array.from({ length: 8 }, (_, idx) => {
      const active = idx + 1 <= step;
      return `<div class="h-1.5 flex-1 rounded-full ${active ? 'bg-[#22C55E]' : 'bg-[#262B33]'} transition-colors"></div>`;
    }).join('');

    let stepBody = '';

    // PASSO 1 DI 8: Nome del server
    if (step === 1) {
      const suggestions = ['Mondo Sopravvivenza', 'Hub Creativo', 'Server SMP', 'Mini Giochi', 'Mondo Modded'];
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Nome del server</h2>
        <p class="text-xs text-[#94A3B8] -mt-2">Scegli un nome riconoscibile per i tuoi amici.</p>

        <input id="wiz-name-input" type="text" value="${w.name}" placeholder="Nome del server..." class="w-full bg-[#15181C] border border-[#22C55E] rounded-xl px-3.5 py-3 text-sm font-bold text-white focus:outline-none"/>

        <div class="flex flex-wrap gap-1.5">
          ${suggestions.map(s => `
            <button type="button" data-wiz-sug="${s}" class="tactile-btn px-3 py-1.5 rounded-full text-xs font-bold border ${
              w.name === s ? 'bg-[#22C55E] text-[#0B0D0E] border-[#22C55E]' : 'bg-[#15181C] border-[#262B33] text-[#94A3B8]'
            }">${s}</button>
          `).join('')}
        </div>

        <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-1.5 mt-1">
          <label class="text-xs font-bold text-[#94A3B8]">Descrizione MOTD</label>
          <input id="wiz-motd-input" type="text" value="${w.motd}" class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 font-mono text-xs text-white focus:border-[#22C55E] focus:outline-none"/>
        </div>
      `;
    }

    // PASSO 2 DI 8: Scegli software + Toggle obbligatorio EULA
    if (step === 2) {
      const softwares = [
        { name: 'Fabric ottimizzato', badge: 'Consigliato', sub: 'Include Lithium, FerriteCore, C2ME e Krypton preconfigurati' },
        { name: 'Paper', badge: 'Plugin', sub: 'Ideale per server SMP con plugin Bukkit/Spigot ad alte prestazioni' },
        { name: 'Vanilla', badge: 'Ufficiale', sub: 'Il software originale Mojang senza modifiche' },
        { name: 'NeoForge', badge: 'Mod', sub: 'Supporto moderno per grandi modpack tecnici' },
        { name: 'Forge', badge: 'Classico', sub: 'Compatibilità con le mod classiche di Minecraft' },
        { name: 'Purpur', badge: 'Avanzato', sub: 'Fork di Paper con centinaia di opzioni di personalizzazione' },
        { name: 'PowerNukkitX', badge: 'Solo Bedrock Edition', sub: 'Server nativo per Minecraft Bedrock (telefono/console)' }
      ];
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Scegli software</h2>
        <div class="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-0.5">
          ${softwares.map(sw => {
            const sel = w.software === sw.name;
            return `
              <button type="button" data-wiz-sw="${sw.name}" class="tactile-btn p-3 rounded-xl text-left border flex items-center justify-between ${
                sel ? 'bg-[#22C55E]/15 border-[#22C55E]' : 'bg-[#15181C] border-[#262B33]'
              }">
                <div class="flex flex-col pr-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-extrabold text-white">${sw.name}</span>
                    <span class="px-1.5 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] text-[9px] font-bold">${sw.badge}</span>
                  </div>
                  <span class="text-[11px] text-[#94A3B8] mt-0.5">${sw.sub}</span>
                </div>
                <span class="w-4 h-4 rounded-full border ${sel ? 'border-[#22C55E] bg-[#22C55E]' : 'border-[#94A3B8]'} shrink-0"></span>
              </button>
            `;
          }).join('')}
        </div>

        <!-- Mandatory EULA Toggle -->
        <div class="p-3.5 rounded-2xl bg-[#15181C] border ${w.eulaAccepted ? 'border-[#22C55E]' : 'border-[#F59E0B]'} flex items-center justify-between gap-3">
          <div class="flex flex-col">
            <span class="text-xs font-bold text-white">Accetto l'EULA di Minecraft</span>
            <span class="text-[10px] text-[#94A3B8]">Obbligatorio per procedere alla creazione del server</span>
          </div>
          <button type="button" id="wiz-eula-toggle" aria-checked="${w.eulaAccepted}" class="anvil-toggle">
            <span class="anvil-toggle-thumb"></span>
          </button>
        </div>
      `;
    }

    // PASSO 3 DI 8: Scegli la versione
    if (step === 3) {
      const gridVersions = ['26.2', '1.21.11', '1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5'];
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Scegli la versione</h2>

        <button type="button" id="wiz-upload-jar" class="tactile-btn w-full py-2.5 rounded-xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E] text-xs font-bold text-[#22C55E]">
          + Carica il tuo .jar
        </button>

        <!-- Recommended Minecraft 26.3 Card -->
        <button type="button" data-wiz-ver="26.3" class="tactile-btn w-full p-4 rounded-2xl border text-left flex items-center justify-between ${
          w.version === '26.3' ? 'bg-[#22C55E]/15 border-[#22C55E]' : 'bg-[#15181C] border-[#262B33]'
        }">
          <div>
            <span class="px-2 py-0.5 rounded bg-[#22C55E] text-[#0B0D0E] text-[9px] font-extrabold uppercase">Consigliata</span>
            <h3 class="text-sm font-extrabold text-white mt-1">Minecraft 26.3</h3>
            <p class="text-[11px] text-[#94A3B8]">Ultima versione stabile con supporto ARM64 nativo</p>
          </div>
          <span class="material-symbols-outlined text-[#22C55E]">check_circle</span>
        </button>

        <div class="grid grid-cols-3 gap-2">
          ${gridVersions.map(v => `
            <button type="button" data-wiz-ver="${v}" class="tactile-btn py-2.5 rounded-xl font-mono text-xs font-bold border ${
              w.version === v ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#15181C] border-[#262B33] text-white'
            }">${v}</button>
          `).join('')}
        </div>
      `;
    }

    // PASSO 4 DI 8: Alloca RAM
    if (step === 4) {
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Alloca RAM</h2>

        <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex items-center justify-between">
          <div>
            <span class="text-xs font-bold text-white block">Modalità prestazioni</span>
            <span class="text-[11px] text-[#94A3B8]">Ottimizza i flag JVM per processori mobile</span>
          </div>
          <button type="button" id="wiz-perf-toggle" aria-checked="${w.performanceMode}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
        </div>

        <div class="p-4 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3">
          <div class="flex justify-between items-center">
            <span class="text-xs font-bold text-[#94A3B8]">RAM allocata</span>
            <span class="font-mono text-base font-extrabold text-[#22C55E]">${w.ramGb.toFixed(1).replace('.', ',')} GB</span>
          </div>
          <input id="wiz-ram-slider" type="range" min="1.0" max="3.0" step="0.5" value="${w.ramGb}" class="anvil-slider"/>

          <div class="grid grid-cols-3 gap-2 pt-1">
            ${[
              { label: 'Basso', gb: 1.0 },
              { label: 'Consigliato', gb: 2.0 },
              { label: 'Alto', gb: 3.0 }
            ].map(p => `
              <button type="button" data-wiz-rampreset="${p.gb}" class="tactile-btn py-2 rounded-xl text-xs font-bold border ${
                w.ramGb === p.gb ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-[#94A3B8]'
              }">${p.label} (${p.gb}G)</button>
            `).join('')}
          </div>
        </div>
      `;
    }

    // PASSO 5 DI 8: Impostazioni server
    if (step === 5) {
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Impostazioni server</h2>

        <div class="p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-2.5">
          <span class="text-xs font-bold text-[#94A3B8]">Modalità di gioco</span>
          <div class="grid grid-cols-2 gap-1.5">
            ${['Sopravvivenza', 'Creativa', 'Avventura', 'Spettatore'].map(gm => `
              <button type="button" data-wiz-gm="${gm}" class="tactile-btn py-2 rounded-xl text-xs font-bold border ${
                w.gamemode === gm ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-white'
              }">${gm}</button>
            `).join('')}
          </div>

          <span class="text-xs font-bold text-[#94A3B8] pt-1">Difficoltà</span>
          <div class="grid grid-cols-4 gap-1.5">
            ${['Pacifica', 'Facile', 'Normale', 'Difficile'].map(df => `
              <button type="button" data-wiz-diff="${df}" class="tactile-btn py-1.5 rounded-xl text-[11px] font-bold border ${
                w.difficulty === df ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-white'
              }">${df}</button>
            `).join('')}
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label class="text-[11px] font-bold text-[#94A3B8]">Tipo di mondo</label>
              <select id="wiz-world-type" class="w-full mt-1 bg-[#1C2026] border border-[#262B33] rounded-xl px-2.5 py-2 text-xs text-white">
                ${['Normale', 'Piatto', 'Grandi Biomi', 'Amplificato'].map(wt => `<option ${w.worldType === wt ? 'selected' : ''}>${wt}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[11px] font-bold text-[#94A3B8]">Seed (opzionale)</label>
              <input id="wiz-seed" type="text" value="${w.seed}" placeholder="Casuale" class="w-full mt-1 bg-[#1C2026] border border-[#262B33] rounded-xl px-2.5 py-2 text-xs text-white"/>
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
          ${[
            { k: 'onlineMode', l: 'Blocca giocatori non autenticati' },
            { k: 'skinRestorer', l: 'Skin dei giocatori' },
            { k: 'whitelistEnabled', l: 'Whitelist (+ Aggiungi giocatore)' },
            { k: 'sleepIfEmpty', l: 'Dormi se vuoto' }
          ].map(item => `
            <div class="p-3 flex items-center justify-between">
              <span class="text-xs font-bold text-white">${item.l}</span>
              <button type="button" data-wiz-bool5="${item.k}" aria-checked="${w[item.k]}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
            </div>
          `).join('')}
        </div>
      `;
    }

    // PASSO 6 DI 8: Extra opzionali
    if (step === 6) {
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Extra opzionali</h2>
        <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
          ${[
            { k: 'geyserEnabled', l: 'Supporto Bedrock (Geyser)', s: 'Permetti ai giocatori Bedrock di unirsi al server Java' },
            { k: 'voiceChatEnabled', l: 'Simple Voice Chat', s: 'Chat vocale di prossimità in gioco' },
            { k: 'squaremapEnabled', l: 'Mappa del mondo live (squaremap)', s: 'Mappa web interattiva in tempo reale' },
            { k: 'pregenerateChunky', l: 'Pregenera il mondo (Chunky)', s: 'Riduce il lag esplorativo pregenerando lo spawn' }
          ].map(ex => `
            <div class="p-3.5 flex items-center justify-between gap-3">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white">${ex.l}</span>
                <span class="text-[11px] text-[#94A3B8]">${ex.s}</span>
              </div>
              <button type="button" data-wiz-extra="${ex.k}" aria-checked="${w[ex.k]}" class="anvil-toggle"><span class="anvil-toggle-thumb"></span></button>
            </div>
          `).join('')}
        </div>

        ${w.geyserEnabled && w.voiceChatEnabled ? `
          <div class="p-3 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B] text-[#F59E0B] text-xs leading-relaxed">
            ⚠️ Avviso di mutua esclusione: <strong>Supporto Bedrock (Geyser)</strong> e <strong>Simple Voice Chat</strong> richiedono entrambi una porta UDP dedicata. Sul piano gratuito può essere attivo solo uno dei due alla volta.
          </div>
        ` : ''}
      `;
    }

    // PASSO 7 DI 8: Connetti giocatori
    if (step === 7) {
      const regions = [
        { id: 'Locale', title: '🏠 Rete locale (Senza tunnel)', sub: 'Solo per amici sotto lo stesso Wi-Fi / Hotspot' },
        { id: 'EU', title: '🇪🇺 Europa (Francoforte, Germania - 19 ms)', sub: 'Consigliato per l’Italia — Bassa latenza' },
        { id: 'US', title: '🇺🇸 America (256 ms)', sub: 'Ashburn, USA East' },
        { id: 'SG', title: '🇸🇬 Singapore (344 ms)', sub: 'Asia-Pacifico' }
      ];
      stepBody = `
        <h2 class="text-base font-extrabold text-white">Connetti giocatori</h2>
        <p class="text-xs text-[#94A3B8] -mt-2">Scegli come i tuoi amici si collegheranno al server.</p>

        <div class="flex flex-col gap-2.5">
          ${regions.map(r => {
            const sel = w.tunnelRegion === r.id;
            return `
              <button type="button" data-wiz-reg="${r.id}" class="tactile-btn p-3.5 rounded-2xl border text-left flex items-center justify-between ${
                sel ? 'bg-[#22C55E]/15 border-[#22C55E]' : 'bg-[#15181C] border-[#262B33]'
              }">
                <div class="flex flex-col pr-2">
                  <span class="text-xs font-extrabold text-white">${r.title}</span>
                  <span class="text-[11px] text-[#94A3B8] mt-0.5">${r.sub}</span>
                </div>
                <span class="w-4 h-4 rounded-full border ${sel ? 'border-[#22C55E] bg-[#22C55E]' : 'border-[#94A3B8]'} shrink-0"></span>
              </button>
            `;
          }).join('')}
        </div>
      `;
    }

    // PASSO 8 DI 8: Tutto pronto! (Con Coriandoli animati + Tabella riepilogativa)
    if (step === 8) {
      const confettiColors = ['#22C55E', '#F59E0B', '#3B82F6', '#EC4899', '#A855F7'];
      const confettiHtml = Array.from({ length: 28 }, (_, i) => {
        const left = Math.round((i / 28) * 100);
        const delay = (Math.random() * 0.8).toFixed(2);
        const col = confettiColors[i % confettiColors.length];
        return `<span class="confetti-piece" style="left:${left}%;background:${col};animation-delay:${delay}s"></span>`;
      }).join('');

      stepBody = `
        <div class="relative overflow-hidden rounded-2xl bg-[#15181C] border border-[#22C55E] p-4 flex flex-col gap-3">
          ${confettiHtml}
          <div class="flex items-center gap-2.5">
            <span class="text-2xl">🎉</span>
            <div>
              <h2 class="text-base font-extrabold text-white">Tutto pronto!</h2>
              <p class="text-xs text-[#22C55E]">Il tuo server è configurato e pronto per il primo avvio.</p>
            </div>
          </div>

          <div class="rounded-xl bg-[#1C2026] border border-[#262B33] divide-y divide-[#262B33] text-xs">
            <div class="p-2.5 flex justify-between"><span class="text-[#94A3B8]">Nome server</span><strong class="text-white">${w.name}</strong></div>
            <div class="p-2.5 flex justify-between"><span class="text-[#94A3B8]">Software</span><strong class="text-[#22C55E]">${w.software} ${w.version}</strong></div>
            <div class="p-2.5 flex justify-between"><span class="text-[#94A3B8]">RAM allocata</span><strong class="text-white">${w.ramGb.toFixed(1).replace('.', ',')} GB</strong></div>
            <div class="p-2.5 flex justify-between"><span class="text-[#94A3B8]">Modalità / Difficoltà</span><strong class="text-white">${w.gamemode} • ${w.difficulty}</strong></div>
            <div class="p-2.5 flex justify-between"><span class="text-[#94A3B8]">Rete / Tunnel</span><strong class="text-[#22C55E]">${w.tunnelRegion}</strong></div>
          </div>

          <button type="button" id="wiz-launch-server-btn" class="tactile-btn w-full py-3.5 mt-1 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs tracking-wider shadow-[0_4px_18px_rgba(34,197,94,0.45)]">
            ▷ AVVIA SERVER
          </button>
        </div>
      `;
    }

    const nextDisabled = (step === 2 && !w.eulaAccepted);

    container.innerHTML = `
      <div class="flex flex-col gap-3.5 pb-8">
        <!-- Top Wizard Bar -->
        <div class="flex items-center justify-between">
          <button type="button" id="wiz-prev-btn" class="tactile-btn flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white">
            <span class="material-symbols-outlined text-[16px]">arrow_back</span>
            <span>Indietro</span>
          </button>
          <span class="font-mono text-xs font-bold text-[#22C55E]">Passo ${step} di 8</span>
        </div>

        <!-- 8-Segment Progress Bar -->
        <div class="flex items-center gap-1.5">
          ${progressSegments}
        </div>

        ${stepBody}

        ${step < 8 ? `
          <button type="button" id="wiz-next-btn" ${nextDisabled ? 'disabled' : ''} class="tactile-btn w-full py-3.5 mt-1 rounded-xl font-extrabold text-xs tracking-wider ${
            nextDisabled
              ? 'bg-[#262B33] text-[#64748B] cursor-not-allowed'
              : 'bg-[#22C55E] text-[#0B0D0E] shadow-[0_4px_16px_rgba(34,197,94,0.35)]'
          }">
            AVANTI →
          </button>
        ` : ''}
      </div>
    `;

    // Bind Wizard Step Events
    document.getElementById('wiz-prev-btn')?.addEventListener('click', () => {
      this.createFlowStep -= 1;
      triggerHaptic('TICK');
      this.renderViewport(true);
    });
    document.getElementById('wiz-next-btn')?.addEventListener('click', () => {
      if (step === 2 && !w.eulaAccepted) return;
      this.createFlowStep += 1;
      triggerHaptic('TICK');
      this.renderViewport(true);
    });

    if (step === 1) {
      document.getElementById('wiz-name-input')?.addEventListener('input', (e) => { w.name = e.target.value; });
      document.getElementById('wiz-motd-input')?.addEventListener('input', (e) => { w.motd = e.target.value; });
      container.querySelectorAll('[data-wiz-sug]').forEach(btn => {
        btn.addEventListener('click', () => {
          w.name = btn.getAttribute('data-wiz-sug');
          this.renderCreateScreen(container);
        });
      });
    }
    if (step === 2) {
      container.querySelectorAll('[data-wiz-sw]').forEach(btn => {
        btn.addEventListener('click', () => {
          w.software = btn.getAttribute('data-wiz-sw');
          this.renderCreateScreen(container);
        });
      });
      document.getElementById('wiz-eula-toggle')?.addEventListener('click', () => {
        w.eulaAccepted = !w.eulaAccepted;
        triggerHaptic('TICK');
        this.renderCreateScreen(container);
      });
    }
    if (step === 3) {
      document.getElementById('wiz-upload-jar')?.addEventListener('click', () => {
        this.showToast('Selezionato server custom .jar (26.3)');
      });
      container.querySelectorAll('[data-wiz-ver]').forEach(btn => {
        btn.addEventListener('click', () => {
          w.version = btn.getAttribute('data-wiz-ver');
          this.renderCreateScreen(container);
        });
      });
    }
    if (step === 4) {
      document.getElementById('wiz-perf-toggle')?.addEventListener('click', () => {
        w.performanceMode = !w.performanceMode;
        this.renderCreateScreen(container);
      });
      document.getElementById('wiz-ram-slider')?.addEventListener('input', (e) => {
        w.ramGb = Number(e.target.value);
        this.renderCreateScreen(container);
      });
      container.querySelectorAll('[data-wiz-rampreset]').forEach(btn => {
        btn.addEventListener('click', () => {
          w.ramGb = Number(btn.getAttribute('data-wiz-rampreset'));
          this.renderCreateScreen(container);
        });
      });
    }
    if (step === 5) {
      container.querySelectorAll('[data-wiz-gm]').forEach(btn => {
        btn.addEventListener('click', () => { w.gamemode = btn.getAttribute('data-wiz-gm'); this.renderCreateScreen(container); });
      });
      container.querySelectorAll('[data-wiz-diff]').forEach(btn => {
        btn.addEventListener('click', () => { w.difficulty = btn.getAttribute('data-wiz-diff'); this.renderCreateScreen(container); });
      });
      document.getElementById('wiz-world-type')?.addEventListener('change', (e) => { w.worldType = e.target.value; });
      document.getElementById('wiz-seed')?.addEventListener('input', (e) => { w.seed = e.target.value; });
      container.querySelectorAll('[data-wiz-bool5]').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-wiz-bool5');
          w[k] = !w[k];
          this.renderCreateScreen(container);
        });
      });
    }
    if (step === 6) {
      container.querySelectorAll('[data-wiz-extra]').forEach(btn => {
        btn.addEventListener('click', () => {
          const k = btn.getAttribute('data-wiz-extra');
          w[k] = !w[k];
          this.renderCreateScreen(container);
        });
      });
    }
    if (step === 7) {
      container.querySelectorAll('[data-wiz-reg]').forEach(btn => {
        btn.addEventListener('click', () => {
          w.tunnelRegion = btn.getAttribute('data-wiz-reg');
          this.renderCreateScreen(container);
        });
      });
    }
    if (step === 8) {
      document.getElementById('wiz-launch-server-btn')?.addEventListener('click', () => {
        store.createServerFromWizard(w);
        this.createFlowStep = 0;
        this.activeTab = 'home';
        this.renderBottomNav();
        this.renderViewport(true);
      });
    }
  }

  /* =========================================================================
   * SCHERMATA 4: FILE (File Manager Completo)
   * ========================================================================= */
  renderFilesScreen(container) {
    const servers = store.state.servers;

    // Root "Home" folder showing server folders
    if (!this.fileCurrentServerId) {
      container.innerHTML = `
        <div class="flex flex-col gap-3 pb-8">
          <div class="flex items-center justify-between">
            <h1 class="text-base font-extrabold text-[#F8FAFC]">File — Home</h1>
            <span class="font-mono text-xs text-[#94A3B8]">${servers.length} server</span>
          </div>

          <div class="flex flex-col gap-2">
            ${servers.map(s => `
              <button type="button" data-enter-srv-files="${s.id}" class="tactile-btn w-full p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E]/50 flex items-center justify-between text-left">
                <div class="flex items-center gap-3">
                  <span class="material-symbols-outlined text-[#22C55E] text-[24px]">folder</span>
                  <div class="flex flex-col">
                    <span class="text-sm font-bold text-white">${s.name}</span>
                    <span class="text-[11px] text-[#94A3B8]">${s.software} ${s.version} • ${s.fsItems.length} elementi</span>
                  </div>
                </div>
                <span class="material-symbols-outlined text-[#94A3B8]">chevron_right</span>
              </button>
            `).join('')}
          </div>
        </div>
      `;
      container.querySelectorAll('[data-enter-srv-files]').forEach(btn => {
        btn.addEventListener('click', () => {
          triggerHaptic('TICK');
          this.fileCurrentServerId = btn.getAttribute('data-enter-srv-files');
          this.renderFilesScreen(container);
        });
      });
      return;
    }

    const srv = servers.find(s => s.id === this.fileCurrentServerId) || store.getActiveServer();
    if (!srv) {
      this.fileCurrentServerId = null;
      this.renderFilesScreen(container);
      return;
    }

    // Integrated Text Editor View if a file is open
    if (this.editingFileName) {
      const fileObj = srv.fsItems.find(f => f.name === this.editingFileName);
      if (fileObj) {
        container.innerHTML = `
          <div class="flex flex-col gap-3 pb-8">
            <div class="flex items-center justify-between">
              <button type="button" id="btn-close-editor" class="tactile-btn flex items-center gap-1 text-xs font-bold text-[#94A3B8] hover:text-white">
                <span class="material-symbols-outlined text-[18px]">arrow_back</span>
                <span>${srv.name} / ${fileObj.name}</span>
              </button>
              <button type="button" id="btn-save-file-editor" class="tactile-btn px-3.5 py-1.5 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs">
                Salva
              </button>
            </div>

            <textarea id="file-editor-textarea" rows="18" spellcheck="false" class="w-full rounded-2xl bg-[#08090A] border border-[#262B33] focus:border-[#22C55E] p-3.5 font-mono text-xs text-[#F8FAFC] leading-relaxed focus:outline-none">${fileObj.content || ''}</textarea>
          </div>
        `;
        document.getElementById('btn-close-editor')?.addEventListener('click', () => {
          this.editingFileName = null;
          this.renderFilesScreen(container);
        });
        document.getElementById('btn-save-file-editor')?.addEventListener('click', () => {
          const val = document.getElementById('file-editor-textarea')?.value || '';
          fileObj.content = val;
          fileObj.sizeBytes = val.length;
          fileObj.modified = 'Adesso';
          fileObj.timestamp = Math.floor(Date.now() / 1000);
          store.saveState();
          triggerHaptic('SUCCESS');
          this.showToast(`Salvataggio di ${fileObj.name} completato!`);
        });
        return;
      }
    }

    // Filter & Sort items
    let items = [...(srv.fsItems || [])];
    if (this.fileSearchQuery) {
      const q = this.fileSearchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    if (this.fileSortBy === 'name') {
      items.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'folder' ? -1 : 1));
    } else if (this.fileSortBy === 'recent') {
      items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (this.fileSortBy === 'size') {
      items.sort((a, b) => (b.sizeBytes || 0) - (a.sizeBytes || 0));
    }

    container.innerHTML = `
      <div class="flex flex-col gap-2.5 pb-8">
        <!-- Warning Banner if Server is ONLINE -->
        ${srv.status !== 'offline' ? `
          <div class="p-3 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/50 text-[#F59E0B] text-xs leading-relaxed">
            ⚠️ Questo server è acceso. Fermalo prima di cambiare i file del mondo, o il server potrebbe sovrascrivere le tue modifiche.
          </div>
        ` : ''}

        <!-- Breadcrumb & Top Actions -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1 text-xs font-bold">
            <button type="button" id="btn-breadcrumb-home" class="text-[#94A3B8] hover:text-white">Home</button>
            <span class="text-[#64748B]">&gt;</span>
            <span class="text-[#22C55E]">${srv.name}</span>
          </div>

          <div class="flex items-center gap-1.5">
            <button type="button" id="btn-toggle-multiselect" class="tactile-btn px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
              this.fileMultiSelect ? 'bg-[#22C55E] text-[#0B0D0E] border-[#22C55E]' : 'bg-[#15181C] border-[#262B33] text-[#94A3B8]'
            }">
              Selezione Multipla
            </button>
            <button type="button" id="btn-add-file-sheet" class="tactile-btn w-7 h-7 rounded-lg bg-[#22C55E] text-[#0B0D0E] font-bold flex items-center justify-center">
              +
            </button>
          </div>
        </div>

        <!-- Multi-Select Action Bar (Copia, Taglia, Sposta in..., Elimina) -->
        ${this.fileMultiSelect ? `
          <div class="p-2 rounded-xl bg-[#1C2026] border border-[#22C55E]/40 grid grid-cols-4 gap-1.5 text-center">
            <button type="button" data-ms-act="Copia" class="tactile-btn py-1.5 rounded-lg bg-[#15181C] text-xs font-bold text-white">Copia</button>
            <button type="button" data-ms-act="Taglia" class="tactile-btn py-1.5 rounded-lg bg-[#15181C] text-xs font-bold text-white">Taglia</button>
            <button type="button" data-ms-act="Sposta" class="tactile-btn py-1.5 rounded-lg bg-[#15181C] text-xs font-bold text-white">Sposta in...</button>
            <button type="button" data-ms-act="Elimina" class="tactile-btn py-1.5 rounded-lg bg-[#EF4444]/20 text-xs font-bold text-[#EF4444]">Elimina</button>
          </div>
        ` : ''}

        <!-- Search Input -->
        <div class="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#15181C] border border-[#262B33] focus-within:border-[#22C55E]">
          <span class="text-xs">🔍</span>
          <input id="file-search-input" type="text" value="${this.fileSearchQuery}" placeholder="Cerca file..." class="bg-transparent text-xs text-white w-full focus:outline-none"/>
        </div>

        <!-- 3 Sorting Chips: 📁 Nome | 🕒 Più recenti | 📊 Più grandi -->
        <div class="flex items-center gap-1.5">
          ${[
            { id: 'name', label: '📁 Nome' },
            { id: 'recent', label: '🕒 Più recenti' },
            { id: 'size', label: '📊 Più grandi' }
          ].map(s => `
            <button type="button" data-file-sort="${s.id}" class="tactile-btn px-3 py-1.5 rounded-xl text-xs font-bold border ${
              this.fileSortBy === s.id ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#15181C] border-[#262B33] text-[#94A3B8]'
            }">${s.label}</button>
          `).join('')}
        </div>

        <!-- Files & Folders List -->
        <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden">
          ${items.map(item => {
            const checked = this.fileSelectedSet.has(item.name);
            return `
              <div data-fs-row="${item.name}" data-fs-type="${item.type}" class="p-3 flex items-center justify-between gap-3 hover:bg-[#1C2026] cursor-pointer">
                <div class="flex items-center gap-3 min-w-0">
                  ${this.fileMultiSelect ? `
                    <input type="checkbox" ${checked ? 'checked' : ''} class="w-4 h-4 accent-[#22C55E] rounded pointer-events-none"/>
                  ` : ''}
                  <span class="material-symbols-outlined text-[20px] ${item.type === 'folder' ? 'text-[#22C55E]' : 'text-[#94A3B8]'}">
                    ${item.type === 'folder' ? 'folder' : 'description'}
                  </span>
                  <div class="flex flex-col min-w-0">
                    <span class="text-xs font-bold text-white truncate">${item.name}</span>
                    <span class="text-[10px] text-[#94A3B8]">${item.modified}</span>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="font-mono text-[11px] text-[#94A3B8]">${formatBytesIt(item.sizeBytes)}</span>
                  <span class="material-symbols-outlined text-[#64748B] text-[16px]">chevron_right</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-breadcrumb-home')?.addEventListener('click', () => {
      this.fileCurrentServerId = null;
      this.fileMultiSelect = false;
      this.fileSelectedSet.clear();
      this.renderFilesScreen(container);
    });
    document.getElementById('btn-toggle-multiselect')?.addEventListener('click', () => {
      this.fileMultiSelect = !this.fileMultiSelect;
      this.fileSelectedSet.clear();
      this.renderFilesScreen(container);
    });
    document.getElementById('btn-add-file-sheet')?.addEventListener('click', () => this.openAddToServerFilesSheet(srv));
    document.getElementById('file-search-input')?.addEventListener('input', (e) => {
      this.fileSearchQuery = e.target.value;
      this.renderFilesScreen(container);
      const ref = document.getElementById('file-search-input');
      if (ref) { ref.focus(); ref.setSelectionRange(ref.value.length, ref.value.length); }
    });
    container.querySelectorAll('[data-file-sort]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.fileSortBy = btn.getAttribute('data-file-sort');
        triggerHaptic('TICK');
        this.renderFilesScreen(container);
      });
    });
    container.querySelectorAll('[data-ms-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-ms-act');
        if (this.fileSelectedSet.size === 0) {
          this.showToast('Seleziona almeno un file o cartella');
          return;
        }
        if (act === 'Elimina') {
          srv.fsItems = srv.fsItems.filter(i => !this.fileSelectedSet.has(i.name));
          this.fileSelectedSet.clear();
          store.saveState();
          this.renderFilesScreen(container);
          this.showToast('Elementi selezionati eliminati');
        } else {
          this.showToast(`${act} eseguita su ${this.fileSelectedSet.size} elementi`);
        }
      });
    });
    container.querySelectorAll('[data-fs-row]').forEach(row => {
      row.addEventListener('click', () => {
        const name = row.getAttribute('data-fs-row');
        const type = row.getAttribute('data-fs-type');
        if (this.fileMultiSelect) {
          if (this.fileSelectedSet.has(name)) this.fileSelectedSet.delete(name);
          else this.fileSelectedSet.add(name);
          this.renderFilesScreen(container);
          return;
        }
        if (type === 'file') {
          this.editingFileName = name;
          this.renderFilesScreen(container);
        } else {
          this.showToast(`Cartella /${name} (${srv.name})`);
        }
      });
    });
  }

  /* =========================================================================
   * SCHERMATA 5: PROFILO
   * ========================================================================= */
  renderProfileScreen(container) {
    const st = store.state;

    container.innerHTML = `
      <div class="flex flex-col gap-3.5 pb-8">
        <!-- User Header Card -->
        <div class="p-4 rounded-2xl bg-[#15181C] border border-[#262B33] flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-12 h-12 rounded-full bg-[#22C55E]/20 border border-[#22C55E] text-[#22C55E] flex items-center justify-center font-extrabold text-lg shrink-0">
              TM
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-sm font-extrabold text-white truncate">${st.userEmail}</span>
              <span class="text-xs text-[#94A3B8]">ID Account: #ANV-20794</span>
            </div>
          </div>
          <span class="px-2.5 py-1 rounded-full ${st.isPremium ? 'bg-[#22C55E] text-[#0B0D0E]' : 'bg-[#1C2026] border border-[#262B33] text-[#94A3B8]'} font-mono text-[10px] font-extrabold">
            ${st.isPremium ? 'PREMIUM' : 'GRATIS'}
          </span>
        </div>

        <!-- Card Anvil-MC Gratis + Bottone Verde 👑 Abbonati ora -->
        <div class="p-4 rounded-2xl bg-gradient-to-br from-[#15181C] to-[#112218] border border-[#22C55E]/40 flex flex-col gap-2.5">
          <div class="flex items-center justify-between">
            <span class="text-sm font-extrabold text-white">${st.isPremium ? 'Anvil-MC Premium Attivo' : 'Anvil-MC Gratis'}</span>
            <span class="text-xs text-[#22C55E] font-bold">.anvil-mc.app</span>
          </div>
          <p class="text-xs text-[#94A3B8] leading-relaxed">
            Ottieni un dominio fisso personalizzato <code>.anvil-mc.app</code>, tunnel 24/7 senza pubblicità e slot illimitati.
          </p>
          <button type="button" id="prof-btn-subscribe" class="tactile-btn w-full py-2.5 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(34,197,94,0.3)]">
            <span>👑 Abbonati ora</span>
          </button>
        </div>

        <!-- Banner 🎁 Invita amici -->
        <button type="button" id="prof-btn-invite" class="tactile-btn w-full p-3.5 rounded-2xl bg-[#15181C] border border-[#262B33] hover:border-[#22C55E] flex items-center justify-between text-left">
          <div class="flex items-center gap-3">
            <span class="text-xl">🎁</span>
            <div>
              <span class="text-xs font-extrabold text-white block">Invita amici</span>
              <span class="text-[11px] text-[#94A3B8]">Guadagna ore di tunnel pubblico gratuito per ogni amico</span>
            </div>
          </div>
          <span class="material-symbols-outlined text-[#94A3B8]">chevron_right</span>
        </button>

        <!-- Sezione ACCOUNT -->
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider px-1">ACCOUNT</span>
          <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden text-xs">
            <div class="p-3.5 flex justify-between items-center"><span class="text-white font-semibold">Metodo di accesso</span><span class="text-[#94A3B8]">Google (${st.userEmail})</span></div>
            <div class="p-3.5 flex justify-between items-center"><span class="text-white font-semibold">Limite sessione dominio</span><span class="text-[#22C55E] font-bold">${st.isPremium ? 'Illimitato 24/7' : '2 ore (Estendibili a 5h)'}</span></div>
            <button type="button" data-prof-toast="Dashboard Web aperta (panel.anvil-mc.com)" class="w-full p-3.5 flex justify-between items-center text-left hover:bg-[#1C2026]"><span class="text-white font-semibold">Dashboard web</span><span class="text-[#94A3B8]">↗</span></button>
          </div>
        </div>

        <!-- Sezione PREFERENZE -->
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider px-1">PREFERENZE</span>
          <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden text-xs">
            <div class="p-3.5 flex justify-between items-center"><span class="text-white font-semibold">Lingua</span><span class="text-[#22C55E] font-bold">Italiano 🇮🇹</span></div>
            <div class="p-3.5 flex justify-between items-center"><span class="text-white font-semibold">Tema</span><span class="text-[#94A3B8]">Dark Carbon (#0B0D0E)</span></div>
            <button type="button" id="prof-btn-tour" class="w-full p-3.5 flex justify-between items-center text-left hover:bg-[#1C2026]"><span class="text-white font-semibold">Tour guidato</span><span class="text-[#22C55E]">Avvia →</span></button>
          </div>
        </div>

        <!-- Sezione SUPPORTO & APP -->
        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider px-1">SUPPORTO & APP</span>
          <div class="rounded-2xl bg-[#15181C] border border-[#262B33] divide-y divide-[#262B33] overflow-hidden text-xs">
            <button type="button" data-prof-toast="Modulo feedback inviato al team Anvil-MC" class="w-full p-3.5 flex justify-between items-center text-left hover:bg-[#1C2026]"><span class="text-white font-semibold">Invia feedback</span><span class="material-symbols-outlined text-[16px] text-[#94A3B8]">chevron_right</span></button>
            <button type="button" data-prof-toast="Apertura Centro Assistenza & FAQ Anvil-MC" class="w-full p-3.5 flex justify-between items-center text-left hover:bg-[#1C2026]"><span class="text-white font-semibold">FAQ e Aiuto</span><span class="material-symbols-outlined text-[16px] text-[#94A3B8]">chevron_right</span></button>
            <button type="button" data-prof-toast="Licenze OpenJDK, Fabric Loader e GeyserMC" class="w-full p-3.5 flex justify-between items-center text-left hover:bg-[#1C2026]"><span class="text-white font-semibold">Legale e Licenze</span><span class="material-symbols-outlined text-[16px] text-[#94A3B8]">chevron_right</span></button>
            <button type="button" data-prof-toast="Novità v2.0.7: Supporto Minecraft 26.3 + Java 25 ARM64 + Nuovi Tunnel EU" class="w-full p-3.5 flex justify-between items-center text-left hover:bg-[#1C2026]"><span class="text-white font-semibold">Novità v2.0.7</span><span class="px-2 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E] font-mono text-[10px] font-bold">NEW</span></button>
          </div>
        </div>

        <!-- Pulsante Rosso ESCI -->
        <button type="button" id="prof-btn-logout" class="tactile-btn w-full py-3 rounded-2xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] font-extrabold text-xs">
          ESCI
        </button>

        <div class="text-center font-mono text-[11px] text-[#64748B] pt-1">
          Anvil-MC.com v2.0.7
        </div>
      </div>
    `;

    document.getElementById('prof-btn-subscribe')?.addEventListener('click', () => this.openPremiumPaywallModal());
    document.getElementById('prof-btn-invite')?.addEventListener('click', () => {
      this.shareTextNativeOrWeb('Anvil-MC Invite', 'Scarica Anvil-MC v2.0.7 e crea un server Minecraft gratis dal tuo telefono!');
    });
    document.getElementById('prof-btn-tour')?.addEventListener('click', () => {
      this.wizardData = this.getDefaultWizardData();
      this.createFlowStep = 1;
      this.switchTab('create');
    });
    container.querySelectorAll('[data-prof-toast]').forEach(btn => {
      btn.addEventListener('click', () => this.showToast(btn.getAttribute('data-prof-toast')));
    });
    document.getElementById('prof-btn-logout')?.addEventListener('click', () => {
      this.showToast('Sessione disconnessa (Modalità Ospite Locale attiva)');
    });
  }

  /* =========================================================================
   * MODALS & BOTTOM SHEETS
   * ========================================================================= */
  closeModal() {
    this.activeModal = null;
    const host = document.getElementById('app-modal-host');
    if (host) host.innerHTML = '';
  }

  // 1. Tunnel Region Selector Sheet (EU, US, SG, Locale)
  openTunnelSelectorSheet() {
    this.activeModal = 'tunnel';
    const host = document.getElementById('app-modal-host');
    if (!host) return;
    const cur = store.state.tunnelRegion;

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-[#15181C] border-t border-[#262B33] rounded-t-3xl p-4 pb-8 flex flex-col gap-3">
          <div class="w-10 h-1 bg-[#262B33] rounded-full mx-auto"></div>
          <h3 class="text-sm font-extrabold text-white">🌐 Seleziona Regione Tunnel</h3>
          <div class="flex flex-col gap-2">
            ${[
              { id: 'EU', label: '🇪🇺 Europa (Francoforte)', ping: '19 ms' },
              { id: 'US', label: '🇺🇸 America (Virginia)', ping: '142 ms' },
              { id: 'SG', label: '🇸🇬 Asia (Singapore)', ping: '280 ms' },
              { id: 'Locale', label: '🏠 Solo Rete Locale (Wi-Fi)', ping: '1 ms' }
            ].map(r => `
              <button type="button" data-sel-tunnel="${r.id}" class="tactile-btn p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                cur === r.id ? 'bg-[#22C55E]/15 border-[#22C55E] text-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-white'
              }">
                <span>${r.label}</span>
                <span class="font-mono text-[11px]">${r.ping}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
    host.querySelectorAll('[data-sel-tunnel]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.state.tunnelRegion = btn.getAttribute('data-sel-tunnel');
        store.notify('tunnel-changed');
        this.closeModal();
        this.showToast(`Regione tunnel impostata su: ${store.state.tunnelRegion}`);
      });
    });
  }

  // 2. Post-Boot Automatic Bottom Sheet: "Lascia che gli amici si uniscano al tuo mondo"
  openFriendsJoinSheet() {
    this.activeModal = 'friends-join';
    const host = document.getElementById('app-modal-host');
    if (!host) return;
    const srv = store.getActiveServer();

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-[#15181C] border-t border-[#262B33] rounded-t-3xl p-5 pb-8 flex flex-col gap-3.5 text-center">
          <div class="w-10 h-1 bg-[#262B33] rounded-full mx-auto"></div>
          <div class="w-12 h-12 rounded-2xl bg-[#22C55E]/15 border border-[#22C55E]/40 flex items-center justify-center text-2xl mx-auto">
            🌍
          </div>
          <h3 class="text-base font-extrabold text-white">Lascia che gli amici si uniscano al tuo mondo</h3>
          <p class="text-xs text-[#94A3B8] leading-relaxed">
            Il tuo server è acceso in locale. Attiva un tunnel pubblico per far entrare i tuoi amici anche fuori dal tuo Wi-Fi!
          </p>

          <button type="button" id="btn-friends-trial" class="tactile-btn w-full py-3.5 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs shadow-[0_4px_16px_rgba(34,197,94,0.35)]">
            Inizia la prova gratuita di 3 giorni →
          </button>

          <button type="button" id="btn-friends-ad" class="tactile-btn w-full p-3 rounded-xl bg-[#1C2026] border border-[#262B33] hover:border-[#22C55E] flex flex-col items-center gap-0.5">
            <span class="text-xs font-extrabold text-white">▶ Guarda un annuncio di 30 secondi</span>
            <span class="text-[10px] text-[#94A3B8]">Sblocca 2 ore di tunnel IP pubblico gratuito, estendibili a 5</span>
          </button>

          <button type="button" id="btn-friends-local" class="text-xs font-semibold text-[#94A3B8] hover:text-white pt-1">
            No grazie, gioca in locale
          </button>
        </div>
      </div>
    `;

    document.getElementById('btn-friends-trial')?.addEventListener('click', () => {
      this.closeModal();
      this.openPremiumPaywallModal();
    });
    document.getElementById('btn-friends-ad')?.addEventListener('click', () => {
      if (srv) {
        srv.publicDomain = `${srv.name.toLowerCase().replace(/\s+/g, '-')}.eu.anvil-mc.app`;
        srv.tunnelHoursLeft = 2;
        store.notify('domain-unlocked');
      }
      this.closeModal();
      this.showToast(`Tunnel pubblico sbloccato per 2 ore: ${srv?.publicDomain}`);
    });
    document.getElementById('btn-friends-local')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
  }

  // 3. Diagnostic Bottom Sheet (?) — "Probabilmente è questo — Ora non c'è un indirizzo pubblico"
  openDiagnosticHelpSheet() {
    this.activeModal = 'diag-help';
    const host = document.getElementById('app-modal-host');
    if (!host) return;
    const srv = store.getActiveServer();

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-[#15181C] border-t border-[#262B33] rounded-t-3xl p-5 pb-8 flex flex-col gap-3">
          <div class="w-10 h-1 bg-[#262B33] rounded-full mx-auto"></div>
          <span class="px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#F59E0B] text-[10px] font-bold self-start">DIAGNOSTICA RETE</span>
          <h3 class="text-base font-extrabold text-white">Probabilmente è questo — Ora non c'è un indirizzo pubblico</h3>
          <p class="text-xs text-[#94A3B8] leading-relaxed">
            L'indirizzo <code>${srv?.localIp || '10.209.160.27:25565'}</code> funziona solo per chi è collegato al tuo stesso Wi-Fi. Per far entrare amici da fuori casa serve un indirizzo pubblico.
          </p>

          <button type="button" id="diag-new-addr" class="tactile-btn w-full py-3 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-xs">
            ↻ Ottieni un nuovo indirizzo
          </button>

          <button type="button" id="diag-fixed-addr" class="tactile-btn w-full py-3 rounded-xl bg-[#1C2026] border border-[#262B33] text-white font-bold text-xs">
            Ottieni un indirizzo fisso
          </button>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" id="diag-works" class="tactile-btn py-2.5 rounded-xl bg-[#1C2026] text-[#22C55E] font-bold text-xs">✓ Ora funziona</button>
            <button type="button" id="diag-not-this" class="tactile-btn py-2.5 rounded-xl bg-[#1C2026] text-[#94A3B8] font-bold text-xs">Non è questo</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('diag-new-addr')?.addEventListener('click', () => {
      if (srv) {
        srv.publicDomain = `node-${Math.floor(100 + Math.random() * 899)}.eu.anvil-mc.app`;
        store.notify('domain-unlocked');
      }
      this.closeModal();
      this.showToast(`Nuovo indirizzo pubblico generato: ${srv?.publicDomain}`);
    });
    document.getElementById('diag-fixed-addr')?.addEventListener('click', () => {
      this.closeModal();
      this.openPremiumPaywallModal();
    });
    document.getElementById('diag-works')?.addEventListener('click', () => {
      this.closeModal();
      this.showToast('Ottimo! Buon divertimento sul server.');
    });
    document.getElementById('diag-not-this')?.addEventListener('click', () => {
      this.closeModal();
      this.showToast('Verifica che la porta 25565 non sia bloccata dal firewall.');
    });
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
  }

  // 4. Fullscreen Paywall Modal: Anvil-MC PREMIUM
  openPremiumPaywallModal() {
    this.activeModal = 'premium-paywall';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    const renderPaywall = () => {
      host.innerHTML = `
        <div class="fixed inset-0 z-50 bg-[#0B0D0E] overflow-y-auto p-5 flex flex-col justify-between max-w-lg mx-auto">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-1 rounded-full bg-[#22C55E]/20 text-[#22C55E] font-extrabold text-xs">👑 Anvil-MC PREMIUM</span>
              <button type="button" id="paywall-close" class="w-8 h-8 rounded-full bg-[#15181C] border border-[#262B33] text-[#94A3B8] flex items-center justify-center">✕</button>
            </div>

            <h2 class="text-xl font-extrabold text-white leading-tight">
              Un indirizzo fisso per il server <span class="text-[#22C55E]">.anvil-mc.app</span>
            </h2>
            <p class="text-xs text-[#94A3B8]">
              Niente più indirizzi che cambiano ogni 2 ore o annunci pubblicitari. I tuoi amici entrano sempre con lo stesso IP.
            </p>

            <!-- Plan Selection: MENSILE vs ANNUALE -->
            <div class="grid grid-cols-2 gap-2.5 mt-1">
              <button type="button" data-plan-sel="monthly" class="tactile-btn p-3.5 rounded-2xl border text-left flex flex-col justify-between ${
                this.premiumPlan === 'monthly' ? 'bg-[#22C55E]/15 border-[#22C55E]' : 'bg-[#15181C] border-[#262B33]'
              }">
                <span class="text-[11px] font-bold text-[#94A3B8] uppercase">MENSILE</span>
                <span class="text-base font-extrabold text-white mt-1">2,99 €/mese</span>
                <span class="text-[10px] text-[#94A3B8] mt-1">Fatturato ogni mese</span>
              </button>

              <button type="button" data-plan-sel="annual" class="tactile-btn p-3.5 rounded-2xl border text-left flex flex-col justify-between relative ${
                this.premiumPlan === 'annual' ? 'bg-[#22C55E]/15 border-[#22C55E]' : 'bg-[#15181C] border-[#262B33]'
              }">
                <span class="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-[#22C55E] text-[#0B0D0E] text-[9px] font-extrabold">-44% RISPARMIO</span>
                <span class="text-[11px] font-bold text-[#22C55E] uppercase">ANNUALE</span>
                <span class="text-base font-extrabold text-white mt-1">1,67 €/mese</span>
                <span class="text-[10px] text-[#94A3B8] mt-1">19,99 €/anno • 7 giorni gratis</span>
              </button>
            </div>

            <!-- Timeline Prova Gratuita (Oggi, Giorno 5, Giorno 7) -->
            <div class="p-4 rounded-2xl bg-[#15181C] border border-[#262B33] flex flex-col gap-3 mt-1">
              <span class="text-xs font-bold text-white">Come funziona la tua prova gratuita:</span>
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-[#22C55E] text-[#0B0D0E] font-bold text-xs flex items-center justify-center shrink-0">✓</span>
                <div>
                  <span class="text-xs font-bold text-white block">Oggi — Sblocco immediato</span>
                  <span class="text-[11px] text-[#94A3B8]">Ottieni subito il tuo dominio fisso .anvil-mc.app e tunnel illimitati.</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-[#1C2026] border border-[#22C55E] text-[#22C55E] font-bold text-xs flex items-center justify-center shrink-0">🔔</span>
                <div>
                  <span class="text-xs font-bold text-white block">Giorno 5 — Promemoria</span>
                  <span class="text-[11px] text-[#94A3B8]">Ti invieremo una notifica 2 giorni prima della scadenza della prova.</span>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <span class="w-6 h-6 rounded-full bg-[#1C2026] border border-[#262B33] text-[#94A3B8] font-bold text-xs flex items-center justify-center shrink-0">👑</span>
                <div>
                  <span class="text-xs font-bold text-white block">Giorno 7 — Inizio abbonamento</span>
                  <span class="text-[11px] text-[#94A3B8]">Puoi disdire in qualsiasi momento con un clic su Google Play.</span>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-2 pt-4">
            <button type="button" id="paywall-start-trial" class="tactile-btn w-full py-3.5 rounded-xl bg-[#22C55E] text-[#0B0D0E] font-extrabold text-sm shadow-[0_4px_20px_rgba(34,197,94,0.4)]">
              Inizia 7 giorni gratis →
            </button>
            <span class="text-[10px] text-center text-[#64748B]">Nessun addebito oggi • Annulla quando vuoi</span>
          </div>
        </div>
      `;

      document.getElementById('paywall-close')?.addEventListener('click', () => this.closeModal());
      host.querySelectorAll('[data-plan-sel]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.premiumPlan = btn.getAttribute('data-plan-sel');
          renderPaywall();
        });
      });
      document.getElementById('paywall-start-trial')?.addEventListener('click', () => {
        store.state.isPremium = true;
        const srv = store.getActiveServer();
        if (srv) {
          srv.publicDomain = `${srv.name.toLowerCase().replace(/\s+/g, '-')}.anvil-mc.app`;
        }
        store.notify('premium-activated');
        this.closeModal();
        this.showToast('🎉 Prova gratuita 7 giorni Anvil-MC PREMIUM attivata!');
      });
    };

    renderPaywall();
  }

  // 5. Players Bottom Sheet (with 5 Filter Chips: ✓ Online 0, 👤 Tutti 1, ✓ Whitelist 0, 🛡️ Admin 1, 🚫 Bannati 0)
  openPlayersBottomSheet() {
    this.activeModal = 'players-sheet';
    const host = document.getElementById('app-modal-host');
    if (!host) return;
    const srv = store.getActiveServer();
    if (!srv) return;

    const renderSheet = () => {
      const all = srv.players || [];
      const cOnline = all.filter(p => p.online && !p.banned).length;
      const cAll = all.length;
      const cWl = all.filter(p => p.whitelisted).length;
      const cAdmin = all.filter(p => p.admin).length;
      const cBanned = all.filter(p => p.banned).length;

      const filtered = all.filter(p => {
        if (this.playersFilter === 'online' && (!p.online || p.banned)) return false;
        if (this.playersFilter === 'whitelist' && !p.whitelisted) return false;
        if (this.playersFilter === 'admin' && !p.admin) return false;
        if (this.playersFilter === 'banned' && !p.banned) return false;
        if (this.playersSearch) {
          return p.username.toLowerCase().includes(this.playersSearch.toLowerCase());
        }
        return true;
      });

      host.innerHTML = `
        <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
          <div class="sheet-enter w-full max-w-lg bg-[#15181C] border-t border-[#262B33] rounded-t-3xl p-4 pb-8 flex flex-col gap-3 max-h-[82vh]">
            <div class="w-10 h-1 bg-[#262B33] rounded-full mx-auto"></div>
            <div class="flex items-center justify-between">
              <h3 class="text-base font-extrabold text-white">Giocatori — ${srv.name}</h3>
              <button type="button" id="btn-add-mock-player" class="text-xs font-bold text-[#22C55E]">+ Aggiungi giocatore</button>
            </div>

            <!-- 5 Filter Chips -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              ${[
                { id: 'online', label: `✓ Online ${cOnline}` },
                { id: 'all', label: `👤 Tutti ${cAll}` },
                { id: 'whitelist', label: `✓ Whitelist ${cWl}` },
                { id: 'admin', label: `🛡️ Admin ${cAdmin}` },
                { id: 'banned', label: `🚫 Bannati ${cBanned}` }
              ].map(ch => `
                <button type="button" data-pl-chip="${ch.id}" class="tactile-btn px-3 py-1.5 rounded-full text-xs font-bold shrink-0 border ${
                  this.playersFilter === ch.id ? 'bg-[#22C55E] text-[#0B0D0E] border-[#22C55E]' : 'bg-[#1C2026] border-[#262B33] text-[#94A3B8]'
                }">${ch.label}</button>
              `).join('')}
            </div>

            <!-- Search Bar -->
            <input id="pl-sheet-search" type="text" value="${this.playersSearch}" placeholder="🔍 Cerca giocatore..." class="w-full bg-[#1C2026] border border-[#262B33] rounded-xl px-3 py-2 text-xs text-white focus:border-[#22C55E] focus:outline-none"/>

            <!-- Players List -->
            <div class="flex flex-col gap-2 overflow-y-auto min-h-[160px]">
              ${filtered.length === 0 ? `
                <div class="py-10 text-center text-xs text-[#94A3B8]">Nessun giocatore in questo filtro.</div>
              ` : filtered.map(p => `
                <div class="p-3 rounded-xl bg-[#1C2026] border border-[#262B33] flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <img src="https://mc-heads.net/avatar/${encodeURIComponent(p.username)}/36" class="w-8 h-8 rounded-lg"/>
                    <div class="flex flex-col">
                      <span class="text-xs font-bold text-white">${p.username}</span>
                      <span class="text-[10px] text-[#94A3B8]">${p.online ? '🟢 Online ora' : `Offline • ${p.lastSeen}`}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <button type="button" data-pl-toggle-op="${p.username}" class="px-2 py-1 rounded text-[10px] font-bold ${p.admin ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#15181C] text-[#94A3B8]'}">Admin</button>
                    <button type="button" data-pl-toggle-wl="${p.username}" class="px-2 py-1 rounded text-[10px] font-bold ${p.whitelisted ? 'bg-[#22C55E]/20 text-[#22C55E]' : 'bg-[#15181C] text-[#94A3B8]'}">Whitelist</button>
                    <button type="button" data-pl-toggle-ban="${p.username}" class="px-2 py-1 rounded text-[10px] font-bold ${p.banned ? 'bg-[#EF4444] text-white' : 'bg-[#15181C] text-[#EF4444]'}">Ban</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-backdrop') this.closeModal();
      });
      host.querySelectorAll('[data-pl-chip]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.playersFilter = btn.getAttribute('data-pl-chip');
          renderSheet();
        });
      });
      document.getElementById('pl-sheet-search')?.addEventListener('input', (e) => {
        this.playersSearch = e.target.value;
        renderSheet();
      });
      document.getElementById('btn-add-mock-player')?.addEventListener('click', () => {
        const name = prompt('Inserisci il nickname Minecraft del giocatore:', 'Steve_ITA');
        if (name && name.trim()) {
          srv.players.push({
            username: name.trim(),
            online: srv.status === 'online',
            whitelisted: true,
            admin: false,
            banned: false,
            lastSeen: 'Adesso'
          });
          store.notify('players-updated');
          renderSheet();
        }
      });
      host.querySelectorAll('[data-pl-toggle-op]').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = btn.getAttribute('data-pl-toggle-op');
          const p = srv.players.find(x => x.username === u);
          if (p) p.admin = !p.admin;
          store.saveState();
          renderSheet();
        });
      });
      host.querySelectorAll('[data-pl-toggle-wl]').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = btn.getAttribute('data-pl-toggle-wl');
          const p = srv.players.find(x => x.username === u);
          if (p) p.whitelisted = !p.whitelisted;
          store.saveState();
          renderSheet();
        });
      });
      host.querySelectorAll('[data-pl-toggle-ban]').forEach(btn => {
        btn.addEventListener('click', () => {
          const u = btn.getAttribute('data-pl-toggle-ban');
          const p = srv.players.find(x => x.username === u);
          if (p) {
            p.banned = !p.banned;
            if (p.banned) p.online = false;
          }
          store.saveState();
          renderSheet();
        });
      });
    };

    renderSheet();
  }

  // 6. Delete Server Bottom Sheet with 1.8s Long-Press Hold-to-Delete Progress Bar
  openDeleteHoldSheet(srv) {
    this.activeModal = 'delete-hold';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-[#15181C] border-t border-[#262B33] rounded-t-3xl p-5 pb-8 flex flex-col gap-3.5 text-center">
          <div class="w-10 h-1 bg-[#262B33] rounded-full mx-auto"></div>
          <h3 class="text-base font-extrabold text-white">Delete Server?</h3>
          <p class="text-xs text-[#94A3B8] leading-relaxed">
            Stai per eliminare definitivamente <strong>${srv.name}</strong> e tutti i file del mondo. Tieni premuto il pulsante rosso per confermare.
          </p>

          <!-- Hold-to-Delete Red Button with left-to-right progress fill -->
          <button type="button" id="btn-hold-delete" class="relative w-full h-12 rounded-xl bg-[#EF4444]/20 border border-[#EF4444] text-white font-extrabold text-xs tracking-wider overflow-hidden select-none touch-none flex items-center justify-center">
            <div id="hold-delete-fill" class="absolute inset-y-0 left-0 bg-[#EF4444] w-0 transition-none"></div>
            <span class="relative z-10 flex items-center gap-1.5">🗑️ ELIMINA SERVER (Tieni premuto)</span>
          </button>

          <button type="button" id="btn-cancel-delete" class="text-xs font-bold text-[#94A3B8] pt-1">Annulla</button>
        </div>
      </div>
    `;

    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });

    const holdBtn = document.getElementById('btn-hold-delete');
    const fillBar = document.getElementById('hold-delete-fill');
    if (holdBtn && fillBar) {
      let timer = null;
      let start = 0;
      const DURATION = 1800;

      const startHold = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        start = Date.now();
        triggerHaptic('HOLD_PULSE');
        timer = setInterval(() => {
          const elapsed = Date.now() - start;
          const pct = Math.min(100, (elapsed / DURATION) * 100);
          fillBar.style.width = `${pct}%`;
          if (elapsed % 300 < 35) triggerHaptic('HOLD_PULSE');
          if (pct >= 100) {
            clearInterval(timer);
            store.deleteServer(srv.id);
            this.closeModal();
            this.showToast(`Server "${srv.name}" eliminato.`);
          }
        }, 25);
      };

      const cancelHold = () => {
        if (timer) clearInterval(timer);
        fillBar.style.width = '0%';
      };

      holdBtn.addEventListener('mousedown', startHold);
      holdBtn.addEventListener('touchstart', startHold, { passive: false });
      holdBtn.addEventListener('mouseup', cancelHold);
      holdBtn.addEventListener('mouseleave', cancelHold);
      holdBtn.addEventListener('touchend', cancelHold);
      holdBtn.addEventListener('touchcancel', cancelHold);
    }
  }

  // 7. File Manager "+" Bottom Sheet ("Aggiungi a Hub Creativo")
  openAddToServerFilesSheet(srv) {
    this.activeModal = 'add-files';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-[#15181C] border-t border-[#262B33] rounded-t-3xl p-4 pb-8 flex flex-col gap-2.5">
          <div class="w-10 h-1 bg-[#262B33] rounded-full mx-auto mb-1"></div>
          <h3 class="text-sm font-extrabold text-white px-1">Aggiungi a ${srv.name}</h3>

          ${[
            { id: 'upload-file', icon: 'upload_file', label: 'Carica file' },
            { id: 'upload-folder', icon: 'drive_folder_upload', label: 'Carica una cartella' },
            { id: 'new-folder', icon: 'create_new_folder', label: 'Nuova cartella' },
            { id: 'new-text', icon: 'note_add', label: 'Nuovo file di testo' }
          ].map(act => `
            <button type="button" data-add-fs="${act.id}" class="tactile-btn w-full p-3.5 rounded-xl bg-[#1C2026] border border-[#262B33] hover:border-[#22C55E] flex items-center gap-3 text-left text-xs font-bold text-white">
              <span class="material-symbols-outlined text-[#22C55E] text-[20px]">${act.icon}</span>
              <span>${act.label}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });

    host.querySelectorAll('[data-add-fs]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-add-fs');
        this.closeModal();
        if (act === 'new-folder') {
          const name = prompt('Nome della nuova cartella:', 'datapacks');
          if (name && name.trim()) {
            srv.fsItems.push({ name: name.trim(), type: 'folder', sizeBytes: 4096, modified: 'Adesso', timestamp: Math.floor(Date.now() / 1000) });
            store.notify('fs-updated');
          }
        } else if (act === 'new-text') {
          const name = prompt('Nome del nuovo file di testo:', 'note-admin.txt');
          if (name && name.trim()) {
            srv.fsItems.push({ name: name.trim(), type: 'file', sizeBytes: 42, modified: 'Adesso', timestamp: Math.floor(Date.now() / 1000), content: '# Nuovo file creato su Anvil-MC v2.0.7\n' });
            this.editingFileName = name.trim();
            store.notify('fs-updated');
          }
        } else {
          const fname = `upload_${Math.floor(100 + Math.random() * 899)}.jar`;
          srv.fsItems.push({ name: fname, type: 'file', sizeBytes: 245760, modified: 'Adesso', timestamp: Math.floor(Date.now() / 1000), content: 'BINARY_JAR_CONTENT' });
          store.notify('fs-updated');
          this.showToast(`Caricato ${fname} in ${srv.name}`);
        }
      });
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AnvilAppV207();
});
