# 🟢 anvil-mc (v2.0.7) — Server Minecraft sul tuo Telefono

Applicazione mobile Android nativa (**Kotlin + WebView Hybrid Engine**) e Web App interattiva per creare, configurare, avviare e amministrare server Minecraft (Java & Bedrock Cross-Play) direttamente dallo smartphone, progettata con il design system **"Dark Carbon & Emerald" (`v2.0.7`)**.

---

## 📦 Download Diretto APK (GitHub Releases)

- **Ultima Release (`v2.0.7`)**: [Scarica `Anvil-MC-v2.0.7.apk` dalle GitHub Releases](https://github.com/tommasomurador-png/anvil-mc-mobile/releases/tag/v2.0.7)
- **Tutte le Releases**: [https://github.com/tommasomurador-png/anvil-mc-mobile/releases](https://github.com/tommasomurador-png/anvil-mc-mobile/releases)

---

## 🎨 Design System ("Dark Carbon & Emerald" v2.0.7)

- **Background Principale**: `#0B0D0E` (Nero Carbone profondo)
- **Superficie Card & Modali**: `#15181C` / `#1C2026`, Bordi sottili `#262B33`
- **Colore Primario (Emerald Green)**: `#22C55E`
- **Colore Pericolo / Stop**: `#EF4444` (`⏹ FERMA`, chip `/stop`, `ESCI`, `ELIMINA SERVER`)
- **Colore Warning / Transizione**: `#F59E0B` (`🟠 ARRESTO...`, `🟠 AVVIO SERVER...`, banner di sicurezza)
- **Header Fisso**: Logo geometrico `anvil-mc`, selettore regione `🌐 Tunnel: EU ▾` (`EU`, `US`, `SG`, `Locale`) e pulsante Discord.
- **Bottom Navigation Bar Fissa (5 Tab)**: `Home`, `Console`, `+ Crea` (FAB centrale `#22C55E`), `File`, `Profilo`.

---

## 🚀 Funzionalità Principali (v2.0.7)

1. **Schermata Home & Ciclo di Avvio Realistico**:
   - Server pre-caricato **`Hub Creativo`** (`Fabric 26.3 • Max 20 giocatori`).
   - Stato `ONLINE (LOCALE)` con timer live (`00:04:20+`), condivisione IP locale (`10.209.160.27:25565`), box **Giocatori** con 5 filtri (`✓ Online`, `👤 Tutti`, `✓ Whitelist`, `🛡️ Admin`, `🚫 Bannati`), telemetria live (`CPU`, `TPS`, `RAM`).
   - Sequenza di arresto (`🟠 ARRESTO...` + `SALVATAGGIO...` -> `⚪ OFFLINE`) e sequenza di avvio realistica (`🟠 AVVIO SERVER...` con `CPU 100%`, barra animata `TPS`, salita progressiva `RAM 72MB -> 559MB` e generazione log in Console).
   - Bottom Sheet automatico post-avvio *"Lascia che gli amici si uniscano al tuo mondo"*, Diagnostica `?` e Paywall a tutto schermo **Anvil-MC PREMIUM**.
2. **Impostazioni del Server (9 Sottopagine Navigabili)**:
   - `Generale`, `Gioco`, `Mondo` (seed e backup `.zip`), `Mod & Plugin` (ricerca reale su **Modrinth API v2** `api.modrinth.com/v2/search` con paginazione e installazione in `/mods`), `Software` (`Paper`, `Purpur`, `Spigot`, `Fabric`, `Vanilla`), `Prestazioni` (slider RAM con blocco a `4096 MB`, Aikar's Flags), `Rete` (Cross-Play Bedrock **Geyser + Floodgate**, RCON), `Backup`, `Automazione`.
3. **Schermata Console**:
   - Statistiche rapide (`Stato`, `Giocatori`, `TPS`), filtri `Tutto / Info / Warn / Errori`, barra di ricerca log, toggle `Auto-scroll`, 6 Quick-Command Chips (`/help`, `/list`, `/tps`, `/save-all`, `/weather clear`, `/stop`) e interprete comandi interattivo + client RCON TCP nativo.
4. **Flusso `+ Crea` & Setup Guidato in 8 Step**:
   - Scelta tra **Setup guidato** (`Consigliato`) e **Configurazione rapida**.
   - 8 step completi con barra di progresso, filtro automatico versioni per server con Mod/Plugin, allocazione RAM con rilevamento memoria del dispositivo e schermata celebrativa finale con coriandoli.
5. **Schermata File & Sicurezza**:
   - Navigazione ed editing real-time di `/mods`, `/world`, `server.properties`, `eula.txt`, `logs/` con banner di avviso arancione quando il server è attivo.
   - Modale di eliminazione con **pressione prolungata di 1.8 secondi** e barra di riempimento progressiva rossa.
6. **Schermata Profilo**:
   - Card utente (`Tommaso Murador`, `tommasomurador@gmail.com`, badge `Gratis`), statistiche, card **Stato dispositivo** (`RAM disponibile`, `Server attivi`, `Tunnel: EU (attivo)`), Account & Community e versione `anvil-mc v2.0.7`.

---

## 🛠️ Compilazione Android (`Kotlin` + `Gradle`)

```bash
./gradlew assembleDebug assembleRelease
```

L'APK firmato viene generato in `app/build/outputs/apk/release/app-release.apk`.
