/**
 * Anvil-MC Core State, Persistence & Simulated Live Server Engine
 * Preloads 2 realistic Minecraft server instances (PaperMC 1.21.4 & Fabric Modded SkyFactory)
 * and persists user modifications in localStorage / IndexedDB.
 */

const STORAGE_KEY = 'anvil_mc_state_v1';

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
  'a': '#00FF9D',
  'b': '#55FFFF',
  'c': '#FF5555',
  'd': '#FF55FF',
  'e': '#FFFF55',
  'f': '#FFFFFF'
};

export function parseMinecraftFormattedText(rawText = '') {
  if (!rawText) return '';
  const escaped = String(rawText)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  let color = '#e2e8f0';
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
        color = '#e2e8f0';
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

export function triggerNativeHaptic(style = 'TICK') {
  try {
    if (window.AnvilNative && typeof window.AnvilNative.triggerHaptic === 'function') {
      window.AnvilNative.triggerHaptic(style);
    } else if (navigator.vibrate) {
      if (style === 'HEAVY_CLICK') navigator.vibrate(40);
      else if (style === 'ERROR') navigator.vibrate([40, 30, 60]);
      else navigator.vibrate(12);
    }
  } catch (_) {}
}

const DEFAULT_SERVERS = [
  {
    id: 'srv-paper-smp',
    name: 'Survival SMP',
    address: 'play.anvilcraft.gg',
    port: 25565,
    rconPort: 25575,
    rconPassword: 'anvil_rcon_secret',
    connectionType: 'simulated', // 'simulated' | 'rcon' | 'pterodactyl' | 'public'
    edition: 'Java',
    software: 'PaperMC',
    version: '1.21.4',
    buildNumber: 168,
    status: 'online', // 'online' | 'starting' | 'offline' | 'crashed'
    tps: 20.0,
    mspt: 14.8,
    cpuLoad: 34.2,
    cpuCores: [38, 30],
    ramUsedGb: 6.4,
    ramMaxGb: 8.0,
    diskUsedGb: 14.2,
    diskMaxGb: 50.0,
    diskBreakdown: { world: 9.2, plugins: 3.1, backups: 1.9 },
    pingMs: 24,
    seed: '#84920412',
    worldTime: 'day', // 'dawn' | 'day' | 'dusk' | 'night'
    weather: 'clear', // 'clear' | 'rain' | 'thunder'
    difficulty: 'normal', // 'peaceful' | 'easy' | 'normal' | 'hard'
    tpsHistory: [20.0, 20.0, 19.9, 20.0, 19.8, 19.9, 20.0, 20.0, 19.95, 20.0, 20.0, 20.0],
    motdLine1: '§a>> Season 5 Launch! §6★ Nether Rework',
    motdLine2: '§7Explore boundless biomes • §b1.21.4 Protocol',
    gamerules: {
      keepInventory: true,
      doDaylightCycle: true,
      mobGriefing: false,
      pvp: true,
      doFireTick: false,
      spawnRadius: 16
    },
    properties: {
      'motd': '§a>> Season 5 Launch! §6★ Nether Rework',
      'online-mode': true,
      'pvp': true,
      'allow-flight': false,
      'hardcore': false,
      'enable-command-block': true,
      'white-list': false,
      'max-players': 50,
      'view-distance': 10,
      'simulation-distance': 8,
      'spawn-protection': 16,
      'server-port': 25565
    },
    players: [
      { username: 'AlexCraft', uuid: 'ec561538-f3fd-461d-aff5-086b22154bce', online: true, op: true, whitelisted: true, banned: false, gamemode: 'SURVIVAL', ping: 18, coords: '1420, 68, -350', world: 'overworld', ip: '192.168.1.12' },
      { username: 'Steve_The_Miner', uuid: '8667ba71-b85a-4004-af54-457a9734eed7', online: true, op: false, whitelisted: true, banned: false, gamemode: 'SURVIVAL', ping: 42, coords: '812, 12, -94', world: 'overworld', ip: '192.168.1.45' },
      { username: 'EnderMaster99', uuid: '069a79f4-44e9-4726-a5be-fca90e38aaf5', online: true, op: false, whitelisted: true, banned: false, gamemode: 'SPECTATOR', ping: 110, coords: '34, 180, 2400', world: 'the_end', ip: '84.19.44.102' },
      { username: 'RedstoneEng', uuid: '61699b2e-d327-4a01-9f1e-0ea8c3f06bc6', online: true, op: true, whitelisted: true, banned: false, gamemode: 'CREATIVE', ping: 25, coords: '-452, 70, 12', world: 'overworld', ip: '10.0.0.88' },
      { username: 'VoxelKnight', uuid: '853c80ef-3c37-49fd-aa49-938b674adae6', online: true, op: false, whitelisted: true, banned: false, gamemode: 'SURVIVAL', ping: 31, coords: '215, 64, 128', world: 'the_nether', ip: '172.16.4.19' },
      { username: 'DreamWeaver', uuid: 'f7c77d99-9f15-4a66-a87d-c4a51ef30d19', online: false, op: false, whitelisted: true, banned: false, gamemode: 'SURVIVAL', ping: 0, coords: '0, 72, 0', world: 'overworld', ip: '93.41.12.8' },
      { username: 'XrayGriefer_99', uuid: 'c06f8906-4c8a-4fd2-9c20-0277a9604520', online: false, op: false, whitelisted: false, banned: true, banReason: 'Fly Hack & X-Ray packet exploit', gamemode: 'SURVIVAL', ping: 0, coords: '120, 11, -50', world: 'overworld', ip: '45.133.1.99' }
    ],
    installedAddons: ['viaversion', 'worldedit', 'luckperms', 'geyser'],
    activeCrash: {
      id: 'crash-we-api',
      plugin: 'WorldEdit v7.3.0',
      title: 'WorldEdit API Mismatch',
      exception: 'java.lang.NullPointerException: Cannot invoke BlockState.getRawData() in WorldEdit v7.3.0',
      detail: 'WorldEdit v7.3.0 calls deprecated NMS BlockState.getRawData() removed in Paper 1.21.4.',
      fixFile: 'WorldEdit-7.3.1-SNAPSHOT.jar',
      patched: false
    },
    files: {
      '/server.properties': `#Minecraft server properties\n#Generated by Anvil-MC Studio\nmotd=§a>> Season 5 Launch! §6★ Nether Rework\nonline-mode=true\npvp=true\nallow-flight=false\nhardcore=false\nenable-command-block=true\nwhite-list=false\nmax-players=50\nview-distance=10\nsimulation-distance=8\nspawn-protection=16\nserver-port=25565\ngamemode=survival\ndifficulty=normal\nenable-rcon=true\nrcon.port=25575`,
      '/paper-global.yml': `# Paper Global Configuration\n_version: 29\nchunk-loading-advanced:\n  auto-config-send-distance: true\n  player-max-concurrent-chunk-generates: 4\nitem-validation:\n  book:\n    author: 8192\n    page: 16384\npacket-limiter:\n  all-packets:\n    action: KICK\n    interval: 7.0\n    max-packet-rate: 500.0`,
      '/spigot.yml': `# Spigot Configuration\nconfig-version: 12\nsettings:\n  debug: false\n  bungeecord: false\n  restart-on-crash: true\n  restart-script: ./start.sh\nworld-settings:\n  default:\n    merge-radius:\n      item: 2.5\n      exp: 3.0\n    mob-spawn-range: 6`,
      '/plugins/WorldEdit/config.yml': `limits:\n  max-blocks-changed:\n    default: -1\n    maximum: -1\n  max-polygonal-points:\n    default: 20\n    maximum: 50\nhistory:\n  size: 25\n  expiration: 10`,
      '/plugins/Geyser-Spigot/config.yml': `bedrock:\n  address: 0.0.0.0\n  port: 19132\n  clone-remote-port: false\n  motd1: "Anvil-MC Crossplay"\n  motd2: "Bedrock + Java Unified"\nremote:\n  address: auto\n  port: 25565\n  auth-type: floodgate`,
      '/logs/latest.log': `[14:20:01] [Server thread/INFO]: Starting minecraft server version 1.21.4\n[14:20:01] [Server thread/INFO]: Loading properties\n[14:20:02] [Server thread/INFO]: This server is running Paper version 1.21.4-R0.1-SNAPSHOT (build #168)\n[14:20:04] [Server thread/INFO]: Prepared spawn area in 1.2s\n[14:20:15] [Server thread/INFO]: AlexCraft[/192.168.1.12:51822] logged in at (1420.0, 68.0, -350.0)\n[14:21:05] [Server thread/ERROR]: [Paper-Core] java.lang.NullPointerException: Cannot invoke Plugin "WorldEdit" at com.sk89q.worldedit.bukkit.WorldEditPlugin.onEnable`
    },
    logs: [
      { id: 1, time: '14:20:01', type: 'info', badge: 'INFO', text: 'Server loaded <span class="text-mint-glow font-semibold">1,420 chunks</span> in <span class="text-emerald-300">1.2s</span> (PaperMC #168)' },
      { id: 2, time: '14:20:15', type: 'chat', badge: 'JOIN', text: 'Player <span class="text-white font-semibold">AlexCraft</span> joined the game <span class="text-slate-500">(192.168.1.12)</span>' },
      { id: 3, time: '14:20:22', type: 'chat', badge: 'CHAT', text: '<span class="text-emerald-400">&lt;Steve_The_Miner&gt;</span> anyone got extra iron ingots near spawn?' },
      { id: 4, time: '14:20:42', type: 'warn', badge: 'WARN', text: "Can't keep up! Is the server overloaded? Running 2,050ms or 41 ticks behind" },
      { id: 5, time: '14:20:58', type: 'command', badge: 'CMD', text: '<span class="text-white">AlexCraft</span> issued server command: <span class="text-mint-glow">/worldedit:wand</span>' },
      { id: 6, time: '14:21:05', type: 'error', badge: 'ERROR', text: '[Paper-Core] java.lang.NullPointerException: Cannot invoke Plugin "WorldEdit"', stack: 'at com.sk89q.worldedit.bukkit.WorldEditPlugin.onEnable(WorldEditPlugin.java:148)' }
    ]
  },
  {
    id: 'srv-fabric-skyfactory',
    name: 'Modded SkyFactory',
    address: 'sky.anvilcraft.gg',
    port: 25566,
    rconPort: 25576,
    rconPassword: 'sky_rcon_password',
    connectionType: 'simulated',
    edition: 'Java',
    software: 'Fabric',
    version: '1.20.4',
    buildNumber: 84,
    status: 'online',
    tps: 19.6,
    mspt: 28.4,
    cpuLoad: 58.0,
    cpuCores: [64, 52],
    ramUsedGb: 9.8,
    ramMaxGb: 12.0,
    diskUsedGb: 26.5,
    diskMaxGb: 64.0,
    diskBreakdown: { world: 16.4, plugins: 6.8, backups: 3.3 },
    pingMs: 31,
    seed: '#10948271',
    worldTime: 'dusk',
    weather: 'clear',
    difficulty: 'hard',
    tpsHistory: [19.8, 19.5, 19.6, 19.2, 19.7, 19.6, 19.4, 19.8, 19.6, 19.5, 19.7, 19.6],
    motdLine1: '§b⚡ Modded SkyFactory 5 §7[Fabric 1.20.4]',
    motdLine2: '§aTech Reborn • AE2 • Create • Lithium Optimized',
    gamerules: {
      keepInventory: true,
      doDaylightCycle: true,
      mobGriefing: false,
      pvp: false,
      doFireTick: false,
      spawnRadius: 4
    },
    properties: {
      'motd': '§b⚡ Modded SkyFactory 5 §7[Fabric 1.20.4]',
      'online-mode': true,
      'pvp': false,
      'allow-flight': true,
      'hardcore': false,
      'enable-command-block': true,
      'white-list': true,
      'max-players': 30,
      'view-distance': 8,
      'simulation-distance': 6,
      'spawn-protection': 0,
      'server-port': 25566
    },
    players: [
      { username: 'CreateEngineer', uuid: '61699b2e-d327-4a01-9f1e-0ea8c3f06bc6', online: true, op: true, whitelisted: true, banned: false, gamemode: 'SURVIVAL', ping: 22, coords: '0, 128, 0', world: 'void_island', ip: '192.168.1.90' },
      { username: 'FluxCrafter', uuid: '853c80ef-3c37-49fd-aa49-938b674adae6', online: true, op: false, whitelisted: true, banned: false, gamemode: 'SURVIVAL', ping: 39, coords: '14, 128, -18', world: 'void_island', ip: '192.168.1.91' },
      { username: 'AlchemistMia', uuid: 'ec561538-f3fd-461d-aff5-086b22154bce', online: true, op: false, whitelisted: true, banned: false, gamemode: 'CREATIVE', ping: 28, coords: '-240, 90, 410', world: 'void_island', ip: '192.168.1.92' }
    ],
    installedAddons: ['lithium', 'sodium', 'spark', 'fabric-api'],
    activeCrash: {
      id: 'crash-heap-gc',
      plugin: 'AE2 Spatial Grid',
      title: 'High GC Allocation Warning',
      exception: 'java.lang.OutOfMemoryError: G1 Old Gen approaching 88% heap threshold',
      detail: 'Chunk loader cluster at (0, 128, 0) keeps 480 tile entities active.',
      fixFile: 'Aikar-G1GC-Flags.conf',
      patched: false
    },
    files: {
      '/server.properties': `#Minecraft server properties\nmotd=§b⚡ Modded SkyFactory 5 §7[Fabric 1.20.4]\nonline-mode=true\npvp=false\nallow-flight=true\nhardcore=false\nenable-command-block=true\nwhite-list=true\nmax-players=30\nview-distance=8\nsimulation-distance=6\nspawn-protection=0\nserver-port=25566`,
      '/config/lithium.properties': `# Lithium Configuration for Fabric\nmixin.ai.pathing=true\nmixin.block.hopper=true\nmixin.chunk.serialization=true\nmixin.entity.collisions=true\nmixin.world.tick_scheduler=true`,
      '/logs/latest.log': `[15:00:10] [Server thread/INFO]: Loading Minecraft 1.20.4 with Fabric Loader 0.16.9\n[15:00:12] [Server thread/INFO]: Loaded 142 mods including lithium, spark, create\n[15:02:11] [Server thread/WARN]: [Spark] GC Allocation spike detected on Void_Island`
    },
    logs: [
      { id: 1, time: '15:00:10', type: 'info', badge: 'INFO', text: 'Fabric Loader <span class="text-mint-glow">0.16.9</span> initialized with <span class="text-white font-semibold">142 mods</span>' },
      { id: 2, time: '15:01:04', type: 'chat', badge: 'CHAT', text: '<span class="text-emerald-400">&lt;CreateEngineer&gt;</span> ME Controller online at 16,384 FE/t!' },
      { id: 3, time: '15:02:11', type: 'warn', badge: 'WARN', text: '[Spark] G1GC pause 48ms — tile entity tick at (0, 128, 0)' }
    ]
  }
];

class AnvilStore {
  constructor() {
    this.state = this.loadState();
    this.listeners = new Set();
    this.startTelemetryLoop();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.servers) && parsed.servers.length > 0) {
          return parsed;
        }
      }
    } catch (_) {}
    return {
      activeServerId: DEFAULT_SERVERS[0].id,
      activeTab: 'dashboard',
      servers: JSON.parse(JSON.stringify(DEFAULT_SERVERS))
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

  notify(event = 'update') {
    this.saveState();
    for (const fn of this.listeners) {
      fn(this.state, event);
    }
  }

  getActiveServer() {
    return this.state.servers.find(s => s.id === this.state.activeServerId) || this.state.servers[0];
  }

  setActiveServer(serverId) {
    if (this.state.servers.some(s => s.id === serverId)) {
      this.state.activeServerId = serverId;
      triggerNativeHaptic('TICK');
      this.notify('server-switched');
    }
  }

  addServer(serverData) {
    const id = 'srv-' + Date.now();
    const newServer = {
      id,
      name: serverData.name || 'New Minecraft Node',
      address: serverData.address || '127.0.0.1',
      port: Number(serverData.port) || 25565,
      rconPort: Number(serverData.rconPort) || 25575,
      rconPassword: serverData.rconPassword || '',
      panelUrl: serverData.panelUrl || '',
      panelApiKey: serverData.panelApiKey || '',
      connectionType: serverData.connectionType || 'simulated',
      edition: serverData.edition || 'Java',
      software: serverData.software || 'PaperMC',
      version: serverData.version || '1.21.4',
      buildNumber: 168,
      status: 'online',
      tps: 20.0,
      mspt: 12.4,
      cpuLoad: 18.5,
      cpuCores: [20, 17],
      ramUsedGb: Number((Number(serverData.ramMaxGb || 8) * 0.42).toFixed(1)),
      ramMaxGb: Number(serverData.ramMaxGb) || 8.0,
      diskUsedGb: 4.2,
      diskMaxGb: 40.0,
      diskBreakdown: { world: 2.8, plugins: 0.9, backups: 0.5 },
      pingMs: 19,
      seed: '#' + Math.floor(10000000 + Math.random() * 89999999),
      worldTime: 'day',
      weather: 'clear',
      difficulty: 'normal',
      tpsHistory: [20.0, 20.0, 20.0, 19.9, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0, 20.0],
      motdLine1: `§a${serverData.name || 'Anvil Server'} §7• §b${serverData.version || '1.21.4'}`,
      motdLine2: `§7Powered by Anvil-MC Mobile Control Deck`,
      gamerules: {
        keepInventory: true,
        doDaylightCycle: true,
        mobGriefing: true,
        pvp: true,
        doFireTick: true,
        spawnRadius: 10
      },
      properties: {
        'motd': `§a${serverData.name || 'Anvil Server'} §7• §b${serverData.version || '1.21.4'}`,
        'online-mode': true,
        'pvp': true,
        'allow-flight': false,
        'hardcore': false,
        'enable-command-block': true,
        'white-list': false,
        'max-players': 40,
        'view-distance': 10,
        'simulation-distance': 8,
        'spawn-protection': 16,
        'server-port': Number(serverData.port) || 25565
      },
      players: [
        { username: 'Admin_Host', uuid: '8667ba71-b85a-4004-af54-457a9734eed7', online: true, op: true, whitelisted: true, banned: false, gamemode: 'CREATIVE', ping: 12, coords: '0, 80, 0', world: 'overworld', ip: '127.0.0.1' }
      ],
      installedAddons: ['spark', 'viaversion'],
      activeCrash: null,
      files: {
        '/server.properties': `#Minecraft server properties\nmotd=§a${serverData.name || 'Anvil Server'}\nonline-mode=true\npvp=true\nallow-flight=false\nmax-players=40\nview-distance=10\nsimulation-distance=8\nserver-port=${Number(serverData.port) || 25565}`,
        '/logs/latest.log': `[12:00:00] [Server thread/INFO]: Starting ${serverData.software || 'PaperMC'} server version ${serverData.version || '1.21.4'}`
      },
      logs: [
        { id: Date.now(), time: new Date().toTimeString().split(' ')[0], type: 'info', badge: 'INFO', text: `Provisioned <span class="text-mint-glow">${serverData.software || 'PaperMC'} ${serverData.version || '1.21.4'}</span> instance ready.` }
      ]
    };

    this.state.servers.push(newServer);
    this.state.activeServerId = id;
    triggerNativeHaptic('SUCCESS');
    this.notify('server-added');
    return newServer;
  }

  appendLog(server, badge, text, type = 'info', stack = null) {
    const nowStr = new Date().toTimeString().split(' ')[0];
    server.logs.push({
      id: Date.now() + Math.random(),
      time: nowStr,
      type,
      badge,
      text,
      stack
    });
    if (server.logs.length > 150) {
      server.logs.shift();
    }
    const plainText = text.replace(/<[^>]+>/g, '');
    server.files['/logs/latest.log'] = (server.files['/logs/latest.log'] || '') + `\n[${nowStr}] [Server thread/${badge}]: ${plainText}`;
  }

  setPowerState(action) {
    const srv = this.getActiveServer();
    if (!srv) return;

    if (action === 'start') {
      triggerNativeHaptic('HEAVY_CLICK');
      srv.status = 'starting';
      srv.tps = 12.4;
      srv.cpuLoad = 84.0;
      this.appendLog(srv, 'INFO', `Bootstrapping <span class="text-mint-glow">${srv.software} ${srv.version}</span> JVM (OpenJDK 21 ARM64)...`, 'info');
      this.notify('power-change');

      setTimeout(() => {
        srv.status = 'online';
        srv.tps = 20.0;
        srv.mspt = 14.2;
        srv.cpuLoad = 32.5;
        srv.ramUsedGb = Number((srv.ramMaxGb * 0.65).toFixed(1));
        this.appendLog(srv, 'INFO', 'Done (1.84s)! For help, type <span class="text-mint-glow">"/help"</span>', 'info');
        triggerNativeHaptic('SUCCESS');
        this.notify('power-change');
      }, 1200);
    } else if (action === 'restart') {
      triggerNativeHaptic('HEAVY_CLICK');
      srv.status = 'starting';
      srv.tps = 8.0;
      srv.cpuLoad = 91.2;
      this.appendLog(srv, 'WARN', 'Initiating graceful server restart — saving chunks...', 'warn');
      this.notify('power-change');

      setTimeout(() => {
        srv.status = 'online';
        srv.tps = 20.0;
        srv.mspt = 13.5;
        srv.cpuLoad = 29.8;
        this.appendLog(srv, 'INFO', `Server restarted cleanly on port <span class="text-mint-glow">${srv.port}</span>`, 'info');
        triggerNativeHaptic('SUCCESS');
        this.notify('power-change');
      }, 1400);
    } else if (action === 'stop') {
      triggerNativeHaptic('HEAVY_CLICK');
      srv.status = 'offline';
      srv.tps = 0.0;
      srv.mspt = 0.0;
      srv.cpuLoad = 0.0;
      srv.cpuCores = [0, 0];
      srv.ramUsedGb = 0.0;
      this.appendLog(srv, 'INFO', 'Stopping the server... Saved 3 worlds to NVMe.', 'info');
      this.notify('power-change');
    } else if (action === 'kill') {
      triggerNativeHaptic('ERROR');
      srv.status = 'offline';
      srv.tps = 0.0;
      srv.mspt = 0.0;
      srv.cpuLoad = 0.0;
      srv.cpuCores = [0, 0];
      srv.ramUsedGb = 0.0;
      this.appendLog(srv, 'ERROR', 'SIGKILL (-9) sent to JVM process! Forced immediate termination.', 'error');
      this.notify('power-change');
    }
  }

  async executeConsoleCommand(rawCmd) {
    const srv = this.getActiveServer();
    if (!srv || !rawCmd.trim()) return;
    const cmd = rawCmd.trim();
    triggerNativeHaptic('TICK');

    this.appendLog(srv, 'CMD', `<span class="text-white">Console</span>: <span class="text-mint-glow">${cmd}</span>`, 'command');

    // If RCON Native Bridge is active and server is configured as RCON
    if (srv.connectionType === 'rcon' && window.AnvilNative && typeof window.AnvilNative.sendRconCommand === 'function') {
      try {
        const resJson = window.AnvilNative.sendRconCommand(srv.address, srv.rconPort || 25575, srv.rconPassword || '', cmd);
        const parsed = JSON.parse(resJson);
        if (parsed.ok) {
          this.appendLog(srv, 'RCON', `${parsed.response || 'Command executed'} <span class="text-slate-500">(${parsed.latencyMs}ms)</span>`, 'info');
        } else {
          this.appendLog(srv, 'ERROR', `[RCON] ${parsed.error}`, 'error');
        }
        this.notify('console-update');
        return;
      } catch (e) {
        this.appendLog(srv, 'ERROR', `[RCON Bridge] ${e.message}`, 'error');
      }
    }

    // Simulated Live Server Command Interpreter
    const clean = cmd.startsWith('/') ? cmd.slice(1) : cmd;
    const parts = clean.split(/\s+/);
    const root = parts[0].toLowerCase();

    if (root === 'help' || root === '?') {
      this.appendLog(srv, 'INFO', 'Available commands: <span class="text-mint-glow">/tps, /list, /say, /time set, /weather, /gamemode, /op, /deop, /kick, /ban, /whitelist, /save-all, /stop</span>', 'info');
    } else if (root === 'tps') {
      this.appendLog(srv, 'INFO', `TPS from last 1m, 5m, 15m: <span class="text-mint-glow font-bold">${srv.tps.toFixed(1)}, 19.98, 19.95</span> (MSPT: ${srv.mspt}ms)`, 'info');
    } else if (root === 'list') {
      const online = srv.players.filter(p => p.online && !p.banned);
      this.appendLog(srv, 'INFO', `There are <span class="text-mint-glow font-bold">${online.length}</span> of a max of ${srv.properties['max-players']} players online: <span class="text-white">${online.map(p => p.username).join(', ') || 'None'}</span>`, 'info');
    } else if (root === 'say' || root === 'broadcast') {
      const msg = parts.slice(1).join(' ') || 'Server announcement!';
      this.appendLog(srv, 'CHAT', `<span class="text-fuchsia-400 font-bold">[Server]</span> <span class="text-white">${msg}</span>`, 'chat');
    } else if (root === 'save-all' || root === 'save') {
      this.appendLog(srv, 'INFO', 'Saving the game (this may take a moment!)... <span class="text-emerald-300">Saved the world</span>', 'info');
    } else if (root === 'time' && parts[1] === 'set') {
      const val = (parts[2] || 'day').toLowerCase();
      srv.worldTime = ['dawn', 'day', 'dusk', 'night'].includes(val) ? val : 'day';
      this.appendLog(srv, 'INFO', `Set the world time to <span class="text-mint-glow uppercase">${srv.worldTime}</span>`, 'info');
    } else if (root === 'weather') {
      const w = (parts[1] || 'clear').toLowerCase();
      srv.weather = ['clear', 'rain', 'thunder'].includes(w) ? w : 'clear';
      this.appendLog(srv, 'INFO', `Changing weather protocol to <span class="text-mint-glow uppercase">${srv.weather}</span>`, 'info');
    } else if (root === 'whitelist') {
      const sub = (parts[1] || 'on').toLowerCase();
      if (sub === 'on' || sub === 'off') {
        srv.properties['white-list'] = (sub === 'on');
        this.syncPropertiesToRawFile(srv);
        this.appendLog(srv, 'INFO', `Whitelist is now turned <span class="text-mint-glow uppercase">${sub}</span>`, 'info');
      } else if (sub === 'add' && parts[2]) {
        this.appendLog(srv, 'INFO', `Added <span class="text-white font-semibold">${parts[2]}</span> to the whitelist`, 'info');
      }
    } else if (root === 'op' && parts[1]) {
      const target = srv.players.find(p => p.username.toLowerCase() === parts[1].toLowerCase());
      if (target) target.op = true;
      this.appendLog(srv, 'INFO', `Made <span class="text-mint-glow font-semibold">${parts[1]}</span> a server operator`, 'info');
    } else if (root === 'deop' && parts[1]) {
      const target = srv.players.find(p => p.username.toLowerCase() === parts[1].toLowerCase());
      if (target) target.op = false;
      this.appendLog(srv, 'INFO', `Made <span class="text-amber-300 font-semibold">${parts[1]}</span> no longer a server operator`, 'info');
    } else if (root === 'kick' && parts[1]) {
      const reason = parts.slice(2).join(' ') || 'Kicked by an operator.';
      const target = srv.players.find(p => p.username.toLowerCase() === parts[1].toLowerCase());
      if (target) target.online = false;
      this.appendLog(srv, 'WARN', `Kicked <span class="text-white font-semibold">${parts[1]}</span> from the game: "${reason}"`, 'warn');
    } else if (root === 'ban' && parts[1]) {
      const reason = parts.slice(2).join(' ') || 'Banned by an operator.';
      const target = srv.players.find(p => p.username.toLowerCase() === parts[1].toLowerCase());
      if (target) {
        target.online = false;
        target.banned = true;
        target.banReason = reason;
      }
      this.appendLog(srv, 'ERROR', `Banned player <span class="text-white font-semibold">${parts[1]}</span>: "${reason}"`, 'error');
    } else if (root === 'gamemode' && parts[1]) {
      const mode = parts[1].toUpperCase();
      const pName = parts[2] || (srv.players[0] && srv.players[0].username) || 'AlexCraft';
      const target = srv.players.find(p => p.username.toLowerCase() === pName.toLowerCase());
      if (target) target.gamemode = mode;
      this.appendLog(srv, 'INFO', `Set <span class="text-white font-semibold">${pName}</span>'s game mode to <span class="text-mint-glow">${mode}</span>`, 'info');
    } else if (root === 'stop') {
      this.setPowerState('stop');
      return;
    } else {
      this.appendLog(srv, 'INFO', `Executed <span class="text-mint-glow">/${clean}</span> → 0 errors (12ms)`, 'info');
    }

    this.notify('console-update');
  }

  syncPropertiesToRawFile(srv) {
    const lines = [
      '#Minecraft server properties',
      `#Updated ${new Date().toISOString()}`,
      ...Object.entries(srv.properties).map(([k, v]) => `${k}=${v}`)
    ];
    srv.files['/server.properties'] = lines.join('\n');
    srv.motdLine1 = String(srv.properties['motd'] || 'A Minecraft Server');
  }

  startTelemetryLoop() {
    setInterval(() => {
      let changed = false;
      for (const srv of this.state.servers) {
        if (srv.status === 'online') {
          const jitter = (Math.random() - 0.48) * 0.16;
          const baseTps = srv.software === 'Fabric' ? 19.6 : 20.0;
          srv.tps = Number(Math.min(20.0, Math.max(17.2, baseTps + jitter)).toFixed(2));
          srv.mspt = Number(Math.max(8.5, (50 - (srv.tps - 15) * 6.5 + (Math.random() - 0.5) * 2.2)).toFixed(1));
          srv.cpuLoad = Number(Math.min(95, Math.max(12, srv.cpuLoad + (Math.random() - 0.5) * 4.5)).toFixed(1));
          srv.cpuCores = [
            Math.min(99, Math.max(10, Math.round(srv.cpuLoad + 4))),
            Math.min(99, Math.max(8, Math.round(srv.cpuLoad - 4)))
          ];
          srv.pingMs = Math.max(11, Math.round(srv.pingMs + (Math.random() - 0.5) * 3));
          srv.tpsHistory.push(srv.tps);
          if (srv.tpsHistory.length > 16) srv.tpsHistory.shift();
          changed = true;
        }
      }
      if (changed) {
        for (const fn of this.listeners) {
          fn(this.state, 'telemetry-tick');
        }
      }
    }, 2600);
  }
}

export const store = new AnvilStore();
