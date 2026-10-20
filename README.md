# ⚡ Anvil-MC — Mobile Minecraft Server Control Deck

**Anvil-MC** è un'applicazione ibrida **Android Nativa (Kotlin) + Web App (HTML5, CSS3, ES6 Modules)** progettata con il design system **"Obsidian Deck"** per creare, monitorare, configurare e amministrare server Minecraft (**Java & Bedrock**) direttamente dallo smartphone.

---

## 🚀 Architettura & Funzionalità Principali

1. **Strato Nativo Android (`Kotlin`) — `app/src/main/java/com/anvilmc/app/`**
   - `MainActivity.kt`: WebView edge-to-edge ottimizzata con accelerazione hardware, gestione `WindowInsets` e intercettazione del tasto fisico *Indietro*.
   - `MinecraftRconClient.kt`: Implementazione nativa tramite `java.net.Socket` e Kotlin Coroutines del **protocollo ufficiale Minecraft RCON (Source RCON TCP Protocol)** (Packet Type `3` Auth, Packet Type `2` ExecCommand, Packet Type `0` Response).
   - `AnvilNativeBridge.kt` (`window.AnvilNative`):
     - `sendRconCommand(host, port, password, command)`
     - `pingServerNative(host, port)`
     - `triggerHaptic(style)` (`HEAVY_CLICK`, `TICK`, `SUCCESS`, `ERROR`)
     - `exportServerFile(filename, content)`

2. **5 Moduli Operativi (`app/src/main/assets/www/`)**
   - **Modulo 1 — Anvil Hub (Dashboard):** Telemetria 60fps in tempo reale (Gauge circolare TPS/MSPT, RAM G1GC, CPU dual-core, NVMe Storage), Power Controls tattili con **Hold-to-Kill (1.5s)**, scanner di server pubblici reali (`api.mcsrvstat.us/3/`) e Wizard **+ Aggiungi / Crea Server**.
   - **Modulo 2 — Live Console & AI Crash Doctor:** Terminale OLED con filtri rapidi (`Tutti`, `Solo Errori`, `Chat`, `Comandi`), Quick-Command Bar e **Anvil AI Crash Doctor** con diagnosi e hotfix in 1 clic.
   - **Modulo 3 — Players & World Manager:** Lista giocatori con **teste 3D isometriche (`mc-heads.net`)**, Action Sheet rapido (`Gamemode`, `OP/De-OP`, `Teleport`, `Clear Inventory`, `Kick`, `Ban`) e controlli rapidi del mondo (Difficoltà, Orario, Meteo e Gamerules).
   - **Modulo 4 — Visual Config Studio & File Manager:** Editor visuale per `server.properties` con switch booleani, slider numerici, **MOTD Studio a 16 colori (`§0`-`§f`, `§l`, `§o`, `§k`)** con anteprima live multiplayer e File Explorer per modificare/esportare `.yml`, `.properties` e `.log`.
   - **Modulo 5 — Anvil Forge (Marketplace Modrinth & PaperMC):** Ricerca live su `api.modrinth.com/v2/search` per installare plugin e mod con un tocco e selettore versione collegato a `api.papermc.io/v2/projects/paper`.

---

## 📦 Compilazione `.APK` e Rilascio Automatico

### Compilazione Locale
```bash
./gradlew assembleDebug assembleRelease
```

### Pubblicazione Rapida Release
```bash
./publish-release.sh v1.0.0
```

Ogni push di tag `v*` attiva anche la pipeline **GitHub Actions** (`.github/workflows/build-release-apk.yml`) che compila e allega automaticamente `Anvil-MC-v1.0.0.apk` nelle **GitHub Releases**.
