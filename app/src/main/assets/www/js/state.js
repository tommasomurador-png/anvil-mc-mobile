/**
 * Anvil-MC v2.0.7 — Core State, Persistence, Boot Sequence Engine & File System
 */

const STORAGE_KEY = 'anvil_mc_v207_state';

export const MC_COLOR_MAP = {
  '0': '#000000',
  '1': '#0000AA',
  '2': '#00AA00',
  '3': '#00AAAA',
  '4': '#AA0000',
  '5': '#AA00AA',
  '6': '#FFAA00',
  '7': '#AAAAAA',
  '8': '#555555',
  '9': '#5555FF',
  'a': '#22C55E',
  'b': '#55FFFF',
  'c': '#EF4444',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF'
};

export function parseMinecraftText(rawText = '') {
  if (!rawText) return '';
  const escaped = String(rawText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let color = '#F8FAFC';
  let bold = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;
  let obfuscated = false;

  const parts = escaped.split(/(§[0-9a-fk-or])/gi);
  let html = '';

  for (const part of parts) {
    if (/^§[0-9a-fk-or]$/i.test(part)) {
      const code = part[1].toLowerCase();
      if (MC_COLOR_MAP[code]) {
        color = MC_COLOR_MAP[code];
        bold = false;
        italic = false;
        underline = false;
        strikethrough = false;
        obfuscated = false;
      } else if (code === 'l') bold = true;
      else if (code === 'o') italic = true;
      else if (code === 'n') underline = true;
      else if (code === 'm') strikethrough = true;
      else if (code === 'k') obfuscated = true;
      else if (code === 'r') {
        color = '#F8FAFC';
        bold = false;
        italic = false;
        underline = false;
        strikethrough = false;
        obfuscated = false;
      }
    } else if (part.length > 0) {
      const styles = [`color:${color}`];
      if (bold) styles.push('font-weight:700');
      if (italic) styles.push('font-style:italic');
      const dec = [];
      if (underline) dec.push('underline');
      if (strikethrough) dec.push('line-through');
      if (dec.length) styles.push(`text-decoration:${dec.join(' ')}`);
      const cls = obfuscated ? ' class="mc-obf"' : '';
      html += `<span${cls} style="${styles.join(';')}">${part}</span>`;
    }
  }
  return html;
}

export function formatDuration(seconds = 0) {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = String(Math.floor(s / 3600)).padStart(2, '0');
  const mins = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const secs = String(s % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}

export function triggerHaptic(type = 'TICK') {
  try {
    if (window.AnvilNative && typeof window.AnvilNative.vibrate === 'function') {
      window.AnvilNative.vibrate(type);
    } else if (window.AnvilNative && typeof window.AnvilNative.triggerHaptic === 'function') {
      window.AnvilNative.triggerHaptic(type);
    } else if (navigator.vibrate) {
      if (type === 'START' || type === 'STOP' || type === 'HEAVY_CLICK') navigator.vibrate(40);
      else if (type === 'DELETE' || type === 'ERROR') navigator.vibrate([50, 30, 80]);
      else if (type === 'HOLD_PULSE') navigator.vibrate(18);
      else navigator.vibrate(10);
    }
  } catch (_) {}
}

export function getDeviceLocalIp() {
  try {
    if (window.AnvilNative && typeof window.AnvilNative.getDeviceIpAddress === 'function') {
      return window.AnvilNative.getDeviceIpAddress();
    }
  } catch (_) {}
  return '10.209.160.27:25565';
}

export function getDeviceFreeRamMb() {
  try {
    if (window.AnvilNative && typeof window.AnvilNative.getAvailableRamMb === 'function') {
      return Number(window.AnvilNative.getAvailableRamMb()) || 3420;
    }
  } catch (_) {}
  return 3420;
}

export function createDefaultHubCreativoServer() {
  const localIp = getDeviceLocalIp();
  return {
    id: 'srv-hub-creativo',
    name: 'Hub Creativo',
    iconEmoji: '🏰',
    software: 'Fabric',
    version: '26.3',
    javaVersion: 'Java 25',
    javaFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    status: 'online', // 'online' | 'stopping' | 'offline' | 'starting'
    uptimeSeconds: 260, // 00:04:20
    localIp: localIp,
    publicDomain: null,
    tunnelHoursLeft: 0,
    maxPlayers: 20,
    cpuPercent: 7,
    tps: '20,0',
    ramMb: 529,
    allocatedRamGb: 2.0,
    performanceMode: true,
    optimizeForPhone: true,
    viewDistance: 6,
    simulationDistance: 5,
    motd: '§aBenvenuti su Hub Creativo §7• §eAnvil-MC',
    // Impostazioni -> Gioco
    gamemode: 'Creativa', // 'Sopravvivenza' | 'Creativa' | 'Avventura' | 'Spettatore'
    difficulty: 'Normale', // 'Pacifica' | 'Facile' | 'Normale' | 'Difficile'
    hardcore: false,
    preset: 'Costruire', // 'Standard' | 'Rilassato' | 'Costruire'
    keepInventory: true,
    mobGriefing: true,
    daylightCycle: true,
    weatherCycle: true,
    pvp: true,
    allowFlight: true,
    commandBlocks: true,
    spawnProtection: 16,
    idleKickMinutes: 0,
    resourcePackUrl: '',
    // Impostazioni -> Mondo
    worldType: 'Normale', // 'Normale' | 'Piatto' | 'Grandi Biomi' | 'Amplificato'
    seed: '-418294019284',
    squaremapEnabled: false,
    pregenerateChunky: false,
    // Impostazioni -> Rete
    onlineMode: true,
    skinRestorer: true,
    whitelistEnabled: false,
    port: 25565,
    geyserEnabled: false,
    voiceChatEnabled: false,
    // Impostazioni -> Backup & Automazione
    autoBackup: true,
    backupsList: [
      { id: 'bkp-1', name: 'Hub_Creativo_Auto_Oggi_19-00.zip', size: '48,2 MB', date: 'Oggi, 19:00' }
    ],
    sleepIfEmpty: true,
    sleepTimeoutMin: '15 min',
    sleepMessage: 'zZz Dorme - entra per svegliarlo',
    wakeMessage: '§aIl server si sta svegliando, attendi 10 secondi...',
    scheduledTasks: [
      { id: 'tsk-1', name: 'Salvataggio automatico mondo', cron: 'Ogni 30 min', enabled: true },
      { id: 'tsk-2', name: 'Riavvio notturno pulizia RAM', cron: 'Ogni giorno alle 04:00', enabled: false }
    ],
    // Mod & Datapack preinstallati (7 Mod + 1 Datapack)
    mods: [
      { id: 'c2me', name: 'C2ME', version: '0.3.1+alpha.26.3', size: '3,4 MB', author: 'ishland', enabled: true },
      { id: 'fabric-api', name: 'Fabric API', version: '0.119.2+26.3', size: '2,1 MB', author: 'modmuss50', enabled: true },
      { id: 'ferritecore', name: 'FerriteCore', version: '7.1.0-fabric', size: '142 kB', author: 'malte0811', enabled: true },
      { id: 'krypton', name: 'Krypton', version: '0.2.8', size: '218 kB', author: 'astei', enabled: true },
      { id: 'lithium', name: 'Lithium', version: '0.14.7+mc26.3', size: '684 kB', author: 'jellysquid3', enabled: true },
      { id: 'servercore', name: 'ServerCore', version: '1.5.8+26.3', size: '412 kB', author: 'Wesley1808', enabled: true },
      { id: 'skinrestorer', name: 'Skin Restorer', version: '2.2.0+26.3', size: '510 kB', author: 'Suiranoil', enabled: true }
    ],
    datapacks: [
      { id: 'anvil-welcome', name: 'AnvilWelcome.zip', version: 'v2.0.7', size: '24 kB', enabled: true }
    ],
    // Giocatori (0 online, 1 in Tutti/Admin)
    players: [
      { username: 'Tommaso_Admin', online: false, whitelisted: false, admin: true, banned: false, lastSeen: '12 min fa' }
    ],
    // File Manager Virtual Tree
    fsItems: [
      { name: '.fabric', type: 'folder', sizeBytes: 4299161, modified: 'Oggi, 19:32', timestamp: 1760981520 },
      { name: 'config', type: 'folder', sizeBytes: 184320, modified: 'Oggi, 19:34', timestamp: 1760981640 },
      { name: 'libraries', type: 'folder', sizeBytes: 68157440, modified: 'Ieri, 21:10', timestamp: 1760895000 },
      { name: 'logs', type: 'folder', sizeBytes: 524288, modified: 'Oggi, 19:36', timestamp: 1760981760 },
      { name: 'mods', type: 'folder', sizeBytes: 7864320, modified: 'Oggi, 19:35', timestamp: 1760981700 },
      { name: 'tmp', type: 'folder', sizeBytes: 16384, modified: 'Oggi, 19:30', timestamp: 1760981400 },
      { name: 'versions', type: 'folder', sizeBytes: 54525952, modified: 'Ieri, 21:10', timestamp: 1760895000 },
      { name: 'world', type: 'folder', sizeBytes: 50541363, modified: 'Oggi, 19:36', timestamp: 1760981780 },
      {
        name: 'eula.txt',
        type: 'file',
        sizeBytes: 182,
        modified: 'Ieri, 21:12',
        timestamp: 1760895120,
        content: '#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://aka.ms/MinecraftEULA).\n#Generated by Anvil-MC v2.0.7\neula=true\n'
      },
      {
        name: 'server.properties',
        type: 'file',
        sizeBytes: 1420,
        modified: 'Oggi, 19:35',
        timestamp: 1760981710,
        content: '#Minecraft server properties\n#Anvil-MC v2.0.7 Android Host\nmotd=§aBenvenuti su Hub Creativo §7• §eAnvil-MC\ngamemode=creative\ndifficulty=normal\nmax-players=20\nserver-port=25565\nview-distance=6\nsimulation-distance=5\nonline-mode=true\npvp=true\nallow-flight=true\nenable-command-block=true\nspawn-protection=16\nwhite-list=false\n'
      },
      {
        name: 'ops.json',
        type: 'file',
        sizeBytes: 256,
        modified: 'Oggi, 19:10',
        timestamp: 1760980200,
        content: '[\n  {\n    "uuid": "8667ba71-b85a-4004-af54-457a9734eed7",\n    "name": "Tommaso_Admin",\n    "level": 4,\n    "bypassesPlayerLimit": true\n  }\n]\n'
      },
      {
        name: 'whitelist.json',
        type: 'file',
        sizeBytes: 4,
        modified: 'Ieri, 21:12',
        timestamp: 1760895120,
        content: '[]\n'
      },
      {
        name: 'banned-players.json',
        type: 'file',
        sizeBytes: 4,
        modified: 'Ieri, 21:12',
        timestamp: 1760895120,
        content: '[]\n'
      }
    ],
    // Console Logs
    logs: [
      { id: 1, time: '19:36:38', level: 'INFO', text: 'Starting Anvil-MC ARM64 JVM Container (Java 25)...' },
      { id: 2, time: '19:36:39', level: 'INFO', text: 'Loading Minecraft 26.3 with Fabric Loader 0.16.10' },
      { id: 3, time: '19:36:40', level: 'INFO', text: 'Loading 7 mods: c2me, fabric-api, ferritecore, krypton, lithium, servercore, skinrestorer' },
      { id: 4, time: '19:36:41', level: 'WARN', text: '[Krypton] Native ARM64 socket compression enabled on local interface' },
      { id: 5, time: '19:36:42', level: 'INFO', text: 'Preparing level "world" (Seed: -418294019284)' },
      { id: 6, time: '19:36:43', level: 'INFO', text: 'Done (4.821s)! For help, type "help" — Bound to 10.209.160.27:25565' }
    ]
  };
}

class AnvilStoreV207 {
  constructor() {
    this.state = this.loadState();
    this.listeners = new Set();
    this.bootInterval = null;
    this.startLiveTicker();
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.servers)) {
          return parsed;
        }
      }
    } catch (_) {}

    const defaultSrv = createDefaultHubCreativoServer();
    return {
      version: '2.0.7',
      tunnelRegion: 'EU', // 'EU' | 'US' | 'SG' | 'Locale'
      isPremium: false,
      userEmail: 'tommaso.murador@gmail.com',
      language: 'Italiano',
      theme: 'Scuro (Carbone)',
      activeServerId: defaultSrv.id,
      servers: [defaultSrv]
    };
  }

  saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (_) {}
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event = 'update', payload = null) {
    this.saveState();
    for (const fn of this.listeners) {
      fn(this.state, event, payload);
    }
  }

  getActiveServer() {
    if (!this.state.servers.length) return null;
    return this.state.servers.find(s => s.id === this.state.activeServerId) || this.state.servers[0];
  }

  appendLog(srv, level, text) {
    if (!srv) return;
    const now = new Date();
    const time = now.toTimeString().split(' ')[0];
    srv.logs.push({
      id: Date.now() + Math.random(),
      time,
      level,
      text
    });
    if (srv.logs.length > 200) srv.logs.shift();
  }

  /**
   * Stop sequence: ONLINE -> ARRESTO... (2s) -> OFFLINE
   */
  stopServer(serverId) {
    const srv = this.state.servers.find(s => s.id === serverId) || this.getActiveServer();
    if (!srv || srv.status === 'offline' || srv.status === 'stopping') return;

    if (this.bootInterval) {
      clearInterval(this.bootInterval);
      this.bootInterval = null;
    }

    triggerHaptic('STOP');
    srv.status = 'stopping';
    this.appendLog(srv, 'INFO', 'Stopping the server... Saving chunks for level "world"...');
    this.notify('status-change');

    setTimeout(() => {
      srv.status = 'offline';
      srv.uptimeSeconds = 0;
      srv.cpuPercent = 0;
      srv.tps = '-';
      srv.ramMb = 0;
      this.appendLog(srv, 'INFO', 'ThreadedAnvilChunkStorage: All dimensions are saved. Server stopped.');
      triggerHaptic('TICK');
      this.notify('status-change');
    }, 2000);
  }

  /**
   * Realistic 8-second Boot Sequence:
   * OFFLINE -> AVVIO SERVER... (timer 00:00:00++, CPU 100%, TPS '-', RAM 72MB -> 559MB) -> ONLINE (LOCALE) + Friends Modal
   */
  startServer(serverId) {
    const srv = this.state.servers.find(s => s.id === serverId) || this.getActiveServer();
    if (!srv || srv.status === 'online' || srv.status === 'starting') return;

    if (this.bootInterval) {
      clearInterval(this.bootInterval);
    }

    triggerHaptic('START');
    srv.status = 'starting';
    srv.uptimeSeconds = 0;
    srv.cpuPercent = 100;
    srv.tps = '-';
    srv.ramMb = 72;
    this.appendLog(srv, 'INFO', `Bootstrapping ${srv.software} ${srv.version} (${srv.javaVersion})...`);
    this.notify('status-change');

    const bootSteps = [
      { sec: 1, ram: 138, level: 'INFO', msg: `Loading Minecraft ${srv.version} with ${srv.software} Loader...` },
      { sec: 2, ram: 215, level: 'INFO', msg: `Initializing ${srv.mods.length} mods: C2ME, Fabric API, FerriteCore, Krypton, Lithium...` },
      { sec: 3, ram: 294, level: 'WARN', msg: '[FerriteCore] Compacting blockstate memory tables for Android ARM64' },
      { sec: 4, ram: 368, level: 'INFO', msg: `Starting Minecraft server on ${srv.localIp}` },
      { sec: 5, ram: 432, level: 'INFO', msg: `Preparing level "world" (${srv.worldType}, Seed: ${srv.seed})...` },
      { sec: 6, ram: 495, level: 'INFO', msg: 'Preparing start region for dimension minecraft:overworld (48%)' },
      { sec: 7, ram: 542, level: 'INFO', msg: 'Preparing start region for dimension minecraft:overworld (94%)' },
      { sec: 8, ram: 559, level: 'INFO', msg: 'Done (8.12s)! For help, type "help"' }
    ];

    let stepIdx = 0;
    this.bootInterval = setInterval(() => {
      if (srv.status !== 'starting') {
        clearInterval(this.bootInterval);
        this.bootInterval = null;
        return;
      }

      srv.uptimeSeconds += 1;
      srv.cpuPercent = 100;

      if (stepIdx < bootSteps.length) {
        const st = bootSteps[stepIdx];
        srv.ramMb = st.ram;
        this.appendLog(srv, st.level, st.msg);
        stepIdx++;
      }

      if (stepIdx >= bootSteps.length) {
        clearInterval(this.bootInterval);
        this.bootInterval = null;
        srv.status = 'online';
        srv.cpuPercent = 8;
        srv.tps = '20,0';
        srv.ramMb = 559;
        triggerHaptic('SUCCESS');
        this.notify('boot-completed', { serverId: srv.id });
      } else {
        this.notify('boot-tick');
      }
    }, 1000);
  }

  deleteServer(serverId) {
    const idx = this.state.servers.findIndex(s => s.id === serverId);
    if (idx !== -1) {
      this.state.servers.splice(idx, 1);
      this.state.activeServerId = this.state.servers[0]?.id || null;
      triggerHaptic('DELETE');
      this.notify('server-deleted');
    }
  }

  createServerFromWizard(wiz) {
    const id = 'srv-' + Date.now();
    const localIp = getDeviceLocalIp();
    const newSrv = createDefaultHubCreativoServer();
    newSrv.id = id;
    newSrv.name = wiz.name || 'Mondo Sopravvivenza';
    newSrv.motd = wiz.motd || `§a${newSrv.name} §7• §eAnvil-MC`;
    newSrv.software = wiz.software || 'Fabric ottimizzato';
    newSrv.version = wiz.version || '26.3';
    newSrv.allocatedRamGb = Number(wiz.ramGb) || 2.0;
    newSrv.performanceMode = Boolean(wiz.performanceMode);
    newSrv.gamemode = wiz.gamemode || 'Sopravvivenza';
    newSrv.difficulty = wiz.difficulty || 'Normale';
    newSrv.worldType = wiz.worldType || 'Normale';
    newSrv.seed = wiz.seed || String(Math.floor(100000000 + Math.random() * 900000000));
    newSrv.onlineMode = Boolean(wiz.onlineMode);
    newSrv.skinRestorer = Boolean(wiz.skinRestorer);
    newSrv.whitelistEnabled = Boolean(wiz.whitelistEnabled);
    newSrv.sleepIfEmpty = Boolean(wiz.sleepIfEmpty);
    newSrv.geyserEnabled = Boolean(wiz.geyserEnabled);
    newSrv.voiceChatEnabled = Boolean(wiz.voiceChatEnabled);
    newSrv.squaremapEnabled = Boolean(wiz.squaremapEnabled);
    newSrv.pregenerateChunky = Boolean(wiz.pregenerateChunky);
    newSrv.localIp = localIp;
    newSrv.status = 'offline';
    newSrv.uptimeSeconds = 0;

    if (wiz.tunnelRegion && wiz.tunnelRegion !== 'Locale') {
      this.state.tunnelRegion = wiz.tunnelRegion;
    }

    this.state.servers.unshift(newSrv);
    this.state.activeServerId = id;
    this.saveState();
    this.startServer(id);
    return newSrv;
  }

  executeConsoleCommand(rawCmd) {
    const srv = this.getActiveServer();
    if (!srv || !rawCmd.trim()) return;
    const cmd = rawCmd.trim();
    triggerHaptic('TICK');

    this.appendLog(srv, 'INFO', `> ${cmd}`);
    const clean = cmd.startsWith('/') ? cmd.slice(1).trim() : cmd;
    const parts = clean.split(/\s+/);
    const root = (parts[0] || '').toLowerCase();

    if (root === 'stop') {
      this.stopServer(srv.id);
      return;
    } else if (root === 'help' || root === '?') {
      this.appendLog(srv, 'INFO', 'Comandi disponibili: /stop, /help, /list, /op, /kick, /ban, /say, /time day, /time night, /weather clear, /tp');
    } else if (root === 'list') {
      const online = srv.players.filter(p => p.online && !p.banned);
      this.appendLog(srv, 'INFO', `Ci sono ${online.length} su un massimo di ${srv.maxPlayers} giocatori online: ${online.map(p => p.username).join(', ') || 'Nessuno'}`);
    } else if (root === 'say') {
      const msg = parts.slice(1).join(' ') || 'Messaggio dal server!';
      this.appendLog(srv, 'INFO', `[Server] ${msg}`);
    } else if (root === 'time') {
      const sub = parts[1] === 'set' ? parts[2] : parts[1];
      this.appendLog(srv, 'INFO', `Orario del mondo impostato a ${sub || 'day'} (1000 tick)`);
    } else if (root === 'weather') {
      this.appendLog(srv, 'INFO', `Meteo cambiato in ${parts[1] || 'clear'}`);
    } else if (root === 'op' && parts[1]) {
      const p = srv.players.find(x => x.username.toLowerCase() === parts[1].toLowerCase());
      if (p) p.admin = true;
      else srv.players.push({ username: parts[1], online: false, whitelisted: true, admin: true, banned: false, lastSeen: 'Adesso' });
      this.appendLog(srv, 'INFO', `Reso ${parts[1]} operatore del server`);
    } else if (root === 'kick' && parts[1]) {
      this.appendLog(srv, 'WARN', `Espulso ${parts[1]} dal server`);
    } else if (root === 'ban' && parts[1]) {
      const p = srv.players.find(x => x.username.toLowerCase() === parts[1].toLowerCase());
      if (p) p.banned = true;
      else srv.players.push({ username: parts[1], online: false, whitelisted: false, admin: false, banned: true, lastSeen: 'Bannato' });
      this.appendLog(srv, 'WARN', `Bannato il giocatore ${parts[1]}`);
    } else if (root === 'tp') {
      this.appendLog(srv, 'INFO', `Teletrasporto eseguito (${parts.slice(1).join(' ') || '0 70 0'})`);
    } else {
      this.appendLog(srv, 'INFO', `Comando "/${clean}" eseguito con successo.`);
    }

    this.notify('console-updated');
  }

  startLiveTicker() {
    setInterval(() => {
      let updated = false;
      for (const srv of this.state.servers) {
        if (srv.status === 'online') {
          srv.uptimeSeconds += 1;
          // CPU oscillates dynamically between 1% and 15%
          srv.cpuPercent = Math.max(1, Math.min(15, srv.cpuPercent + Math.floor(Math.random() * 5) - 2));
          srv.tps = '20,0';
          // RAM fluctuates slightly around 529MB (or 72MB-128MB if idle)
          const jitter = Math.floor(Math.random() * 5) - 2;
          srv.ramMb = Math.max(72, Math.min(720, srv.ramMb + jitter));
          updated = true;
        }
      }
      if (updated) {
        for (const fn of this.listeners) {
          fn(this.state, 'live-tick');
        }
      }
    }, 1000);
  }
}

export const store = new AnvilStoreV207();
