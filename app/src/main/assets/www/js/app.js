import { store, parseMinecraftFormattedText, triggerNativeHaptic } from './state.js';
import {
  getPlayerAvatarUrl,
  getPlayerIsoHeadUrl,
  fetchRealServerStatus,
  searchModrinthAddons,
  fetchPaperMcVersions,
  fetchPaperMcLatestBuild,
  formatCompactNumber
} from './api.js';

class AnvilApplication {
  constructor() {
    this.activeTab = 'dashboard';
    this.consoleFilter = 'all';
    this.autoScroll = true;
    this.doctorExpanded = false;
    this.playersSubTab = 'online'; // 'online' | 'whitelist' | 'ops' | 'banned'
    this.playersSearch = '';
    this.selectedPlayerUsername = 'AlexCraft';
    this.configSubTab = 'visual'; // 'visual' | 'files'
    this.activeFilePath = '/server.properties';
    this.forgeCategory = 'all';
    this.forgeQuery = '';
    this.forgeItems = [];
    this.forgeLoading = false;
    this.engineSelectorOpen = false;
    this.paperVersions = ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.19.4'];
    this.activeModal = null; // 'server-switcher' | 'add-server' | 'player-sheet' | 'public-scanner'
    this.wizardMode = 'connect'; // 'connect' | 'builder'

    this.init();
  }

  async init() {
    window.AnvilApp = this;
    this.bindGlobalShellEvents();
    this.renderHeader();
    this.renderBottomNav();
    this.renderMainView();

    store.subscribe((state, event) => {
      this.renderHeader();
      this.renderBottomNav();
      if (event === 'telemetry-tick') {
        this.updateLiveTelemetryDOM();
      } else {
        this.renderMainView(false);
      }
    });

    // Preload real Modrinth catalog & PaperMC versions
    this.loadModrinthCatalog();
    fetchPaperMcVersions().then(v => {
      if (v && v.length) this.paperVersions = v;
    });
  }

  bindGlobalShellEvents() {
    const fsBtn = document.getElementById('btn-toggle-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        document.body.classList.toggle('is-fullscreen');
        triggerNativeHaptic('TICK');
      });
    }
  }

  handleBackNavigation() {
    if (this.activeModal) {
      this.closeModal();
      return true;
    }
    if (this.activeTab !== 'dashboard') {
      this.switchTab('dashboard');
      return true;
    }
    return false;
  }

  showToast(message, badge = 'ANVIL OS', isError = false) {
    const toast = document.getElementById('global-toast');
    const toastMsg = document.getElementById('global-toast-msg');
    const toastBadge = document.getElementById('global-toast-badge');
    const toastIcon = document.getElementById('global-toast-icon');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    if (toastBadge) toastBadge.textContent = badge;
    if (toastIcon) {
      toastIcon.textContent = isError ? 'error' : 'check_circle';
      toastIcon.className = `material-symbols-outlined text-[19px] ${isError ? 'text-rose-400' : 'text-mint-glow'}`;
    }

    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2600);
  }

  switchTab(tabName) {
    if (this.activeTab === tabName) return;
    this.activeTab = tabName;
    triggerNativeHaptic('TICK');
    this.renderBottomNav();
    this.renderMainView(true);
  }

  renderHeader() {
    const srv = store.getActiveServer();
    const headerEl = document.getElementById('app-header-content');
    if (!headerEl || !srv) return;

    const isOnline = srv.status === 'online';
    const isStarting = srv.status === 'starting';
    const statusDotClass = isOnline
      ? 'bg-mint-glow shadow-[0_0_8px_#00ff9d] animate-pulse'
      : isStarting
      ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-ping'
      : 'bg-rose-500 shadow-[0_0_8px_#ef4444]';

    const statusLabel = isOnline
      ? `ONLINE • ${srv.version}`
      : isStarting
      ? `STARTING • ${srv.version}`
      : `OFFLINE • ${srv.version}`;

    const statusTextColor = isOnline
      ? 'text-mint-glow'
      : isStarting
      ? 'text-amber-400'
      : 'text-rose-400';

    headerEl.innerHTML = `
      <button type="button" id="hdr-server-selector" class="flex items-center gap-2.5 text-left group tactile-btn min-w-0">
        <div class="w-8 h-8 rounded-lg bg-mint-deep border border-mint-glow/30 flex items-center justify-center shadow-[0_0_12px_rgba(0,255,157,0.2)] group-hover:border-mint-glow transition-colors shrink-0">
          <svg class="w-4 h-4 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-[14px] tracking-tight text-deck-white truncate">${srv.name}</span>
            <span class="w-1.5 h-1.5 rounded-full ${statusDotClass} shrink-0"></span>
            <span class="material-symbols-outlined text-[15px] text-deck-dimText group-hover:text-mint-glow transition-colors">expand_more</span>
          </div>
          <span class="font-mono text-[10px] ${statusTextColor} truncate">${statusLabel} • <span id="hdr-tps-live">${srv.tps.toFixed(1)} TPS</span></span>
        </div>
      </button>

      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" id="hdr-ping-btn" title="Test Native TCP Ping" class="tactile-btn flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-deck-card border border-deck-border hover:border-mint-glow/40">
          <svg class="w-3.5 h-3.5 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          <span id="hdr-ping-live" class="font-mono text-[11px] font-semibold text-deck-lightText">${isOnline ? srv.pingMs + 'ms' : '--'}</span>
        </button>
        <button type="button" id="hdr-switch-host" title="Switch or Create Server" class="tactile-btn w-8 h-8 rounded-md bg-deck-card border border-deck-border flex items-center justify-center text-deck-lightText hover:text-deck-white hover:border-mint-glow/40">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
      </div>
    `;

    document.getElementById('hdr-server-selector')?.addEventListener('click', () => this.openServerSwitcherModal());
    document.getElementById('hdr-switch-host')?.addEventListener('click', () => this.openServerSwitcherModal());
    document.getElementById('hdr-ping-btn')?.addEventListener('click', () => this.triggerLivePingCheck());
  }

  async triggerLivePingCheck() {
    const srv = store.getActiveServer();
    if (!srv) return;
    triggerNativeHaptic('TICK');

    if (window.AnvilNative && typeof window.AnvilNative.pingServerNative === 'function' && srv.address !== 'play.anvilcraft.gg') {
      try {
        const res = JSON.parse(window.AnvilNative.pingServerNative(srv.address, srv.port));
        if (res.ok) {
          srv.pingMs = res.latencyMs;
          this.showToast(`Ping TCP Nativo verso ${srv.address}:${srv.port} → ${res.latencyMs}ms`, 'SOCKET TCP');
          this.renderHeader();
          return;
        }
      } catch (_) {}
    }

    srv.pingMs = Math.max(9, Math.round(14 + Math.random() * 18));
    this.renderHeader();
    this.showToast(`Latenza misurata verso ${srv.address}:${srv.port} → ${srv.pingMs}ms`, 'PING OK');
  }

  renderBottomNav() {
    const nav = document.getElementById('app-bottom-nav');
    if (!nav) return;
    const srv = store.getActiveServer();
    const onlineCount = srv ? srv.players.filter(p => p.online && !p.banned).length : 0;

    const tabs = [
      {
        id: 'dashboard',
        label: 'DASH',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect height="9" rx="1" width="7" x="3" y="3"></rect>
                <rect height="5" rx="1" width="7" x="14" y="3"></rect>
                <rect height="9" rx="1" width="7" x="14" y="12"></rect>
                <rect height="5" rx="1" width="7" x="3" y="16"></rect>
              </svg>`
      },
      {
        id: 'console',
        label: 'CONSOLE',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <polyline points="4 17 10 11 4 5"></polyline>
                <line x1="12" x2="20" y1="19" y2="19"></line>
              </svg>`,
        dot: srv?.activeCrash && !srv.activeCrash.patched
      },
      {
        id: 'players',
        label: 'PLAYERS',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`,
        badge: onlineCount
      },
      {
        id: 'config',
        label: 'CONFIG',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`
      },
      {
        id: 'forge',
        label: 'FORGE',
        svg: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>`
      }
    ];

    nav.innerHTML = tabs.map(t => {
      const active = this.activeTab === t.id;
      return `
        <button type="button" data-nav-tab="${t.id}" class="tactile-btn flex flex-col items-center justify-center min-w-[56px] py-1 ${active ? 'text-mint-glow' : 'text-deck-dimText hover:text-deck-white'} transition-colors relative">
          ${active ? '<div class="absolute -top-1.5 w-8 h-0.5 bg-mint-glow shadow-[0_0_8px_#00ff9d] rounded-full"></div>' : ''}
          <div class="relative">
            ${t.svg}
            ${t.badge !== undefined ? `<span class="absolute -top-1 -right-2.5 bg-mint-deep text-mint-glow border border-mint-glow/30 font-mono text-[8px] font-bold px-1 rounded-full leading-none">${t.badge}</span>` : ''}
            ${t.dot ? `<span class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-rose-500 animate-ping"></span><span class="absolute -top-0.5 -right-1 w-2 h-2 rounded-full bg-rose-500"></span>` : ''}
          </div>
          <span class="text-[9px] font-mono uppercase tracking-wider ${active ? 'font-bold' : 'font-medium'} mt-1">${t.label}</span>
        </button>
      `;
    }).join('');

    nav.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-nav-tab');
        if (tab) this.switchTab(tab);
      });
    });
  }

  renderMainView(animate = true) {
    const main = document.getElementById('app-main-viewport');
    if (!main) return;
    if (animate) {
      main.classList.remove('view-animate');
      void main.offsetWidth;
      main.classList.add('view-animate');
    }

    if (this.activeTab === 'dashboard') {
      this.renderDashboardView(main);
    } else if (this.activeTab === 'console') {
      this.renderConsoleView(main);
    } else if (this.activeTab === 'players') {
      this.renderPlayersView(main);
    } else if (this.activeTab === 'config') {
      this.renderConfigView(main);
    } else if (this.activeTab === 'forge') {
      this.renderForgeView(main);
    }
  }

  updateLiveTelemetryDOM() {
    const srv = store.getActiveServer();
    if (!srv) return;

    const hdrTps = document.getElementById('hdr-tps-live');
    if (hdrTps) hdrTps.textContent = `${srv.tps.toFixed(1)} TPS`;
    const hdrPing = document.getElementById('hdr-ping-live');
    if (hdrPing) hdrPing.textContent = srv.status === 'online' ? `${srv.pingMs}ms` : '--';

    if (this.activeTab === 'dashboard') {
      const tpsVal = document.getElementById('dash-tps-val');
      const tpsCircle = document.getElementById('dash-tps-circle');
      const msptVal = document.getElementById('dash-mspt-val');
      const cpuVal = document.getElementById('dash-cpu-val');
      const c0Bar = document.getElementById('dash-c0-bar');
      const c1Bar = document.getElementById('dash-c1-bar');
      const c0Txt = document.getElementById('dash-c0-txt');
      const c1Txt = document.getElementById('dash-c1-txt');
      const sparkPath = document.getElementById('dash-spark-line');
      const sparkFill = document.getElementById('dash-spark-fill');

      if (tpsVal) tpsVal.textContent = srv.tps.toFixed(1);
      if (msptVal) msptVal.textContent = `${srv.mspt}ms`;
      if (tpsCircle) {
        const pct = Math.min(1, Math.max(0, srv.tps / 20));
        tpsCircle.style.strokeDashoffset = String(Math.round(201 * (1 - pct)));
      }
      if (cpuVal) cpuVal.textContent = srv.cpuLoad.toFixed(1);
      if (c0Bar && srv.cpuCores) c0Bar.style.width = `${srv.cpuCores[0]}%`;
      if (c1Bar && srv.cpuCores) c1Bar.style.width = `${srv.cpuCores[1]}%`;
      if (c0Txt && srv.cpuCores) c0Txt.textContent = `${srv.cpuCores[0]}%`;
      if (c1Txt && srv.cpuCores) c1Txt.textContent = `${srv.cpuCores[1]}%`;
      if (sparkPath && sparkFill) {
        const { lineD, fillD } = this.computeSparklinePaths(srv.tpsHistory);
        sparkPath.setAttribute('d', lineD);
        sparkFill.setAttribute('d', fillD);
      }
    }
  }

  computeSparklinePaths(history = []) {
    const pts = history.length ? history : [20, 20, 20, 20];
    const width = 300;
    const height = 60;
    const step = width / Math.max(1, pts.length - 1);
    const coords = pts.map((v, i) => {
      const x = Math.round(i * step);
      // Map TPS 14..20 to y 52..12
      const norm = Math.min(1, Math.max(0, (v - 14) / 6));
      const y = Math.round(52 - norm * 38);
      return `${x},${y}`;
    });
    const lineD = 'M' + coords.join(' L');
    const fillD = `${lineD} L${width},${height} L0,${height} Z`;
    return { lineD, fillD };
  }

  /* =========================================================================
   * MODULE 1: ANVIL HUB (DASHBOARD)
   * ========================================================================= */
  renderDashboardView(container) {
    const srv = store.getActiveServer();
    if (!srv) return;

    const isOnline = srv.status === 'online';
    const isStarting = srv.status === 'starting';
    const onlinePlayers = srv.players.filter(p => p.online && !p.banned);
    const ramPct = Math.min(100, Math.round((srv.ramUsedGb / srv.ramMaxGb) * 100));
    const tpsPct = Math.min(100, Math.round((srv.tps / 20.0) * 100));
    const dashOffset = Math.round(201 * (1 - tpsPct / 100));
    const { lineD, fillD } = this.computeSparklinePaths(srv.tpsHistory);

    const wPct = Math.round((srv.diskBreakdown.world / srv.diskMaxGb) * 100);
    const pPct = Math.round((srv.diskBreakdown.plugins / srv.diskMaxGb) * 100);
    const bPct = Math.round((srv.diskBreakdown.backups / srv.diskMaxGb) * 100);

    const recentLogs = srv.logs.slice(-3).reverse();

    container.innerHTML = `
      <div class="flex flex-col w-full gap-3 pb-6">
        <!-- Server Quick Switcher Pills Strip -->
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pt-0.5 stagger-1">
          ${store.state.servers.map(item => {
            const active = item.id === srv.id;
            const dot = item.status === 'online' ? 'bg-mint-glow' : item.status === 'starting' ? 'bg-amber-400' : 'bg-rose-500';
            return `
              <button type="button" data-quick-srv="${item.id}" class="tactile-btn flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono shrink-0 ${
                active
                  ? 'bg-mint-deep/70 border-mint-glow/50 text-deck-white shadow-[0_0_12px_rgba(0,255,157,0.15)]'
                  : 'bg-deck-card border-deck-border text-deck-lightText hover:text-white'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${dot}"></span>
                <span class="font-semibold">${item.name}</span>
                <span class="text-[10px] opacity-70">${item.software}</span>
              </button>
            `;
          }).join('')}
          <button type="button" id="btn-ping-scanner" class="tactile-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-deck-card border border-amber-500/30 text-amber-300 text-xs font-mono shrink-0 hover:border-amber-400">
            <span class="material-symbols-outlined text-[14px]">travel_explore</span>
            <span>Ping Server Reale</span>
          </button>
        </div>

        <!-- Compact Server MOTD Ribbon -->
        <section class="stagger-1 flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-deck-card/85 border border-deck-border text-[11px] font-mono">
          <div class="flex items-center gap-2 truncate">
            <span class="text-deck-dimText uppercase tracking-wider text-[9px] font-bold px-1.5 py-0.5 rounded bg-deck-darker border border-deck-border">MOTD</span>
            <span class="truncate">${parseMinecraftFormattedText(srv.properties['motd'] || srv.motdLine1)}</span>
          </div>
          <span class="text-[10px] text-mint-glow shrink-0 pl-2 font-semibold">${srv.software}</span>
        </section>

        <!-- Minimalist Telemetry 2x2 Grid -->
        <section class="stagger-2 grid grid-cols-2 gap-2.5">
          <!-- Gauge 1: TPS Meter (Circular Glowing Arc) -->
          <div class="tactile-card flex flex-col justify-between p-3.5 rounded-xl bg-deck-card border border-deck-border relative overflow-hidden">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono uppercase tracking-wider text-deck-dimText font-semibold">TICK RATE</span>
              <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                isOnline ? 'bg-mint-deep text-mint-glow border border-mint-glow/20' : 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
              }">${isOnline ? 'NOMINAL' : srv.status.toUpperCase()}</span>
            </div>
            <div class="my-2 flex items-center justify-center relative">
              <svg class="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" fill="none" r="32" stroke="#1f242d" stroke-width="5.5"></circle>
                <circle id="dash-tps-circle" class="transition-all duration-500 drop-shadow-[0_0_8px_rgba(0,255,157,0.45)]" cx="40" cy="40" fill="none" r="32" stroke="${isOnline ? '#00ff9d' : '#ef4444'}" stroke-dasharray="201" stroke-dashoffset="${dashOffset}" stroke-linecap="round" stroke-width="5.5"></circle>
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span id="dash-tps-val" class="font-mono text-xl font-bold tracking-tight text-deck-white leading-none">${srv.tps.toFixed(1)}</span>
                <span class="text-[9px] font-mono uppercase tracking-widest text-mint-glow mt-0.5">TPS</span>
              </div>
            </div>
            <div class="flex items-center justify-between font-mono text-[10px] text-deck-dimText border-t border-deck-border/60 pt-2">
              <span>MSPT: <strong id="dash-mspt-val" class="text-deck-white">${srv.mspt}ms</strong></span>
              <span class="text-mint-glow">${tpsPct}%</span>
            </div>
          </div>

          <!-- Gauge 2: Memory (RAM Chip & Minimal Bar) -->
          <div class="tactile-card flex flex-col justify-between p-3.5 rounded-xl bg-deck-card border border-deck-border">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono uppercase tracking-wider text-deck-dimText font-semibold">MEMORY</span>
              <svg class="w-4 h-4 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect height="16" rx="2" width="16" x="4" y="4"></rect>
                <rect height="6" width="6" x="9" y="9"></rect>
                <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"></path>
              </svg>
            </div>
            <div class="my-2">
              <div class="flex items-baseline gap-1 font-mono">
                <span class="text-2xl font-bold text-deck-white leading-none">${srv.ramUsedGb.toFixed(1)}</span>
                <span class="text-xs text-deck-dimText font-medium">/ ${srv.ramMaxGb.toFixed(1)} GB</span>
              </div>
              <div class="text-[10px] font-mono text-mint-glow mt-1 font-medium">${ramPct}% Allocated</div>
            </div>
            <div class="pt-2 border-t border-deck-border/60">
              <div class="w-full h-1.5 rounded-full bg-deck-darker overflow-hidden">
                <div class="h-full rounded-full bg-gradient-to-r from-mint to-mint-glow shadow-[0_0_8px_rgba(0,255,157,0.5)] transition-all duration-500" style="width: ${ramPct}%;"></div>
              </div>
              <div class="flex justify-between font-mono text-[9px] text-deck-dimText mt-1.5">
                <span>G1GC Heap</span>
                <span>Max ${srv.ramMaxGb}G</span>
              </div>
            </div>
          </div>

          <!-- Gauge 3: CPU Cadence -->
          <div class="tactile-card flex flex-col justify-between p-3.5 rounded-xl bg-deck-card border border-deck-border">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono uppercase tracking-wider text-deck-dimText font-semibold">CPU LOAD</span>
              <svg class="w-4 h-4 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </div>
            <div class="my-2">
              <div class="flex items-baseline gap-1 font-mono">
                <span id="dash-cpu-val" class="text-2xl font-bold text-deck-white leading-none">${srv.cpuLoad.toFixed(1)}</span>
                <span class="text-xs text-mint-glow font-bold">%</span>
              </div>
              <span class="text-[10px] font-mono text-deck-dimText mt-1 block">ARM64 Dedicated</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 pt-2 border-t border-deck-border/60">
              <div>
                <div class="flex justify-between font-mono text-[8px] text-deck-dimText mb-0.5">
                  <span>C0</span><span id="dash-c0-txt">${srv.cpuCores[0]}%</span>
                </div>
                <div class="w-full h-1 bg-deck-darker rounded-full overflow-hidden">
                  <div id="dash-c0-bar" class="h-full bg-mint-glow rounded-full transition-all duration-500" style="width: ${srv.cpuCores[0]}%;"></div>
                </div>
              </div>
              <div>
                <div class="flex justify-between font-mono text-[8px] text-deck-dimText mb-0.5">
                  <span>C1</span><span id="dash-c1-txt">${srv.cpuCores[1]}%</span>
                </div>
                <div class="w-full h-1 bg-deck-darker rounded-full overflow-hidden">
                  <div id="dash-c1-bar" class="h-full bg-mint rounded-full transition-all duration-500" style="width: ${srv.cpuCores[1]}%;"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Gauge 4: Players & Network -->
          <div id="dash-card-players" class="tactile-card cursor-pointer flex flex-col justify-between p-3.5 rounded-xl bg-deck-card border border-deck-border">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-mono uppercase tracking-wider text-deck-dimText font-semibold">PLAYERS</span>
              <div class="flex items-center gap-1 text-mint-glow font-mono text-[10px] font-bold">
                <span class="w-1.5 h-1.5 rounded-full bg-mint-glow"></span>
                <span>${onlinePlayers.length}</span>
              </div>
            </div>
            <div class="my-2">
              <div class="flex items-baseline gap-1 font-mono">
                <span class="text-2xl font-bold text-deck-white leading-none">${onlinePlayers.length}</span>
                <span class="text-xs text-deck-dimText font-medium">/ ${srv.properties['max-players']} MAX</span>
              </div>
              <span class="text-[10px] font-mono text-deck-dimText mt-1 block truncate">${srv.address}</span>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-deck-border/60">
              <div class="flex -space-x-1.5 overflow-hidden">
                ${onlinePlayers.slice(0, 3).map(p => `
                  <img alt="${p.username}" src="${getPlayerAvatarUrl(p.username, 32)}" class="inline-block h-5 w-5 rounded-full ring-1 ring-deck-border object-cover bg-deck-darker"/>
                `).join('')}
                ${onlinePlayers.length > 3 ? `<div class="flex items-center justify-center h-5 w-5 rounded-full bg-deck-subtle text-[8px] font-mono font-bold text-mint-glow ring-1 ring-deck-border">+${onlinePlayers.length - 3}</div>` : ''}
              </div>
              <span class="text-[9px] font-mono text-mint-glow">Manage →</span>
            </div>
          </div>
        </section>

        <!-- Sleek Tactile Power Controls Bar -->
        <section class="stagger-3 flex flex-col p-3 rounded-xl bg-deck-card border border-deck-border">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-mono uppercase tracking-wider text-deck-dimText font-semibold">POWER ACTIONS</span>
            <span class="font-mono text-[9px] text-mint-glow font-medium">${srv.connectionType.toUpperCase()} • PORT ${srv.port}</span>
          </div>
          <div class="grid grid-cols-4 gap-2">
            <!-- 1. Start -->
            <button type="button" id="btn-power-start" class="tactile-btn flex flex-col items-center justify-center py-2.5 rounded-lg ${
              isOnline
                ? 'bg-mint-deep/60 border border-mint-glow/40 text-mint-glow shadow-[0_0_12px_rgba(0,255,157,0.18)]'
                : 'bg-deck-darker border border-deck-border text-mint-glow hover:border-mint-glow/50'
            }">
              <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"></path>
              </svg>
              <span class="text-[10px] font-mono font-bold mt-1 tracking-tight">${isOnline ? 'RUNNING' : isStarting ? 'BOOTING' : 'START'}</span>
            </button>

            <!-- 2. Restart -->
            <button type="button" id="btn-power-restart" class="tactile-btn flex flex-col items-center justify-center py-2.5 rounded-lg bg-deck-darker border border-deck-border text-amber-400 hover:border-amber-400/50 group">
              <svg class="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span class="text-[10px] font-mono font-semibold mt-1">RESTART</span>
            </button>

            <!-- 3. Stop -->
            <button type="button" id="btn-power-stop" class="tactile-btn flex flex-col items-center justify-center py-2.5 rounded-lg bg-deck-darker border border-deck-border text-deck-lightText hover:text-rose-400 hover:border-rose-500/40">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect height="12" rx="1.5" width="12" x="6" y="6"></rect>
              </svg>
              <span class="text-[10px] font-mono font-semibold mt-1">STOP</span>
            </button>

            <!-- 4. Kill (Hold 1.5s) -->
            <button type="button" id="btn-power-kill" title="Hold 1.5s to Kill Process" class="relative flex flex-col items-center justify-center py-2.5 rounded-lg bg-red-950/25 border border-red-900/50 text-red-400 hover:bg-red-950/40 select-none touch-none overflow-hidden">
              <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 50 50">
                <circle id="kill-progress" class="text-red-500 transition-all duration-75" cx="25" cy="25" fill="transparent" r="21" stroke="currentColor" stroke-width="2.5" style="stroke-dasharray: 132; stroke-dashoffset: 132; transform: rotate(-90deg); transform-origin: 50% 50%;"></circle>
              </svg>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span class="text-[10px] font-mono font-bold mt-1 tracking-tight">KILL (1.5s)</span>
            </button>
          </div>
        </section>

        <!-- TPS Sparkline Graph -->
        <section class="stagger-4 flex flex-col p-3.5 rounded-xl bg-deck-card border border-deck-border">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-deck-dimText tracking-wider">
              <svg class="w-3.5 h-3.5 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span>TPS STABILITY (30M)</span>
            </div>
            <span class="font-mono text-[10px] text-mint-glow font-bold">AVG 19.96</span>
          </div>
          <div class="w-full h-14 relative my-1">
            <svg class="w-full h-full" preserveAspectRatio="none" viewBox="0 0 300 60">
              <defs>
                <linearGradient id="mintGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#00ff9d" stop-opacity="0.28"></stop>
                  <stop offset="100%" stop-color="#00ff9d" stop-opacity="0.0"></stop>
                </linearGradient>
              </defs>
              <path id="dash-spark-fill" d="${fillD}" fill="url(#mintGrad)"></path>
              <path id="dash-spark-line" d="${lineD}" fill="none" stroke="#00ff9d" stroke-linecap="round" stroke-width="2"></path>
            </svg>
          </div>
          <div class="flex items-center justify-between font-mono text-[9px] text-deck-dimText pt-1 border-t border-deck-border/60">
            <span>MIN: <span class="text-deck-white font-semibold">${Math.min(...srv.tpsHistory).toFixed(1)}</span></span>
            <span>CURR: <span class="text-mint-glow font-semibold">${srv.tps.toFixed(1)}</span></span>
            <span>STABLE 99.8%</span>
          </div>
        </section>

        <!-- Minimal Storage Card -->
        <section class="stagger-4 flex flex-col p-3 rounded-xl bg-deck-card border border-deck-border">
          <div class="flex items-center justify-between mb-1.5 font-mono">
            <div class="flex items-center gap-1.5 text-[10px] uppercase font-bold text-deck-dimText">
              <svg class="w-3.5 h-3.5 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9c2 0 3.5 1 3.5 3M4 7h16m-5 4h.01M9 11h.01M9 15h.01M15 15h.01" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span>NVME STORAGE</span>
            </div>
            <span class="text-[10px] text-deck-white font-bold">${srv.diskUsedGb} / ${srv.diskMaxGb} GB</span>
          </div>
          <div class="w-full h-2 rounded-full bg-deck-darker overflow-hidden flex my-1">
            <div class="h-full bg-mint-glow" style="width: ${wPct}%;" title="World"></div>
            <div class="h-full bg-mint" style="width: ${pPct}%;" title="Plugins"></div>
            <div class="h-full bg-mint-dark" style="width: ${bPct}%;" title="Backups"></div>
          </div>
          <div class="flex items-center justify-between font-mono text-[9px] text-deck-dimText mt-1">
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-mint-glow"></span>World ${srv.diskBreakdown.world}G</span>
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-mint"></span>Addons ${srv.diskBreakdown.plugins}G</span>
            <span class="flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-mint-dark"></span>Backups ${srv.diskBreakdown.backups}G</span>
          </div>
        </section>

        <!-- Sleek Console Log Feed Preview -->
        <section id="dash-console-preview" class="stagger-5 cursor-pointer tactile-card flex flex-col p-3 rounded-xl bg-deck-black border border-deck-border">
          <div class="flex items-center justify-between mb-2 pb-1.5 border-b border-deck-border/60">
            <div class="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold text-deck-dimText tracking-wider">
              <svg class="w-3.5 h-3.5 text-mint-glow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span>LIVE CONSOLE STREAM</span>
            </div>
            <div class="flex items-center gap-1 font-mono text-[9px] text-mint-glow font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-mint-glow animate-ping"></span>
              <span>OPEN TTY →</span>
            </div>
          </div>
          <div class="flex flex-col gap-1.5 font-mono text-[10.5px]">
            ${recentLogs.map(l => `
              <div class="flex items-center gap-2 truncate">
                <span class="text-deck-dimText text-[9px] shrink-0">${l.time}</span>
                <span class="${l.type === 'error' ? 'text-rose-400' : l.type === 'warn' ? 'text-amber-400' : 'text-mint-glow'} text-[10px] font-semibold shrink-0">[${l.badge}]</span>
                <span class="text-deck-lightText truncate">${l.text}</span>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Minimal Action Floating Trigger -->
        <div class="sticky bottom-2 z-30 flex justify-center w-full mt-1 pointer-events-none">
          <button type="button" id="btn-add-server" class="tactile-btn pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-mint-glow text-deck-black font-sans font-bold text-xs tracking-tight shadow-[0_0_24px_rgba(0,255,157,0.4)] hover:bg-white">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span>+ Aggiungi / Crea Server (RCON / Builder)</span>
          </button>
        </div>
      </div>
    `;

    // Bind quick server pills
    container.querySelectorAll('[data-quick-srv]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.setActiveServer(btn.getAttribute('data-quick-srv'));
      });
    });

    document.getElementById('btn-ping-scanner')?.addEventListener('click', () => this.openPublicScannerModal());
    document.getElementById('dash-card-players')?.addEventListener('click', () => this.switchTab('players'));
    document.getElementById('dash-console-preview')?.addEventListener('click', () => this.switchTab('console'));
    document.getElementById('btn-add-server')?.addEventListener('click', () => this.openAddServerWizardModal());

    // Bind Power buttons
    document.getElementById('btn-power-start')?.addEventListener('click', () => {
      store.setPowerState('start');
      this.showToast(`Avvio istanza ${srv.name} in corso...`, 'POWER ON');
    });
    document.getElementById('btn-power-restart')?.addEventListener('click', () => {
      store.setPowerState('restart');
      this.showToast(`Riavvio rapido di ${srv.name}...`, 'RESTART');
    });
    document.getElementById('btn-power-stop')?.addEventListener('click', () => {
      store.setPowerState('stop');
      this.showToast(`Arresto sicuro di ${srv.name} completato.`, 'STOPPED');
    });

    // Bind Hold-to-Kill (1.5s)
    const killBtn = document.getElementById('btn-power-kill');
    const killProgress = document.getElementById('kill-progress');
    if (killBtn && killProgress) {
      let holdTimer = null;
      let startTime = 0;
      const DURATION = 1500;
      const TOTAL_OFFSET = 132;

      const startHold = (e) => {
        if (e.type === 'touchstart') e.preventDefault();
        triggerNativeHaptic('TICK');
        startTime = Date.now();
        holdTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / DURATION, 1);
          killProgress.style.strokeDashoffset = String(TOTAL_OFFSET - progress * TOTAL_OFFSET);
          if (progress >= 1) {
            clearInterval(holdTimer);
            store.setPowerState('kill');
            this.showToast(`Processo JVM terminato forzatamente (SIGKILL)!`, 'KILLED', true);
          }
        }, 25);
      };

      const cancelHold = () => {
        if (holdTimer) clearInterval(holdTimer);
        killProgress.style.strokeDashoffset = String(TOTAL_OFFSET);
      };

      killBtn.addEventListener('mousedown', startHold);
      killBtn.addEventListener('touchstart', startHold, { passive: false });
      killBtn.addEventListener('mouseup', cancelHold);
      killBtn.addEventListener('mouseleave', cancelHold);
      killBtn.addEventListener('touchend', cancelHold);
      killBtn.addEventListener('touchcancel', cancelHold);
    }
  }

  /* =========================================================================
   * MODULE 2: LIVE CONSOLE & AI CRASH DOCTOR
   * ========================================================================= */
  renderConsoleView(container) {
    const srv = store.getActiveServer();
    if (!srv) return;

    const allLogs = srv.logs || [];
    const errorCount = allLogs.filter(l => l.type === 'error' || l.type === 'warn').length;
    const filteredLogs = allLogs.filter(l => {
      if (this.consoleFilter === 'all') return true;
      if (this.consoleFilter === 'error') return l.type === 'error' || l.type === 'warn';
      if (this.consoleFilter === 'chat') return l.type === 'chat';
      if (this.consoleFilter === 'command') return l.type === 'command';
      return true;
    });

    const crash = srv.activeCrash;

    container.innerHTML = `
      <div class="flex flex-col w-full gap-2.5 pb-6">
        <!-- Stream TTY Bar with Quick Utility Actions -->
        <div class="flex items-center justify-between px-1 py-0.5 stagger-1">
          <div class="flex items-center gap-1.5 font-mono text-[11px] text-deck-lightText">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-mint-glow shadow-[0_0_6px_#00ff9d]"></span>
            <span class="text-white font-medium">pts/${srv.id.replace('srv-', '')}</span>
            <span class="text-deck-dimText">•</span>
            <span class="text-[10px] text-mint-glow">${srv.connectionType === 'rcon' ? 'RCON TCP' : 'LIVE TTY'}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" id="btn-autoscroll" class="tactile-btn flex items-center gap-1 bg-deck-card border border-deck-border px-2 py-1 rounded text-[11px] font-mono ${this.autoScroll ? 'text-mint-glow border-mint-glow/30' : 'text-deck-dimText'}">
              <span class="material-symbols-outlined text-[14px]">${this.autoScroll ? 'lock' : 'lock_open'}</span>
              <span class="text-[10px] uppercase font-semibold tracking-wider">${this.autoScroll ? 'Scroll' : 'Paused'}</span>
            </button>
            <button type="button" id="btn-sim-crash" title="Simulate Java Exception" class="tactile-btn px-2 py-1 rounded bg-rose-950/40 border border-rose-500/30 text-rose-400 font-mono text-[10px] font-semibold">
              + Crash Test
            </button>
            <button type="button" id="btn-clear-logs" title="Clear Console" class="tactile-btn p-1 rounded bg-deck-card border border-deck-border text-deck-lightText hover:text-white">
              <span class="material-symbols-outlined text-[15px]">delete_sweep</span>
            </button>
            <button type="button" id="btn-export-logs" title="Copy & Export Logs" class="tactile-btn p-1 rounded bg-deck-card border border-deck-border text-deck-lightText hover:text-mint-glow">
              <span class="material-symbols-outlined text-[15px]">download</span>
            </button>
          </div>
        </div>

        <!-- Quick Compact Filter Chips -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 stagger-1">
          ${[
            { id: 'all', label: 'Tutti', count: allLogs.length },
            { id: 'error', label: 'Solo Errori', count: errorCount, isErr: true },
            { id: 'chat', label: 'Chat Giocatori', icon: 'chat' },
            { id: 'command', label: 'Comandi', icon: 'terminal' }
          ].map(f => {
            const active = this.consoleFilter === f.id;
            return `
              <button type="button" data-log-filter="${f.id}" class="tactile-btn flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] shrink-0 ${
                active
                  ? 'bg-mint-glow text-deck-black font-bold shadow-[0_0_12px_rgba(0,255,157,0.3)]'
                  : f.isErr
                  ? 'bg-deck-card border border-rose-500/40 text-rose-400'
                  : 'bg-deck-card border border-deck-border text-deck-lightText hover:text-white'
              }">
                ${f.isErr && !active ? '<span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>' : ''}
                ${f.icon ? `<span class="material-symbols-outlined text-[13px]">${f.icon}</span>` : ''}
                <span>${f.label}</span>
                ${f.count !== undefined ? `<span class="text-[9px] px-1 rounded ${active ? 'bg-black/20' : 'bg-white/10'} font-bold">${f.count}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>

        <!-- AI Crash Doctor Banner -->
        ${crash ? `
          <div class="stagger-2 rounded-xl bg-deck-card border ${crash.patched ? 'border-mint-glow/40' : 'border-rose-500/50 crash-alert-pulse'} overflow-hidden">
            <button type="button" id="btn-toggle-doctor" class="w-full px-3 py-2.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-6 h-6 rounded ${crash.patched ? 'bg-mint-deep text-mint-glow' : 'bg-rose-500/20 text-rose-400'} flex items-center justify-center shrink-0">
                  <span class="material-symbols-outlined text-[15px]">${crash.patched ? 'verified' : 'medical_services'}</span>
                </div>
                <div class="flex items-center gap-1.5 truncate text-[11px] font-mono">
                  <span class="${crash.patched ? 'text-mint-glow' : 'text-rose-400'} font-bold uppercase">Analizza Crash con Anvil AI:</span>
                  <span class="text-white truncate font-medium">${crash.title}</span>
                </div>
              </div>
              <div class="flex items-center gap-1 text-mint-glow text-[11px] font-mono shrink-0">
                <span>${crash.patched ? 'Risolto' : 'Diagnosi'}</span>
                <span class="material-symbols-outlined text-[16px] transition-transform duration-200" style="transform: rotate(${this.doctorExpanded ? '180deg' : '0deg'})">expand_more</span>
              </div>
            </button>
            <div class="${this.doctorExpanded ? 'flex' : 'hidden'} flex-col gap-2.5 p-3 pt-2 bg-black/60 border-t border-deck-border text-[11px] font-mono">
              <div class="p-2 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 text-[10px]">
                ${crash.exception}
              </div>
              <div class="text-deck-lightText leading-relaxed">
                <strong class="text-white">Causa Rilevata:</strong> ${crash.detail}
              </div>
              <div class="flex items-center justify-between gap-2 pt-1">
                <span class="text-[10px] text-mint-glow truncate">Fix consigliato: ${crash.fixFile}</span>
                ${crash.patched ? `
                  <span class="px-2.5 py-1 bg-mint-deep text-mint-glow border border-mint-glow/40 rounded font-bold text-[10px] flex items-center gap-1">
                    <span class="material-symbols-outlined text-[13px]">check</span> Hotfix Applicato
                  </span>
                ` : `
                  <button type="button" id="btn-apply-hotfix" class="tactile-btn px-3 py-1.5 bg-mint-glow text-deck-black font-bold rounded flex items-center gap-1 text-[11px] shadow-[0_0_12px_rgba(0,255,157,0.4)]">
                    <span class="material-symbols-outlined text-[14px]">bolt</span>
                    <span>Applica Patch 1-Click</span>
                  </button>
                `}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Pure OLED Monospace Log Terminal Window -->
        <div class="stagger-3 flex flex-col terminal-window border border-deck-border rounded-xl overflow-hidden shadow-2xl">
          <div class="flex items-center justify-between px-3 py-1.5 bg-deck-card border-b border-deck-border font-mono text-[10px]">
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-rose-500/80"></span>
                <span class="w-2 h-2 rounded-full bg-amber-400/80"></span>
                <span class="w-2 h-2 rounded-full bg-mint-glow/80"></span>
              </div>
              <span class="text-deck-lightText">latest.log (tail ${filteredLogs.length})</span>
            </div>
            <span class="text-mint-glow/80 tracking-wider">${srv.software.toUpperCase()} ${srv.version}</span>
          </div>

          <div id="terminal-stream" class="flex flex-col p-2.5 gap-1.5 overflow-y-auto h-[320px] font-mono text-[11px] leading-relaxed select-text">
            ${filteredLogs.map(entry => {
              if (entry.type === 'error') {
                return `
                  <div class="flex flex-col bg-rose-950/30 px-2 py-1 rounded border-l-2 border-rose-500 gap-0.5">
                    <div class="flex items-start gap-1.5">
                      <span class="text-rose-400/70 shrink-0 text-[10px]">${entry.time}</span>
                      <span class="px-1 py-0.2 rounded bg-rose-950 text-rose-400 font-semibold text-[9px] shrink-0 border border-rose-800/60">${entry.badge}</span>
                      <span class="text-rose-300 font-medium break-all">${entry.text}</span>
                    </div>
                    ${entry.stack ? `<div class="pl-4 text-[9.5px] text-rose-400/75 font-mono">${entry.stack}</div>` : ''}
                  </div>
                `;
              }
              if (entry.type === 'warn') {
                return `
                  <div class="flex items-start gap-1.5 bg-amber-950/25 px-2 py-1 rounded border-l-2 border-amber-400">
                    <span class="text-deck-dimText shrink-0 text-[10px]">${entry.time}</span>
                    <span class="px-1 py-0.2 rounded bg-amber-950 text-amber-300 font-semibold text-[9px] shrink-0 border border-amber-700/50">${entry.badge}</span>
                    <span class="text-amber-200 break-all">${entry.text}</span>
                  </div>
                `;
              }
              return `
                <div class="flex items-start gap-1.5 px-1">
                  <span class="text-deck-dimText shrink-0 text-[10px]">${entry.time}</span>
                  <span class="px-1 py-0.2 rounded bg-deck-card text-mint-glow font-semibold text-[9px] shrink-0 border border-deck-border">${entry.badge}</span>
                  <span class="text-deck-white break-all">${entry.text}</span>
                </div>
              `;
            }).join('')}
            <div class="flex items-center gap-1.5 text-deck-dimText pt-1 text-[10px]">
              <span class="text-mint-glow font-bold animate-pulse">❯</span>
              <span>Thread worker attivo • RCON Ready</span>
            </div>
          </div>
        </div>

        <!-- Quick-Command Bar -->
        <div class="stagger-4 flex flex-col gap-1">
          <div class="flex items-center justify-between px-0.5 font-mono text-[10px]">
            <span class="text-deck-dimText uppercase tracking-wider">Quick-Command Macros</span>
            <span class="text-mint-glow/80">Tocca per eseguire</span>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            ${[
              { cmd: '/tps', icon: 'speed' },
              { cmd: '/list', icon: 'group' },
              { cmd: '/save-all', icon: 'save' },
              { cmd: '/whitelist on', icon: 'verified_user' },
              { cmd: '/weather clear', icon: 'wb_sunny' },
              { cmd: '/time set day', icon: 'schedule' },
              { cmd: '/say Server Restart in 5m!', icon: 'campaign' },
              { cmd: '/help', icon: 'help' },
              { cmd: '/stop', icon: 'power_settings_new', danger: true }
            ].map(m => `
              <button type="button" data-macro-cmd="${m.cmd}" class="tactile-btn flex items-center gap-1 bg-deck-card border ${m.danger ? 'border-rose-500/40 text-rose-400' : 'border-deck-border text-white hover:border-mint-glow'} font-mono text-[11px] px-2.5 py-1.5 rounded shrink-0">
                <span class="material-symbols-outlined text-[13px] ${m.danger ? 'text-rose-400' : 'text-mint-glow'}">${m.icon}</span>
                <span>${m.cmd}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Minimal Prompt Input Bar -->
        <form id="console-cmd-form" class="stagger-5 flex items-center gap-1.5 bg-deck-card border border-deck-border rounded-xl p-1.5 focus-within:border-mint-glow transition-all">
          <span class="pl-2 font-mono text-mint-glow font-bold text-[14px] select-none">&gt;_</span>
          <input id="console-input" type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Invia comando RCON o /help..." class="w-full bg-transparent text-white placeholder:text-deck-dimText font-mono text-[12px] py-1.5 px-1.5 focus:outline-none"/>
          <button type="submit" class="tactile-btn flex items-center justify-center bg-mint-glow text-deck-black hover:bg-white w-9 h-9 rounded-lg shrink-0 font-bold shadow-[0_0_12px_rgba(0,255,157,0.3)]">
            <span class="material-symbols-outlined text-[18px]">send</span>
          </button>
        </form>
      </div>
    `;

    const stream = document.getElementById('terminal-stream');
    if (stream && this.autoScroll) {
      stream.scrollTop = stream.scrollHeight;
    }

    // Bind Console Events
    document.getElementById('btn-autoscroll')?.addEventListener('click', () => {
      this.autoScroll = !this.autoScroll;
      triggerNativeHaptic('TICK');
      this.renderConsoleView(container);
    });

    document.getElementById('btn-clear-logs')?.addEventListener('click', () => {
      srv.logs = [];
      triggerNativeHaptic('TICK');
      this.renderConsoleView(container);
    });

    document.getElementById('btn-sim-crash')?.addEventListener('click', () => {
      triggerNativeHaptic('ERROR');
      srv.activeCrash = {
        id: 'crash-' + Date.now(),
        plugin: 'UnsupportedClassVersionError',
        title: 'Java Class Version 65.0 Mismatch',
        exception: 'java.lang.UnsupportedClassVersionError: net/pl3x/map/Pl3xMap has been compiled by a more recent version of the Java Runtime (class file version 65.0)',
        detail: 'Il plugin richiede OpenJDK 21 (Class 65.0), ma il container secondario aveva il flag legacy JDK 17.',
        fixFile: 'Switch-Runtime-OpenJDK21.patch',
        patched: false
      };
      this.doctorExpanded = true;
      store.appendLog(srv, 'ERROR', '[JVM] java.lang.UnsupportedClassVersionError: class file version 65.0', 'error', 'at java.lang.ClassLoader.defineClass1(Native Method)');
      store.notify('crash-simulated');
      this.showToast('Crash Java rilevato! AI Crash Doctor attivato.', 'AI DOCTOR', true);
    });

    document.getElementById('btn-export-logs')?.addEventListener('click', () => {
      const rawLog = srv.files['/logs/latest.log'] || 'No logs';
      if (navigator.clipboard) navigator.clipboard.writeText(rawLog).catch(() => {});
      if (window.AnvilNative && typeof window.AnvilNative.exportServerFile === 'function') {
        const res = JSON.parse(window.AnvilNative.exportServerFile(`${srv.id}-latest.log`, rawLog));
        if (res.ok) {
          this.showToast(`Esportato in ${res.path}`, 'EXPORT OK');
          return;
        }
      }
      this.showToast('Log copiati negli appunti e pronti per export!', 'LOGS COPIED');
    });

    container.querySelectorAll('[data-log-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.consoleFilter = btn.getAttribute('data-log-filter');
        triggerNativeHaptic('TICK');
        this.renderConsoleView(container);
      });
    });

    document.getElementById('btn-toggle-doctor')?.addEventListener('click', () => {
      this.doctorExpanded = !this.doctorExpanded;
      triggerNativeHaptic('TICK');
      this.renderConsoleView(container);
    });

    document.getElementById('btn-apply-hotfix')?.addEventListener('click', () => {
      if (!srv.activeCrash) return;
      srv.activeCrash.patched = true;
      store.appendLog(srv, 'INFO', `<span class="text-mint-glow font-bold">[Anvil AI Doctor]</span> Applicata patch automatica <span class="text-white">${srv.activeCrash.fixFile}</span>. Nessun riavvio necessario.`, 'info');
      triggerNativeHaptic('SUCCESS');
      store.notify('hotfix-applied');
      this.showToast(`Patch ${srv.activeCrash.fixFile} applicata con successo!`, 'HOTFIX OK');
    });

    container.querySelectorAll('[data-macro-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-macro-cmd');
        store.executeConsoleCommand(cmd);
      });
    });

    document.getElementById('console-cmd-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('console-input');
      if (!input || !input.value.trim()) return;
      const val = input.value;
      input.value = '';
      store.executeConsoleCommand(val);
    });
  }

  /* =========================================================================
   * MODULE 3: PLAYERS & WORLD MANAGER
   * ========================================================================= */
  renderPlayersView(container) {
    const srv = store.getActiveServer();
    if (!srv) return;

    const allPlayers = srv.players || [];
    const counts = {
      online: allPlayers.filter(p => p.online && !p.banned).length,
      whitelist: allPlayers.filter(p => p.whitelisted).length,
      ops: allPlayers.filter(p => p.op).length,
      banned: allPlayers.filter(p => p.banned).length
    };

    const filtered = allPlayers.filter(p => {
      if (this.playersSubTab === 'online' && (!p.online || p.banned)) return false;
      if (this.playersSubTab === 'whitelist' && !p.whitelisted) return false;
      if (this.playersSubTab === 'ops' && !p.op) return false;
      if (this.playersSubTab === 'banned' && !p.banned) return false;
      if (this.playersSearch) {
        const q = this.playersSearch.toLowerCase();
        return p.username.toLowerCase().includes(q) || (p.world || '').toLowerCase().includes(q) || (p.ip || '').includes(q);
      }
      return true;
    });

    const targetPlayer = allPlayers.find(p => p.username === this.selectedPlayerUsername) || allPlayers[0];

    container.innerHTML = `
      <div class="flex flex-col w-full gap-3 pb-6">
        <!-- Tactical Quick Segment Switcher -->
        <section class="stagger-1 w-full bg-deck-card p-1 rounded-xl border border-deck-border grid grid-cols-4 gap-1">
          ${[
            { id: 'online', label: 'Online', icon: 'sensors', count: counts.online },
            { id: 'whitelist', label: 'Whitelist', icon: 'verified_user', count: counts.whitelist },
            { id: 'ops', label: 'OPs', icon: 'admin_panel_settings', count: counts.ops },
            { id: 'banned', label: 'Bans', icon: 'block', count: counts.banned }
          ].map(t => {
            const active = this.playersSubTab === t.id;
            return `
              <button type="button" data-p-subtab="${t.id}" class="tactile-btn flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg font-mono text-[10px] uppercase ${
                active ? 'bg-mint-deep/80 text-mint-glow border border-mint-glow/30 font-bold' : 'text-deck-dimText hover:text-white'
              }">
                <span class="material-symbols-outlined text-[14px]">${t.icon}</span>
                <span>${t.label}</span>
                <span class="text-[8px] px-1 py-0.5 rounded-full ${active ? 'bg-mint-glow text-deck-black' : 'bg-deck-darker text-deck-lightText'} font-bold leading-none">${t.count}</span>
              </button>
            `;
          }).join('')}
        </section>

        <!-- Search & Add Player Bar -->
        <section class="stagger-1 flex items-center gap-2">
          <div class="flex-1 flex items-center gap-2 bg-deck-card border border-deck-border px-3 py-2 rounded-xl focus-within:border-mint-glow">
            <span class="material-symbols-outlined text-deck-dimText text-[16px]">search</span>
            <input id="player-search-input" type="text" value="${this.playersSearch}" placeholder="Cerca gamertag, IP o mondo..." class="bg-transparent border-0 p-0 text-white placeholder:text-deck-dimText font-mono text-xs focus:outline-none w-full"/>
          </div>
          <button type="button" id="btn-sim-join" title="Simula Ingresso Giocatore" class="tactile-btn px-3 h-9 rounded-xl bg-mint-deep border border-mint-glow/40 text-mint-glow font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            <span class="material-symbols-outlined text-[15px]">person_add</span>
            <span>+ Join</span>
          </button>
        </section>

        <!-- Player Live Matrix (Bento Cards) -->
        <section class="stagger-2 flex flex-col gap-2">
          <div class="flex items-center justify-between px-1 font-mono text-[10px]">
            <div class="flex items-center gap-1.5 text-mint-glow font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-mint-glow animate-ping"></span>
              <span>ACTIVE AGENTS CLUSTER (${filtered.length})</span>
            </div>
            <span class="text-deck-dimText uppercase">DIFFICULTY: ${srv.difficulty.toUpperCase()}</span>
          </div>

          ${filtered.length === 0 ? `
            <div class="p-6 rounded-xl bg-deck-card border border-deck-border text-center font-mono text-xs text-deck-dimText">
              Nessun giocatore in questa vista. Usa "+ Join" per simulare un ingresso.
            </div>
          ` : filtered.map(p => {
            const isSelected = targetPlayer && targetPlayer.username === p.username;
            return `
              <div data-player-card="${p.username}" class="tactile-card cursor-pointer w-full bg-deck-card p-3 rounded-xl border ${isSelected ? 'border-mint-glow/60 bg-mint-deep/10' : 'border-deck-border'} flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="relative w-11 h-11 rounded-lg bg-deck-darker p-0.5 shrink-0 border border-deck-border overflow-hidden">
                    <img src="${getPlayerIsoHeadUrl(p.username, 64)}" onerror="this.src='${getPlayerAvatarUrl(p.username, 64)}'" alt="${p.username}" class="w-full h-full object-contain rounded-md"/>
                    <span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ${p.banned ? 'bg-rose-500' : p.online ? 'bg-mint-glow shadow-[0_0_8px_#00ff9d]' : 'bg-slate-500'} ring-2 ring-deck-card"></span>
                  </div>
                  <div class="flex flex-col min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-sm text-white truncate">${p.username}</span>
                      ${p.op ? `<span class="flex items-center gap-0.5 px-1.5 py-0.2 bg-mint-deep text-mint-glow border border-mint-glow/30 rounded font-mono text-[8px] uppercase font-bold">OP</span>` : ''}
                      ${p.banned ? `<span class="px-1.5 py-0.2 bg-rose-950 text-rose-400 border border-rose-500/30 rounded font-mono text-[8px] uppercase font-bold">BANNED</span>` : ''}
                    </div>
                    <div class="flex items-center gap-2 mt-1 font-mono text-[10px]">
                      <span class="px-1.5 py-0.2 rounded bg-deck-darker text-mint-glow font-semibold text-[9px]">${p.gamemode}</span>
                      <span class="text-deck-lightText">${p.online ? p.ping + 'ms' : 'Offline'}</span>
                      <span class="text-deck-dimText truncate">XYZ: ${p.coords}</span>
                    </div>
                  </div>
                </div>
                <button type="button" data-player-sheet-btn="${p.username}" class="tactile-btn w-8 h-8 rounded-lg bg-deck-darker border border-deck-border flex items-center justify-center text-deck-lightText hover:text-mint-glow shrink-0">
                  <span class="material-symbols-outlined text-[18px]">tune</span>
                </button>
              </div>
            `;
          }).join('')}
        </section>

        <!-- Quick Tactical Actions Dock for Selected Player -->
        ${targetPlayer ? `
          <section class="stagger-3 w-full bg-deck-card p-3 rounded-xl border border-deck-border flex flex-col gap-2">
            <div class="flex items-center justify-between font-mono text-[10px]">
              <div class="flex items-center gap-1.5 text-white font-bold">
                <span class="material-symbols-outlined text-mint-glow text-[15px]">bolt</span>
                <span>TACTICAL ACTIONS DOCK</span>
              </div>
              <span class="text-mint-glow font-bold">TARGET: ${targetPlayer.username}</span>
            </div>
            <div class="grid grid-cols-5 gap-1.5">
              <button type="button" data-quick-p-act="gamemode" class="tactile-btn flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-deck-darker border border-deck-border hover:border-mint-glow/40">
                <span class="material-symbols-outlined text-[17px] text-mint-glow">sync_alt</span>
                <span class="font-mono text-[8px] uppercase mt-1 text-deck-lightText">Mode</span>
              </button>
              <button type="button" data-quick-p-act="op" class="tactile-btn flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-deck-darker border border-deck-border hover:border-mint-glow/40">
                <span class="material-symbols-outlined text-[17px] text-mint-glow">shield_person</span>
                <span class="font-mono text-[8px] uppercase mt-1 text-deck-lightText">${targetPlayer.op ? 'De-OP' : 'Make OP'}</span>
              </button>
              <button type="button" data-quick-p-act="tp" class="tactile-btn flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-deck-darker border border-deck-border hover:border-mint-glow/40">
                <span class="material-symbols-outlined text-[17px] text-mint-glow">near_me</span>
                <span class="font-mono text-[8px] uppercase mt-1 text-deck-lightText">Teleport</span>
              </button>
              <button type="button" data-quick-p-act="kick" class="tactile-btn flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-deck-darker border border-deck-border hover:border-amber-400/50 text-amber-300">
                <span class="material-symbols-outlined text-[17px]">person_remove</span>
                <span class="font-mono text-[8px] uppercase mt-1">Kick</span>
              </button>
              <button type="button" data-quick-p-act="ban" class="tactile-btn flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-rose-950/30 border border-rose-500/40 text-rose-400">
                <span class="material-symbols-outlined text-[17px]">gavel</span>
                <span class="font-mono text-[8px] uppercase mt-1 font-bold">${targetPlayer.banned ? 'Unban' : 'Ban'}</span>
              </button>
            </div>
          </section>
        ` : ''}

        <!-- World Environmental Deck & Gamerules -->
        <section class="stagger-4 w-full flex flex-col gap-3 bg-deck-card p-3.5 rounded-xl border border-deck-border">
          <div class="flex items-center justify-between font-mono text-[10px]">
            <div class="flex items-center gap-1.5 font-bold text-white uppercase">
              <span class="material-symbols-outlined text-mint-glow text-[16px]">public</span>
              <span>WORLD ENVIRONMENTAL DECK</span>
            </div>
            <span class="text-mint-glow">SEED: ${srv.seed}</span>
          </div>

          <!-- Difficulty Switcher -->
          <div class="flex flex-col gap-1">
            <span class="font-mono text-[9px] text-deck-dimText uppercase tracking-wider">Difficoltà Mondo</span>
            <div class="grid grid-cols-4 gap-1.5">
              ${['peaceful', 'easy', 'normal', 'hard'].map(d => {
                const active = srv.difficulty === d;
                return `
                  <button type="button" data-world-diff="${d}" class="tactile-btn py-1.5 rounded-lg font-mono text-[9px] uppercase font-bold border ${
                    active ? 'bg-mint-deep text-mint-glow border-mint-glow/40' : 'bg-deck-darker text-deck-lightText border-deck-border'
                  }">${d}</button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Celestial Clock -->
          <div class="flex flex-col gap-1">
            <span class="font-mono text-[9px] text-deck-dimText uppercase tracking-wider">Orario del Mondo (Celestial Clock)</span>
            <div class="grid grid-cols-4 gap-1.5">
              ${[
                { id: 'dawn', label: 'Alba', icon: 'wb_twilight' },
                { id: 'day', label: 'Giorno', icon: 'wb_sunny' },
                { id: 'dusk', label: 'Tramonto', icon: 'wb_twilight' },
                { id: 'night', label: 'Notte', icon: 'bedtime' }
              ].map(t => {
                const active = srv.worldTime === t.id;
                return `
                  <button type="button" data-world-time="${t.id}" class="tactile-btn flex flex-col items-center py-2 rounded-lg border ${
                    active ? 'bg-mint-deep text-mint-glow border-mint-glow/40 font-bold' : 'bg-deck-darker text-deck-lightText border-deck-border'
                  }">
                    <span class="material-symbols-outlined text-[17px]">${t.icon}</span>
                    <span class="font-mono text-[8px] uppercase mt-0.5">${t.label}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Weather Protocol -->
          <div class="flex flex-col gap-1">
            <span class="font-mono text-[9px] text-deck-dimText uppercase tracking-wider">Meteo (Weather Protocol)</span>
            <div class="grid grid-cols-3 gap-1.5">
              ${[
                { id: 'clear', label: 'Sereno', icon: 'clear_day' },
                { id: 'rain', label: 'Pioggia', icon: 'rainy' },
                { id: 'thunder', label: 'Tempesta', icon: 'thunderstorm' }
              ].map(w => {
                const active = srv.weather === w.id;
                return `
                  <button type="button" data-world-weather="${w.id}" class="tactile-btn flex items-center justify-center gap-1.5 py-2 rounded-lg border ${
                    active ? 'bg-mint-deep text-mint-glow border-mint-glow/40 font-bold' : 'bg-deck-darker text-deck-lightText border-deck-border'
                  }">
                    <span class="material-symbols-outlined text-[15px]">${w.icon}</span>
                    <span class="font-mono text-[9px] uppercase">${w.label}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Gamerules 2x2 Grid -->
          <div class="flex flex-col gap-1.5 pt-1">
            <span class="font-mono text-[9px] text-deck-dimText uppercase tracking-wider">Gamerules Istantanee</span>
            <div class="grid grid-cols-2 gap-2">
              ${[
                { key: 'keepInventory', label: 'KeepInventory', sub: 'Salva inventario', icon: 'lock_person' },
                { key: 'doDaylightCycle', label: 'DaylightCycle', sub: 'Ciclo solare', icon: 'schedule' },
                { key: 'mobGriefing', label: 'MobGriefing', sub: 'Esplosioni mob', icon: 'pest_control' },
                { key: 'pvp', label: 'Player PvP', sub: 'Combattimento', icon: 'swords' },
                { key: 'doFireTick', label: 'FireTick', sub: 'Diffusione fuoco', icon: 'local_fire_department' }
              ].map(g => {
                const val = Boolean(srv.gamerules[g.key]);
                return `
                  <div class="flex items-center justify-between p-2.5 rounded-lg bg-deck-darker border border-deck-border">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="material-symbols-outlined text-[16px] ${val ? 'text-mint-glow' : 'text-deck-dimText'}">${g.icon}</span>
                      <div class="flex flex-col min-w-0">
                        <span class="font-mono text-[11px] text-white font-semibold truncate">${g.label}</span>
                        <span class="font-mono text-[8px] text-deck-dimText truncate">${g.sub}</span>
                      </div>
                    </div>
                    <button type="button" data-gamerule-toggle="${g.key}" aria-checked="${val}" class="obsidian-switch shrink-0">
                      <span class="obsidian-switch-thumb"></span>
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </section>
      </div>
    `;

    // Bind Players View Events
    container.querySelectorAll('[data-p-subtab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.playersSubTab = btn.getAttribute('data-p-subtab');
        triggerNativeHaptic('TICK');
        this.renderPlayersView(container);
      });
    });

    const searchIn = document.getElementById('player-search-input');
    searchIn?.addEventListener('input', (e) => {
      this.playersSearch = e.target.value;
      this.renderPlayersView(container);
      const ref = document.getElementById('player-search-input');
      if (ref) {
        ref.focus();
        ref.setSelectionRange(ref.value.length, ref.value.length);
      }
    });

    document.getElementById('btn-sim-join')?.addEventListener('click', () => {
      const pool = ['Notch', 'Jeb_', 'Dinnerbone', 'Technoblade', 'Grian', 'MumboJumbo', 'EthosLab', 'CaptainSparklez'];
      const pick = pool[Math.floor(Math.random() * pool.length)] + '_' + Math.floor(10 + Math.random() * 89);
      srv.players.unshift({
        username: pick,
        uuid: pick,
        online: true,
        op: false,
        whitelisted: true,
        banned: false,
        gamemode: 'SURVIVAL',
        ping: Math.floor(15 + Math.random() * 45),
        coords: `${Math.floor(Math.random() * 600)}, 68, ${Math.floor(Math.random() * 600)}`,
        world: 'overworld',
        ip: `192.168.1.${Math.floor(20 + Math.random() * 200)}`
      });
      this.selectedPlayerUsername = pick;
      store.appendLog(srv, 'JOIN', `Player <span class="text-white font-semibold">${pick}</span> joined the server`, 'chat');
      store.notify('player-joined');
      this.showToast(`${pick} è entrato nel server!`, 'PLAYER JOIN');
    });

    container.querySelectorAll('[data-player-card]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-player-sheet-btn]')) return;
        const uname = card.getAttribute('data-player-card');
        this.selectedPlayerUsername = uname;
        this.openPlayerActionSheet(uname);
      });
    });

    container.querySelectorAll('[data-player-sheet-btn]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const uname = btn.getAttribute('data-player-sheet-btn');
        this.selectedPlayerUsername = uname;
        this.openPlayerActionSheet(uname);
      });
    });

    container.querySelectorAll('[data-quick-p-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!targetPlayer) return;
        const act = btn.getAttribute('data-quick-p-act');
        this.performPlayerAction(targetPlayer, act);
      });
    });

    container.querySelectorAll('[data-world-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = btn.getAttribute('data-world-diff');
        srv.difficulty = d;
        store.executeConsoleCommand(`/difficulty ${d}`);
        this.showToast(`Difficoltà impostata su ${d.toUpperCase()}`, 'WORLD');
      });
    });

    container.querySelectorAll('[data-world-time]').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.getAttribute('data-world-time');
        srv.worldTime = t;
        store.executeConsoleCommand(`/time set ${t}`);
        this.showToast(`Orario mondo impostato su ${t.toUpperCase()}`, 'TIME SET');
      });
    });

    container.querySelectorAll('[data-world-weather]').forEach(btn => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-world-weather');
        srv.weather = w;
        store.executeConsoleCommand(`/weather ${w}`);
        this.showToast(`Meteo impostato su ${w.toUpperCase()}`, 'WEATHER');
      });
    });

    container.querySelectorAll('[data-gamerule-toggle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-gamerule-toggle');
        srv.gamerules[key] = !srv.gamerules[key];
        store.executeConsoleCommand(`/gamerule ${key} ${srv.gamerules[key]}`);
        this.showToast(`Gamerule ${key} = ${srv.gamerules[key]}`, 'GAMERULE');
      });
    });
  }

  performPlayerAction(player, action) {
    const srv = store.getActiveServer();
    if (!srv || !player) return;

    if (action === 'gamemode') {
      const modes = ['SURVIVAL', 'CREATIVE', 'SPECTATOR', 'ADVENTURE'];
      const next = modes[(modes.indexOf(player.gamemode) + 1) % modes.length];
      player.gamemode = next;
      store.executeConsoleCommand(`/gamemode ${next.toLowerCase()} ${player.username}`);
      this.showToast(`Gamemode di ${player.username} → ${next}`, 'GAMEMODE');
    } else if (action === 'op') {
      player.op = !player.op;
      store.executeConsoleCommand(`/${player.op ? 'op' : 'deop'} ${player.username}`);
      this.showToast(`${player.username} ${player.op ? 'promosso a Operatore (OP)' : 'rimosso dagli OP'}`, 'OPERATOR');
    } else if (action === 'tp') {
      player.coords = '0, 75, 0';
      store.executeConsoleCommand(`/tp ${player.username} 0 75 0`);
      this.showToast(`${player.username} teletrasportato allo Spawn (0, 75, 0)`, 'TELEPORT');
    } else if (action === 'clear') {
      store.executeConsoleCommand(`/clear ${player.username}`);
      this.showToast(`Inventario di ${player.username} svuotato`, 'INVENTORY');
    } else if (action === 'kick') {
      player.online = false;
      store.executeConsoleCommand(`/kick ${player.username} Espulso da Anvil-MC Mobile`);
      this.showToast(`${player.username} espulso dal server`, 'KICKED', true);
    } else if (action === 'ban') {
      player.banned = !player.banned;
      if (player.banned) {
        player.online = false;
        store.executeConsoleCommand(`/ban ${player.username} Violazione regolamento server`);
        this.showToast(`${player.username} BANNATO dal server`, 'BANNED', true);
      } else {
        store.executeConsoleCommand(`/pardon ${player.username}`);
        this.showToast(`Ban revocato per ${player.username}`, 'UNBANNED');
      }
    }
    store.notify('player-action');
  }

  /* =========================================================================
   * MODULE 4: VISUAL CONFIG STUDIO & FILE MANAGER
   * ========================================================================= */
  renderConfigView(container) {
    const srv = store.getActiveServer();
    if (!srv) return;

    const props = srv.properties;
    const filesList = Object.keys(srv.files || {});
    if (!srv.files[this.activeFilePath]) {
      this.activeFilePath = filesList[0] || '/server.properties';
    }

    container.innerHTML = `
      <div class="flex flex-col w-full gap-3.5 pb-8">
        <!-- Top Mode Switcher -->
        <div class="stagger-1 flex flex-col gap-2">
          <div class="grid grid-cols-2 p-1 bg-deck-card border border-deck-border rounded-xl">
            <button type="button" data-cfg-tab="visual" class="tactile-btn flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-mono text-xs font-bold ${
              this.configSubTab === 'visual' ? 'bg-mint-deep text-mint-glow border border-mint-glow/30' : 'text-deck-dimText hover:text-white'
            }">
              <span class="material-symbols-outlined text-[16px]">tune</span>
              <span>Visual Studio</span>
            </button>
            <button type="button" data-cfg-tab="files" class="tactile-btn flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-mono text-xs font-bold ${
              this.configSubTab === 'files' ? 'bg-mint-deep text-mint-glow border border-mint-glow/30' : 'text-deck-dimText hover:text-white'
            }">
              <span class="material-symbols-outlined text-[16px]">folder_code</span>
              <span>File Explorer (${filesList.length})</span>
            </button>
          </div>
        </div>

        ${this.configSubTab === 'visual' ? `
          <!-- MOTD Live Visualizer Card -->
          <div class="stagger-2 flex flex-col p-3.5 bg-deck-card border border-deck-border rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-mint-glow text-[18px]">visibility</span>
                <span class="font-bold text-sm text-white">MOTD Live Preview</span>
              </div>
              <span class="font-mono text-[10px] text-mint-glow bg-mint-deep px-2 py-0.5 rounded border border-mint-glow/30">Multiplayer Ping View</span>
            </div>

            <!-- Minecraft Server Entry Preview Box -->
            <div class="p-3 bg-deck-black border border-deck-border rounded-lg flex gap-3 items-start">
              <div class="w-11 h-11 rounded-lg bg-mint-deep border border-mint-glow/40 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-mint-glow text-[24px]">dns</span>
              </div>
              <div class="flex flex-col min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs text-white truncate">${srv.name}</span>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-[10px] text-deck-lightText">${srv.players.filter(p => p.online && !p.banned).length}/${props['max-players']}</span>
                    <div class="flex items-end gap-[1.5px] h-3 w-3.5 pb-0.5">
                      <span class="w-[2px] h-1 bg-mint-glow"></span>
                      <span class="w-[2px] h-1.5 bg-mint-glow"></span>
                      <span class="w-[2px] h-2 bg-mint-glow"></span>
                      <span class="w-[2px] h-2.5 bg-mint-glow"></span>
                      <span class="w-[2px] h-3 bg-mint-glow"></span>
                    </div>
                  </div>
                </div>
                <div id="motd-preview-rendered" class="font-mono text-xs leading-tight pt-0.5 truncate">
                  ${parseMinecraftFormattedText(props['motd'])}
                </div>
                <p class="font-mono text-[10px] text-deck-dimText truncate">
                  ${srv.software} ${srv.version} • ${srv.address}:${props['server-port']}
                </p>
              </div>
            </div>

            <!-- 16 Minecraft Color Swatches & Formatting Codes -->
            <div class="flex flex-col space-y-2 pt-1">
              <div class="flex items-center justify-between font-mono text-[10px]">
                <span class="text-deck-dimText">TAVOLOZZA 16 COLORI MINECRAFT</span>
                <span class="text-mint-glow">§ Tocca per inserire</span>
              </div>
              <div class="grid grid-cols-8 gap-1.5">
                ${[
                  { c: '0', bg: '#000000', fg: '#ffffff' },
                  { c: '1', bg: '#0000AA', fg: '#ffffff' },
                  { c: '2', bg: '#00AA00', fg: '#ffffff' },
                  { c: '3', bg: '#00AAAA', fg: '#ffffff' },
                  { c: '4', bg: '#AA0000', fg: '#ffffff' },
                  { c: '5', bg: '#AA00AA', fg: '#ffffff' },
                  { c: '6', bg: '#FFAA00', fg: '#000000' },
                  { c: '7', bg: '#AAAAAA', fg: '#000000' },
                  { c: '8', bg: '#555555', fg: '#ffffff' },
                  { c: '9', bg: '#5555FF', fg: '#ffffff' },
                  { c: 'a', bg: '#00FF9D', fg: '#000000' },
                  { c: 'b', bg: '#55FFFF', fg: '#000000' },
                  { c: 'c', bg: '#FF5555', fg: '#ffffff' },
                  { c: 'd', bg: '#FF55FF', fg: '#000000' },
                  { c: 'e', bg: '#FFFF55', fg: '#000000' },
                  { c: 'f', bg: '#FFFFFF', fg: '#000000' }
                ].map(sw => `
                  <button type="button" data-motd-code="§${sw.c}" style="background:${sw.bg};color:${sw.fg}" class="tactile-btn h-6 rounded-full border border-white/15 font-mono text-[10px] font-bold flex items-center justify-center">
                    ${sw.c}
                  </button>
                `).join('')}
              </div>

              <!-- Style Chips -->
              <div class="grid grid-cols-4 gap-1.5 pt-1">
                <button type="button" data-motd-code="§l" class="tactile-btn py-1 rounded bg-deck-darker border border-deck-border text-white font-mono font-bold text-[10px]">§l Bold</button>
                <button type="button" data-motd-code="§o" class="tactile-btn py-1 rounded bg-deck-darker border border-deck-border text-white font-mono italic text-[10px]">§o Italic</button>
                <button type="button" data-motd-code="§k" class="tactile-btn py-1 rounded bg-deck-darker border border-deck-border text-mint-glow font-mono text-[10px]">§k Glitch</button>
                <button type="button" data-motd-code="§r" class="tactile-btn py-1 rounded bg-deck-darker border border-rose-500/30 text-rose-400 font-mono text-[10px]">§r Reset</button>
              </div>

              <!-- Raw MOTD Input -->
              <div class="relative flex items-center mt-1">
                <span class="absolute left-3 text-mint-glow font-mono text-xs">&gt;_</span>
                <input id="motd-input" type="text" value="${props['motd']}" class="w-full bg-deck-black border border-deck-border focus:border-mint-glow text-white font-mono text-xs pl-8 pr-8 py-2.5 rounded-lg focus:outline-none"/>
                <button type="button" id="motd-clear-btn" class="absolute right-2 text-deck-dimText hover:text-white p-1">
                  <span class="material-symbols-outlined text-[16px]">cancel</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Boolean Toggle Directives -->
          <div class="stagger-3 flex flex-col p-3.5 bg-deck-card border border-deck-border rounded-xl space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-mint-glow text-[18px]">toggle_on</span>
                <span class="font-bold text-sm text-white">Runtime Directives (Boolean)</span>
              </div>
              <span class="font-mono text-[10px] text-deck-dimText">server.properties</span>
            </div>
            <div class="grid grid-cols-1 gap-2">
              ${[
                { key: 'online-mode', label: 'Online Mode (Mojang Auth)', icon: 'security' },
                { key: 'pvp', label: 'PvP Combat Enabled', icon: 'swords' },
                { key: 'allow-flight', label: 'Allow Survival Flight', icon: 'flight' },
                { key: 'hardcore', label: 'Hardcore Permadeath Mode', icon: 'skull' },
                { key: 'enable-command-block', label: 'Enable Command Blocks', icon: 'terminal' },
                { key: 'white-list', label: 'Enforce Server Whitelist', icon: 'fact_check' }
              ].map(item => {
                const checked = Boolean(props[item.key]);
                return `
                  <div class="flex items-center justify-between p-2.5 bg-deck-darker border border-deck-border rounded-lg">
                    <div class="flex items-center gap-2.5">
                      <div class="w-7 h-7 rounded ${checked ? 'bg-mint-deep text-mint-glow' : 'bg-deck-card text-deck-dimText'} flex items-center justify-center">
                        <span class="material-symbols-outlined text-[16px]">${item.icon}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-xs font-bold text-white">${item.label}</span>
                        <span class="font-mono text-[10px] text-deck-dimText">${item.key}=${checked}</span>
                      </div>
                    </div>
                    <button type="button" data-prop-bool="${item.key}" aria-checked="${checked}" class="obsidian-switch">
                      <span class="obsidian-switch-thumb"></span>
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Numeric Steppers & Sliders -->
          <div class="stagger-4 flex flex-col p-3.5 bg-deck-card border border-deck-border rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-mint-glow text-[18px]">speed</span>
                <span class="font-bold text-sm text-white">Spatial & Resource Limits</span>
              </div>
              <span class="font-mono text-[10px] text-mint-glow">NUMERIC SLIDERS</span>
            </div>

            ${[
              { key: 'max-players', label: 'Max Players', min: 1, max: 200, step: 5, unit: '' },
              { key: 'view-distance', label: 'View Distance (Chunks)', min: 3, max: 32, step: 1, unit: ' ch' },
              { key: 'simulation-distance', label: 'Simulation Distance (Ticks)', min: 3, max: 24, step: 1, unit: ' ch' },
              { key: 'spawn-protection', label: 'Spawn Protection Radius', min: 0, max: 64, step: 2, unit: ' blk' }
            ].map(st => {
              const val = Number(props[st.key] ?? st.min);
              const pct = Math.min(100, Math.max(0, Math.round(((val - st.min) / (st.max - st.min)) * 100)));
              return `
                <div class="flex flex-col space-y-1.5 p-2.5 bg-deck-darker border border-deck-border rounded-lg">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-white">${st.label}</span>
                    <div class="flex items-center gap-1.5">
                      <button type="button" data-prop-step="${st.key}" data-delta="-${st.step}" data-min="${st.min}" data-max="${st.max}" class="tactile-btn w-6 h-6 rounded bg-deck-card border border-deck-border text-white font-mono font-bold text-xs">-</button>
                      <span class="font-mono text-xs text-mint-glow font-bold min-w-[54px] text-center bg-deck-black py-0.5 px-1.5 rounded border border-deck-border">${val}${st.unit}</span>
                      <button type="button" data-prop-step="${st.key}" data-delta="${st.step}" data-min="${st.min}" data-max="${st.max}" class="tactile-btn w-6 h-6 rounded bg-deck-card border border-deck-border text-white font-mono font-bold text-xs">+</button>
                    </div>
                  </div>
                  <input type="range" data-prop-slider="${st.key}" min="${st.min}" max="${st.max}" step="${st.step}" value="${val}" class="w-full accent-[#00ff9d] h-1.5 bg-deck-black rounded-lg cursor-pointer"/>
                </div>
              `;
            }).join('')}

            <!-- Server Port -->
            <div class="flex items-center justify-between p-2.5 bg-deck-darker border border-deck-border rounded-lg">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-white">Server Port (TCP/UDP)</span>
                <span class="font-mono text-[10px] text-deck-dimText">server-port=${props['server-port']}</span>
              </div>
              <input id="cfg-port-input" type="number" value="${props['server-port']}" class="w-24 bg-deck-black border border-deck-border text-mint-glow font-mono font-bold text-xs px-2.5 py-1.5 rounded text-center focus:outline-none focus:border-mint-glow"/>
            </div>
          </div>

          <!-- Save & Export Floating Action Bar -->
          <div class="sticky bottom-2 z-20 flex items-center justify-between p-2.5 bg-deck-card/95 backdrop-blur-md border border-mint-glow/30 rounded-xl shadow-xl">
            <button type="button" id="btn-export-props" class="tactile-btn flex items-center gap-1.5 px-3 py-2 rounded-lg bg-deck-darker border border-deck-border text-deck-lightText hover:text-white font-mono text-[11px]">
              <span class="material-symbols-outlined text-[15px]">download</span>
              <span>Esporta .properties</span>
            </button>
            <button type="button" id="btn-save-props" class="tactile-btn flex items-center gap-2 px-5 py-2 rounded-lg bg-mint-glow text-deck-black font-bold text-xs shadow-[0_0_16px_rgba(0,255,157,0.35)]">
              <span class="material-symbols-outlined text-[17px]">save</span>
              <span>Salva & Applica</span>
            </button>
          </div>
        ` : `
          <!-- File Explorer & Raw Code Editor -->
          <div class="stagger-2 flex flex-col gap-3">
            <!-- File Chips Selector -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              ${filesList.map(path => {
                const active = path === this.activeFilePath;
                return `
                  <button type="button" data-file-select="${path}" class="tactile-btn flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[11px] shrink-0 border ${
                    active ? 'bg-mint-deep text-mint-glow border-mint-glow/40 font-bold' : 'bg-deck-card text-deck-lightText border-deck-border'
                  }">
                    <span class="material-symbols-outlined text-[14px]">description</span>
                    <span>${path}</span>
                  </button>
                `;
              }).join('')}
              <button type="button" id="btn-new-file" class="tactile-btn flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-deck-card border border-mint-glow/30 text-mint-glow font-mono text-[11px] shrink-0">
                <span class="material-symbols-outlined text-[14px]">add</span>
                <span>Nuovo File</span>
              </button>
            </div>

            <!-- Code Editor Window -->
            <div class="flex flex-col rounded-xl bg-deck-black border border-deck-border overflow-hidden">
              <div class="flex items-center justify-between px-3 py-2 bg-deck-card border-b border-deck-border font-mono text-[11px]">
                <span class="text-mint-glow font-bold">${this.activeFilePath}</span>
                <span class="text-deck-dimText text-[10px]">UTF-8 • YAML/PROPERTIES</span>
              </div>
              <textarea id="raw-file-editor" rows="15" spellcheck="false" class="w-full bg-deck-black text-emerald-100 font-mono text-xs p-3 focus:outline-none leading-relaxed resize-y">${srv.files[this.activeFilePath] || ''}</textarea>
            </div>

            <div class="flex items-center justify-between gap-2">
              <button type="button" id="btn-export-raw-file" class="tactile-btn flex-1 py-2.5 rounded-xl bg-deck-card border border-deck-border text-deck-lightText hover:text-white font-mono text-xs font-semibold flex items-center justify-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">download</span>
                <span>Scarica sul Telefono</span>
              </button>
              <button type="button" id="btn-save-raw-file" class="tactile-btn flex-1 py-2.5 rounded-xl bg-mint-glow text-deck-black font-mono text-xs font-bold flex items-center justify-center gap-1.5 shadow-[0_0_16px_rgba(0,255,157,0.3)]">
                <span class="material-symbols-outlined text-[16px]">save</span>
                <span>Salva File</span>
              </button>
            </div>
          </div>
        `}
      </div>
    `;

    // Bind Config Subtabs
    container.querySelectorAll('[data-cfg-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.configSubTab = btn.getAttribute('data-cfg-tab');
        triggerNativeHaptic('TICK');
        this.renderConfigView(container);
      });
    });

    if (this.configSubTab === 'visual') {
      const motdInput = document.getElementById('motd-input');
      const motdPreview = document.getElementById('motd-preview-rendered');

      motdInput?.addEventListener('input', () => {
        props['motd'] = motdInput.value;
        if (motdPreview) {
          motdPreview.innerHTML = parseMinecraftFormattedText(motdInput.value);
        }
      });

      document.getElementById('motd-clear-btn')?.addEventListener('click', () => {
        if (!motdInput) return;
        motdInput.value = '';
        props['motd'] = '';
        if (motdPreview) motdPreview.innerHTML = 'A Minecraft Server';
        motdInput.focus();
      });

      container.querySelectorAll('[data-motd-code]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (!motdInput) return;
          const code = btn.getAttribute('data-motd-code');
          const start = motdInput.selectionStart ?? motdInput.value.length;
          const end = motdInput.selectionEnd ?? motdInput.value.length;
          motdInput.value = motdInput.value.slice(0, start) + code + motdInput.value.slice(end);
          props['motd'] = motdInput.value;
          if (motdPreview) motdPreview.innerHTML = parseMinecraftFormattedText(motdInput.value);
          triggerNativeHaptic('TICK');
          motdInput.focus();
        });
      });

      container.querySelectorAll('[data-prop-bool]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-prop-bool');
          props[key] = !props[key];
          store.syncPropertiesToRawFile(srv);
          triggerNativeHaptic('TICK');
          this.renderConfigView(container);
        });
      });

      container.querySelectorAll('[data-prop-step]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-prop-step');
          const delta = Number(btn.getAttribute('data-delta'));
          const min = Number(btn.getAttribute('data-min'));
          const max = Number(btn.getAttribute('data-max'));
          const next = Math.min(max, Math.max(min, Number(props[key] || min) + delta));
          props[key] = next;
          store.syncPropertiesToRawFile(srv);
          triggerNativeHaptic('TICK');
          this.renderConfigView(container);
        });
      });

      container.querySelectorAll('[data-prop-slider]').forEach(slider => {
        slider.addEventListener('change', (e) => {
          const key = slider.getAttribute('data-prop-slider');
          props[key] = Number(e.target.value);
          store.syncPropertiesToRawFile(srv);
          triggerNativeHaptic('TICK');
          this.renderConfigView(container);
        });
      });

      document.getElementById('cfg-port-input')?.addEventListener('change', (e) => {
        props['server-port'] = Number(e.target.value) || 25565;
        srv.port = props['server-port'];
      });

      document.getElementById('btn-save-props')?.addEventListener('click', () => {
        store.syncPropertiesToRawFile(srv);
        store.appendLog(srv, 'INFO', 'Reloaded <span class="text-mint-glow">server.properties</span> configuration from Visual Studio.', 'info');
        triggerNativeHaptic('SUCCESS');
        store.notify('props-saved');
        this.showToast('server.properties sincronizzato e applicato!', 'CONFIG SAVED');
      });

      document.getElementById('btn-export-props')?.addEventListener('click', () => {
        store.syncPropertiesToRawFile(srv);
        this.exportFileToDevice('server.properties', srv.files['/server.properties']);
      });
    } else {
      container.querySelectorAll('[data-file-select]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.activeFilePath = btn.getAttribute('data-file-select');
          triggerNativeHaptic('TICK');
          this.renderConfigView(container);
        });
      });

      document.getElementById('btn-new-file')?.addEventListener('click', () => {
        const name = prompt('Nome del nuovo file (es. /plugins/custom.yml):', '/plugins/custom.yml');
        if (name && name.trim()) {
          const clean = name.startsWith('/') ? name.trim() : '/' + name.trim();
          srv.files[clean] = `# Creato con Anvil-MC Studio\nenabled: true\n`;
          this.activeFilePath = clean;
          store.notify('file-created');
          this.showToast(`File ${clean} creato`, 'FILE MANAGER');
        }
      });

      document.getElementById('btn-save-raw-file')?.addEventListener('click', () => {
        const editor = document.getElementById('raw-file-editor');
        if (!editor) return;
        srv.files[this.activeFilePath] = editor.value;
        triggerNativeHaptic('SUCCESS');
        store.notify('file-saved');
        this.showToast(`Salvataggio di ${this.activeFilePath} completato!`, 'SAVED');
      });

      document.getElementById('btn-export-raw-file')?.addEventListener('click', () => {
        const editor = document.getElementById('raw-file-editor');
        const content = editor ? editor.value : (srv.files[this.activeFilePath] || '');
        const filename = this.activeFilePath.split('/').pop() || 'config.txt';
        this.exportFileToDevice(filename, content);
      });
    }
  }

  exportFileToDevice(filename, content) {
    if (window.AnvilNative && typeof window.AnvilNative.exportServerFile === 'function') {
      try {
        const res = JSON.parse(window.AnvilNative.exportServerFile(filename, content));
        if (res.ok) {
          this.showToast(`Salvato su Android: ${res.path}`, 'NATIVE EXPORT');
          return;
        }
      } catch (_) {}
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    this.showToast(`File ${filename} scaricato!`, 'DOWNLOAD');
  }

  /* =========================================================================
   * MODULE 5: ANVIL FORGE (MODRINTH MARKETPLACE & PAPERMC JARS)
   * ========================================================================= */
  async loadModrinthCatalog() {
    this.forgeLoading = true;
    if (this.activeTab === 'forge') {
      const main = document.getElementById('app-main-viewport');
      if (main) this.renderForgeView(main);
    }
    try {
      const results = await searchModrinthAddons({
        query: this.forgeQuery,
        category: this.forgeCategory,
        limit: 14
      });
      this.forgeItems = results;
    } catch (_) {
      this.forgeItems = [
        { slug: 'viaversion', title: 'ViaVersion', author: 'ViaVersion Team', description: 'Allows newer client versions to connect to older servers.', downloads: 24800000, iconUrl: 'https://cdn.modrinth.com/data/P1OZGk5p/icon.png', projectType: 'plugin', versions: ['1.21.4'] },
        { slug: 'essentialsx', title: 'EssentialsX', author: 'EssentialsX', description: 'Essential server commands, economy, warps, and teleportation.', downloads: 18200000, iconUrl: 'https://cdn.modrinth.com/data/hXiIvTyT/icon.png', projectType: 'plugin', versions: ['1.21.4'] },
        { slug: 'spark', title: 'spark', author: 'lucko', description: 'Performance profiler for Minecraft clients, servers, and proxies.', downloads: 14900000, iconUrl: 'https://cdn.modrinth.com/data/l6YH9Als/icon.png', projectType: 'plugin', versions: ['1.21.4'] },
        { slug: 'lithium', title: 'Lithium', author: 'jellysquid3', description: 'No-compromises game logic/server optimization mod.', downloads: 42100000, iconUrl: 'https://cdn.modrinth.com/data/gvQqBUqZ/icon.png', projectType: 'mod', versions: ['1.21.4'] },
        { slug: 'worldedit', title: 'WorldEdit', author: 'EngineHub', description: 'In-game map editor and terrain sculptor for Minecraft.', downloads: 31000000, iconUrl: 'https://cdn.modrinth.com/data/1u6JkXh5/icon.png', projectType: 'plugin', versions: ['1.21.4'] }
      ];
    } finally {
      this.forgeLoading = false;
      if (this.activeTab === 'forge') {
        const main = document.getElementById('app-main-viewport');
        if (main) this.renderForgeView(main);
      }
    }
  }

  renderForgeView(container) {
    const srv = store.getActiveServer();
    if (!srv) return;

    container.innerHTML = `
      <div class="flex flex-col w-full gap-3 pb-8">
        <!-- Dynamic Forge Telemetry Pulse Strip -->
        <div class="stagger-1 flex items-center justify-between px-3 py-1.5 bg-deck-card border border-deck-border rounded-lg font-mono text-[10px]">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-mint-glow animate-ping"></span>
            <span class="text-deck-lightText uppercase">Modrinth API v2 + PaperMC API</span>
          </div>
          <span class="text-mint-glow font-bold">${srv.installedAddons.length} MODULES INSTALLED</span>
        </div>

        <!-- Server Engine & PaperMC Version Switcher Card -->
        <div class="stagger-1 bg-deck-card border border-deck-border p-3.5 rounded-xl relative overflow-hidden">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-lg bg-mint-deep border border-mint-glow/30 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-mint-glow text-[24px]">dns</span>
              </div>
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-base text-white truncate">${srv.software}</span>
                  <span class="px-1.5 py-0.5 rounded bg-mint-deep text-mint-glow font-mono text-[9px] font-bold">BUILD #${srv.buildNumber || 168}</span>
                </div>
                <p class="font-mono text-xs text-deck-lightText truncate">Minecraft v${srv.version} • server.jar</p>
              </div>
            </div>
            <button type="button" id="btn-toggle-engine-switcher" class="tactile-btn flex items-center gap-1 px-3 py-1.5 rounded-lg bg-deck-darker border border-mint-glow/40 text-mint-glow font-mono text-xs font-bold shrink-0">
              <span>Switch Jar</span>
              <span class="material-symbols-outlined text-[16px]">unfold_more</span>
            </button>
          </div>

          <!-- Collapsible Engine & Version Switcher -->
          <div class="${this.engineSelectorOpen ? 'flex' : 'hidden'} flex-col gap-2.5 mt-3 pt-3 border-t border-deck-border">
            <span class="font-mono text-[10px] text-deck-dimText uppercase">1. Seleziona Server Engine</span>
            <div class="grid grid-cols-5 gap-1.5">
              ${['PaperMC', 'Purpur', 'Fabric', 'NeoForge', 'Velocity'].map(eng => `
                <button type="button" data-switch-software="${eng}" class="tactile-btn py-1.5 rounded-lg font-mono text-[10px] font-bold border ${
                  srv.software === eng ? 'bg-mint-glow text-deck-black border-mint-glow' : 'bg-deck-darker text-deck-lightText border-deck-border'
                }">${eng}</button>
              `).join('')}
            </div>

            <span class="font-mono text-[10px] text-deck-dimText uppercase pt-1">2. Scarica Build Ufficiale PaperMC API</span>
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              ${this.paperVersions.map(ver => `
                <button type="button" data-switch-mcver="${ver}" class="tactile-btn px-3 py-1.5 rounded-lg font-mono text-xs font-bold border shrink-0 ${
                  srv.version === ver ? 'bg-mint-deep text-mint-glow border-mint-glow/50' : 'bg-deck-darker text-deck-lightText border-deck-border'
                }">v${ver}</button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Search & Category Filter Rail -->
        <div class="stagger-2 flex flex-col gap-2">
          <form id="forge-search-form" class="flex items-center gap-2">
            <div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-deck-card border border-deck-border focus-within:border-mint-glow">
              <span class="material-symbols-outlined text-deck-dimText text-[18px]">search</span>
              <input id="forge-search-input" type="text" value="${this.forgeQuery}" placeholder="Cerca su Modrinth (es. Geyser, LuckPerms, Sodium)..." class="bg-transparent text-white placeholder:text-deck-dimText font-sans text-xs w-full focus:outline-none"/>
            </div>
            <button type="submit" class="tactile-btn px-3.5 h-9 rounded-xl bg-mint-glow text-deck-black font-mono text-xs font-bold shrink-0">
              Cerca
            </button>
          </form>

          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            ${[
              { id: 'all', label: 'Tutti', icon: 'grid_view' },
              { id: 'plugin', label: 'Plugins (Paper/Spigot)', icon: 'electrical_services' },
              { id: 'mod', label: 'Mods (Fabric/Forge)', icon: 'extension' },
              { id: 'perf', label: 'Optimization', icon: 'rocket_launch' },
              { id: 'sec', label: 'Admin & Security', icon: 'shield' }
            ].map(cat => {
              const active = this.forgeCategory === cat.id;
              return `
                <button type="button" data-forge-cat="${cat.id}" class="tactile-btn flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold shrink-0 ${
                  active ? 'bg-mint-glow text-deck-black font-bold' : 'bg-deck-card border border-deck-border text-deck-lightText hover:text-white'
                }">
                  <span class="material-symbols-outlined text-[14px]">${cat.icon}</span>
                  <span>${cat.label}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Modrinth Catalog List -->
        <div class="stagger-3 flex flex-col gap-2.5">
          ${this.forgeLoading ? `
            <div class="p-8 rounded-xl bg-deck-card border border-deck-border flex flex-col items-center justify-center gap-2 font-mono text-xs text-mint-glow">
              <span class="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
              <span>Interrogazione API Modrinth v2 in corso...</span>
            </div>
          ` : this.forgeItems.map(item => {
            const isInstalled = srv.installedAddons.includes(item.slug);
            return `
              <div class="tactile-card p-3.5 rounded-xl bg-deck-card border border-deck-border flex flex-col gap-2.5">
                <div class="flex items-start justify-between gap-3">
                  <div class="flex items-start gap-3 min-w-0">
                    <img src="${item.iconUrl}" onerror="this.src='https://mc-heads.net/avatar/MHF_Chest/64'" alt="${item.title}" class="w-11 h-11 rounded-lg bg-deck-darker border border-deck-border object-cover shrink-0"/>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-sm text-white truncate">${item.title}</span>
                        <span class="px-1.5 py-0.2 rounded bg-deck-darker text-mint-glow font-mono text-[9px] uppercase font-bold border border-deck-border">${item.projectType}</span>
                      </div>
                      <p class="text-xs text-deck-lightText line-clamp-2 mt-0.5">${item.description}</p>
                      <span class="font-mono text-[10px] text-deck-dimText mt-1">by ${item.author}</span>
                    </div>
                  </div>
                  <button type="button" data-install-slug="${item.slug}" data-install-title="${item.title}" class="tactile-btn flex items-center gap-1 px-3 py-1.5 rounded-lg font-mono text-xs font-bold shrink-0 ${
                    isInstalled
                      ? 'bg-mint-deep text-mint-glow border border-mint-glow/40'
                      : 'bg-mint-glow text-deck-black shadow-[0_0_12px_rgba(0,255,157,0.25)]'
                  }">
                    <span class="material-symbols-outlined text-[15px]">${isInstalled ? 'check' : 'download'}</span>
                    <span>${isInstalled ? 'Installato' : 'Installa'}</span>
                  </button>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-deck-border/60 font-mono text-[10px] text-deck-dimText">
                  <div class="flex items-center gap-3">
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px] text-mint-glow">download</span>${formatCompactNumber(item.downloads)}</span>
                    <span class="flex items-center gap-1"><span class="material-symbols-outlined text-[13px]">deployed_code</span>${srv.version}</span>
                  </div>
                  <span class="text-mint-glow">/plugins/${item.slug}.jar</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-toggle-engine-switcher')?.addEventListener('click', () => {
      this.engineSelectorOpen = !this.engineSelectorOpen;
      triggerNativeHaptic('TICK');
      this.renderForgeView(container);
    });

    container.querySelectorAll('[data-switch-software]').forEach(btn => {
      btn.addEventListener('click', () => {
        const eng = btn.getAttribute('data-switch-software');
        srv.software = eng;
        store.appendLog(srv, 'INFO', `Switched server runtime engine to <span class="text-mint-glow font-bold">${eng}</span>`, 'info');
        triggerNativeHaptic('SUCCESS');
        store.notify('engine-switched');
        this.showToast(`Motore server aggiornato a ${eng}`, 'ENGINE SWITCH');
      });
    });

    container.querySelectorAll('[data-switch-mcver]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ver = btn.getAttribute('data-switch-mcver');
        srv.version = ver;
        const build = await fetchPaperMcLatestBuild(ver);
        srv.buildNumber = build;
        store.appendLog(srv, 'INFO', `Downloaded official <span class="text-mint-glow">${srv.software} v${ver} (Build #${build})</span> jar`, 'info');
        triggerNativeHaptic('SUCCESS');
        store.notify('version-switched');
        this.showToast(`Scaricato ${srv.software} v${ver} (Build #${build})`, 'PAPERMC API');
      });
    });

    document.getElementById('forge-search-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('forge-search-input');
      this.forgeQuery = input ? input.value : '';
      triggerNativeHaptic('TICK');
      this.loadModrinthCatalog();
    });

    container.querySelectorAll('[data-forge-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.forgeCategory = btn.getAttribute('data-forge-cat');
        triggerNativeHaptic('TICK');
        this.loadModrinthCatalog();
      });
    });

    container.querySelectorAll('[data-install-slug]').forEach(btn => {
      btn.addEventListener('click', () => {
        const slug = btn.getAttribute('data-install-slug');
        const title = btn.getAttribute('data-install-title');
        const idx = srv.installedAddons.indexOf(slug);
        if (idx === -1) {
          srv.installedAddons.push(slug);
          const folder = srv.software === 'Fabric' || srv.software === 'NeoForge' ? 'mods' : 'plugins';
          srv.files[`/${folder}/${slug}/config.yml`] = `# ${title} Configuration\n# Installed via Anvil Forge (Modrinth API v2)\nenabled: true\nauto-update: true`;
          store.appendLog(srv, 'INFO', `Installed <span class="text-mint-glow font-bold">${title}</span> into <span class="text-white">/${folder}/${slug}.jar</span>`, 'info');
          triggerNativeHaptic('SUCCESS');
          this.showToast(`${title} installato in /${folder}/${slug}.jar!`, 'MODRINTH');
        } else {
          srv.installedAddons.splice(idx, 1);
          triggerNativeHaptic('TICK');
          this.showToast(`${title} rimosso dal server`, 'REMOVED');
        }
        store.notify('addon-toggled');
      });
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

  openServerSwitcherModal() {
    this.activeModal = 'server-switcher';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    const currentId = store.state.activeServerId;

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-deck-card border-t border-deck-border rounded-t-2xl p-4 pb-8 flex flex-col gap-3">
          <div class="w-10 h-1 bg-deck-subtle rounded-full mx-auto mb-1"></div>
          <div class="flex items-center justify-between">
            <span class="font-bold text-sm text-white uppercase font-mono tracking-wider">Seleziona Nodo Server</span>
            <button type="button" id="modal-close-btn" class="text-deck-dimText hover:text-white">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            ${store.state.servers.map(s => {
              const active = s.id === currentId;
              const isOnline = s.status === 'online';
              return `
                <button type="button" data-select-srv="${s.id}" class="tactile-btn w-full p-3 rounded-xl border text-left flex items-center justify-between ${
                  active ? 'bg-mint-deep/50 border-mint-glow/60' : 'bg-deck-darker border-deck-border'
                }">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 rounded-lg bg-deck-card border border-deck-border flex items-center justify-center text-mint-glow shrink-0">
                      <span class="material-symbols-outlined text-[20px]">dns</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-sm text-white truncate">${s.name}</span>
                        <span class="w-2 h-2 rounded-full ${isOnline ? 'bg-mint-glow' : 'bg-rose-500'}"></span>
                      </div>
                      <span class="font-mono text-[10px] text-deck-lightText truncate">${s.address}:${s.port} • ${s.software} ${s.version}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end font-mono text-[10px] shrink-0">
                    <span class="text-mint-glow font-bold">${s.tps.toFixed(1)} TPS</span>
                    <span class="text-deck-dimText">${s.players.filter(p => p.online && !p.banned).length}/${s.properties['max-players']} online</span>
                  </div>
                </button>
              `;
            }).join('')}
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" id="sheet-open-scanner" class="tactile-btn py-2.5 rounded-xl bg-deck-darker border border-amber-500/40 text-amber-300 font-mono text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">travel_explore</span>
              <span>Ping Server Reale</span>
            </button>
            <button type="button" id="sheet-open-wizard" class="tactile-btn py-2.5 rounded-xl bg-mint-glow text-deck-black font-mono text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">add_circle</span>
              <span>+ Crea / RCON</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });
    host.querySelectorAll('[data-select-srv]').forEach(btn => {
      btn.addEventListener('click', () => {
        store.setActiveServer(btn.getAttribute('data-select-srv'));
        this.closeModal();
      });
    });
    document.getElementById('sheet-open-scanner')?.addEventListener('click', () => this.openPublicScannerModal());
    document.getElementById('sheet-open-wizard')?.addEventListener('click', () => this.openAddServerWizardModal());
  }

  openPlayerActionSheet(username) {
    const srv = store.getActiveServer();
    const player = srv?.players.find(p => p.username === username);
    if (!player) return;

    this.activeModal = 'player-sheet';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-deck-card border-t border-deck-border rounded-t-2xl p-4 pb-8 flex flex-col gap-3">
          <div class="w-10 h-1 bg-deck-subtle rounded-full mx-auto mb-1"></div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="${getPlayerIsoHeadUrl(player.username, 64)}" onerror="this.src='${getPlayerAvatarUrl(player.username, 64)}'" class="w-11 h-11 rounded-lg bg-deck-darker p-1 border border-deck-border"/>
              <div class="flex flex-col">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-base text-white">${player.username}</span>
                  ${player.op ? '<span class="px-1.5 py-0.2 bg-mint-deep text-mint-glow rounded font-mono text-[9px] font-bold">OP</span>' : ''}
                </div>
                <span class="font-mono text-[10px] text-deck-lightText">IP: ${player.ip} • XYZ: ${player.coords}</span>
              </div>
            </div>
            <button type="button" id="modal-close-btn" class="text-deck-dimText hover:text-white">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="font-mono text-[10px] text-deck-dimText uppercase">Cambia Gamemode</span>
            <div class="grid grid-cols-4 gap-1.5">
              ${['SURVIVAL', 'CREATIVE', 'SPECTATOR', 'ADVENTURE'].map(gm => `
                <button type="button" data-sheet-gm="${gm}" class="tactile-btn py-2 rounded-lg font-mono text-[10px] font-bold border ${
                  player.gamemode === gm ? 'bg-mint-glow text-deck-black border-mint-glow' : 'bg-deck-darker text-deck-lightText border-deck-border'
                }">${gm}</button>
              `).join('')}
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-1">
            <button type="button" data-sheet-act="op" class="tactile-btn py-2.5 rounded-xl bg-deck-darker border border-deck-border text-mint-glow font-mono text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">shield_person</span>
              <span>${player.op ? 'Rimuovi OP' : 'Rendi Operatore (OP)'}</span>
            </button>
            <button type="button" data-sheet-act="tp" class="tactile-btn py-2.5 rounded-xl bg-deck-darker border border-deck-border text-white font-mono text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">near_me</span>
              <span>Teletrasporta Spawn</span>
            </button>
            <button type="button" data-sheet-act="clear" class="tactile-btn py-2.5 rounded-xl bg-deck-darker border border-deck-border text-amber-300 font-mono text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">inventory_2</span>
              <span>Svuota Inventario</span>
            </button>
            <button type="button" data-sheet-act="kick" class="tactile-btn py-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold flex items-center justify-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">person_remove</span>
              <span>Kick dal Server</span>
            </button>
          </div>

          <button type="button" data-sheet-act="ban" class="tactile-btn w-full py-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-400 font-mono text-xs font-bold flex items-center justify-center gap-1.5">
            <span class="material-symbols-outlined text-[16px]">gavel</span>
            <span>${player.banned ? 'Revoca Ban Giocatore (/pardon)' : 'Ban Permanente + IP-Ban'}</span>
          </button>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });

    host.querySelectorAll('[data-sheet-gm]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gm = btn.getAttribute('data-sheet-gm');
        player.gamemode = gm;
        store.executeConsoleCommand(`/gamemode ${gm.toLowerCase()} ${player.username}`);
        this.showToast(`Gamemode di ${player.username} → ${gm}`, 'GAMEMODE');
        this.closeModal();
      });
    });

    host.querySelectorAll('[data-sheet-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-sheet-act');
        this.performPlayerAction(player, act);
        this.closeModal();
      });
    });
  }

  openPublicScannerModal() {
    this.activeModal = 'public-scanner';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    host.innerHTML = `
      <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end justify-center">
        <div class="sheet-enter w-full max-w-lg bg-deck-card border-t border-deck-border rounded-t-2xl p-4 pb-8 flex flex-col gap-3">
          <div class="w-10 h-1 bg-deck-subtle rounded-full mx-auto mb-1"></div>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-mint-glow text-[20px]">travel_explore</span>
              <span class="font-bold text-sm text-white font-mono uppercase">Live Server Status Scanner (mcsrvstat.us)</span>
            </div>
            <button type="button" id="modal-close-btn" class="text-deck-dimText hover:text-white">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            ${['mc.hypixel.net', 'play.wynncraft.com', 'us.mineplex.com', 'play.cubecraft.net'].map(preset => `
              <button type="button" data-preset-addr="${preset}" class="tactile-btn px-2.5 py-1 rounded bg-deck-darker border border-deck-border text-mint-glow font-mono text-[10px] shrink-0">${preset}</button>
            `).join('')}
          </div>

          <form id="scanner-form" class="flex items-center gap-2">
            <input id="scanner-addr-input" type="text" value="mc.hypixel.net" placeholder="Inserisci IP o dominio (es. mc.hypixel.net)..." class="flex-1 bg-deck-black border border-deck-border text-white font-mono text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-mint-glow"/>
            <button type="submit" class="tactile-btn px-4 py-2.5 rounded-xl bg-mint-glow text-deck-black font-mono text-xs font-bold shrink-0">
              Interroga
            </button>
          </form>

          <div id="scanner-result-box" class="p-3 rounded-xl bg-deck-black border border-deck-border font-mono text-xs text-deck-lightText">
            Premi "Interroga" per interrogare in tempo reale qualsiasi server Minecraft pubblico tramite <code>api.mcsrvstat.us/3/</code>.
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') this.closeModal();
    });

    const input = document.getElementById('scanner-addr-input');
    const resultBox = document.getElementById('scanner-result-box');

    const runQuery = async (addr) => {
      if (!resultBox) return;
      resultBox.innerHTML = `<div class="flex items-center gap-2 text-mint-glow"><span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span><span>Connessione a ${addr}...</span></div>`;
      try {
        const info = await fetchRealServerStatus(addr);
        resultBox.innerHTML = `
          <div class="flex flex-col gap-2.5">
            <div class="flex items-center gap-3">
              ${info.icon ? `<img src="${info.icon}" class="w-11 h-11 rounded-lg border border-deck-border"/>` : `<div class="w-11 h-11 rounded-lg bg-mint-deep flex items-center justify-center text-mint-glow"><span class="material-symbols-outlined">dns</span></div>`}
              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center justify-between">
                  <span class="font-bold text-white text-sm truncate">${info.address}</span>
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold ${info.online ? 'bg-mint-deep text-mint-glow' : 'bg-rose-950 text-rose-400'}">${info.online ? 'ONLINE' : 'OFFLINE'}</span>
                </div>
                <span class="text-[10px] text-deck-dimText">IP: ${info.ip}:${info.port} • Ping API: ${info.latencyMs}ms</span>
                <span class="text-[11px] text-mint-glow font-bold mt-0.5">Giocatori: ${info.playersOnline.toLocaleString()} / ${info.playersMax.toLocaleString()}</span>
              </div>
            </div>
            <div class="p-2 rounded bg-deck-card border border-deck-border text-[11px]">
              ${parseMinecraftFormattedText(info.motdRaw || info.motdClean)}
            </div>
            <button type="button" id="btn-import-scanned" class="tactile-btn w-full py-2 rounded-lg bg-mint-glow text-deck-black font-bold text-xs">
              + Importa nell'Anvil Hub
            </button>
          </div>
        `;
        document.getElementById('btn-import-scanned')?.addEventListener('click', () => {
          store.addServer({
            name: info.address,
            address: info.address,
            port: info.port,
            connectionType: 'public',
            software: info.software,
            version: info.version
          });
          this.closeModal();
          this.showToast(`Server ${info.address} aggiunto alla Dashboard!`, 'IMPORTED');
        });
      } catch (e) {
        resultBox.innerHTML = `<div class="text-rose-400">Errore durante il ping: ${e.message}</div>`;
      }
    };

    host.querySelectorAll('[data-preset-addr]').forEach(btn => {
      btn.addEventListener('click', () => {
        const addr = btn.getAttribute('data-preset-addr');
        if (input) input.value = addr;
        runQuery(addr);
      });
    });

    document.getElementById('scanner-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input && input.value.trim()) runQuery(input.value.trim());
    });
  }

  openAddServerWizardModal() {
    this.activeModal = 'add-server';
    const host = document.getElementById('app-modal-host');
    if (!host) return;

    const renderWizardContent = () => {
      host.innerHTML = `
        <div id="modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center">
          <div class="sheet-enter w-full max-w-lg bg-deck-card border-t border-deck-border rounded-t-2xl p-4 pb-8 flex flex-col gap-3 max-h-[88vh] overflow-y-auto">
            <div class="w-10 h-1 bg-deck-subtle rounded-full mx-auto mb-1"></div>
            <div class="flex items-center justify-between">
              <span class="font-bold text-sm text-white font-mono uppercase">+ Aggiungi / Crea Server Minecraft</span>
              <button type="button" id="modal-close-btn" class="text-deck-dimText hover:text-white">
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <!-- Mode Selector -->
            <div class="grid grid-cols-2 p-1 bg-deck-black border border-deck-border rounded-xl">
              <button type="button" data-wiz-mode="connect" class="tactile-btn py-2 rounded-lg font-mono text-xs font-bold ${
                this.wizardMode === 'connect' ? 'bg-mint-deep text-mint-glow border border-mint-glow/40' : 'text-deck-dimText'
              }">1. Collega RCON / Panel</button>
              <button type="button" data-wiz-mode="builder" class="tactile-btn py-2 rounded-lg font-mono text-xs font-bold ${
                this.wizardMode === 'builder' ? 'bg-mint-deep text-mint-glow border border-mint-glow/40' : 'text-deck-dimText'
              }">2. Server Builder</button>
            </div>

            ${this.wizardMode === 'connect' ? `
              <form id="wiz-connect-form" class="flex flex-col gap-2.5 font-mono text-xs">
                <div>
                  <label class="text-[10px] text-deck-dimText uppercase">Nome Profilo Server</label>
                  <input name="name" required value="My Remote SMP" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-3 py-2 text-white focus:border-mint-glow focus:outline-none"/>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <div class="col-span-2">
                    <label class="text-[10px] text-deck-dimText uppercase">Host / IP / Dominio</label>
                    <input name="address" required value="192.168.1.100" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-3 py-2 text-white focus:border-mint-glow focus:outline-none"/>
                  </div>
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">Porta Gioco</label>
                    <input name="port" type="number" value="25565" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-3 py-2 text-mint-glow focus:border-mint-glow focus:outline-none"/>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">Protocollo</label>
                    <select name="connectionType" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-2 py-2 text-mint-glow focus:outline-none">
                      <option value="rcon">RCON TCP</option>
                      <option value="pterodactyl">Pterodactyl</option>
                      <option value="simulated">Sandbox Demo</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">Porta RCON</label>
                    <input name="rconPort" type="number" value="25575" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-3 py-2 text-white focus:outline-none"/>
                  </div>
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">RCON Password</label>
                    <input name="rconPassword" type="password" placeholder="••••••" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-3 py-2 text-white focus:outline-none"/>
                  </div>
                </div>
                <button type="submit" class="tactile-btn mt-2 w-full py-3 rounded-xl bg-mint-glow text-deck-black font-bold text-xs shadow-[0_0_16px_rgba(0,255,157,0.35)]">
                  Connetti e Salva nell'Anvil Hub
                </button>
              </form>
            ` : `
              <form id="wiz-builder-form" class="flex flex-col gap-2.5 font-mono text-xs">
                <div>
                  <label class="text-[10px] text-deck-dimText uppercase">Nome Nuovo Server</label>
                  <input name="name" required value="Anvil Custom Realm" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-3 py-2 text-white focus:border-mint-glow focus:outline-none"/>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">Edizione</label>
                    <select name="edition" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-2.5 py-2 text-mint-glow focus:outline-none">
                      <option value="Java">Java Edition (+Geyser)</option>
                      <option value="Bedrock">Bedrock Dedicated</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">Server Software</label>
                    <select name="software" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-2.5 py-2 text-white focus:outline-none">
                      <option value="PaperMC">PaperMC (Consigliato)</option>
                      <option value="Purpur">Purpur</option>
                      <option value="Fabric">Fabric Modded</option>
                      <option value="NeoForge">NeoForge</option>
                      <option value="Vanilla">Vanilla Mojang</option>
                      <option value="Velocity">Velocity Proxy</option>
                    </select>
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">Versione Minecraft</label>
                    <select name="version" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-2.5 py-2 text-mint-glow focus:outline-none">
                      <option value="1.21.4">1.21.4 (Latest)</option>
                      <option value="1.20.4">1.20.4 (LTS)</option>
                      <option value="1.19.4">1.19.4</option>
                      <option value="1.8.9">1.8.9 (PvP Legacy)</option>
                    </select>
                  </div>
                  <div>
                    <label class="text-[10px] text-deck-dimText uppercase">RAM Allocata (GB)</label>
                    <select name="ramMaxGb" class="w-full mt-1 bg-deck-black border border-deck-border rounded-lg px-2.5 py-2 text-white focus:outline-none">
                      <option value="4">4.0 GB RAM</option>
                      <option value="8" selected>8.0 GB RAM</option>
                      <option value="12">12.0 GB RAM</option>
                      <option value="16">16.0 GB RAM</option>
                    </select>
                  </div>
                </div>
                <button type="submit" class="tactile-btn mt-2 w-full py-3 rounded-xl bg-mint-glow text-deck-black font-bold text-xs shadow-[0_0_16px_rgba(0,255,157,0.35)]">
                  Genera Istanza Server & Avvia
                </button>
              </form>
            `}
          </div>
        </div>
      `;

      document.getElementById('modal-close-btn')?.addEventListener('click', () => this.closeModal());
      document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
        if (e.target.id === 'modal-backdrop') this.closeModal();
      });

      host.querySelectorAll('[data-wiz-mode]').forEach(btn => {
        btn.addEventListener('click', () => {
          this.wizardMode = btn.getAttribute('data-wiz-mode');
          triggerNativeHaptic('TICK');
          renderWizardContent();
        });
      });

      document.getElementById('wiz-connect-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const created = store.addServer({
          name: fd.get('name'),
          address: fd.get('address'),
          port: fd.get('port'),
          connectionType: fd.get('connectionType'),
          rconPort: fd.get('rconPort'),
          rconPassword: fd.get('rconPassword')
        });
        this.closeModal();
        this.showToast(`Server ${created.name} collegato!`, 'RCON READY');
      });

      document.getElementById('wiz-builder-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const created = store.addServer({
          name: fd.get('name'),
          address: 'node-' + Math.floor(10 + Math.random() * 89) + '.anvilmc.gg',
          port: 25565,
          edition: fd.get('edition'),
          software: fd.get('software'),
          version: fd.get('version'),
          ramMaxGb: fd.get('ramMaxGb'),
          connectionType: 'simulated'
        });
        this.closeModal();
        this.showToast(`Creato ${created.name} (${created.software} ${created.version})!`, 'SERVER BUILT');
      });
    };

    renderWizardContent();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new AnvilApplication();
});
