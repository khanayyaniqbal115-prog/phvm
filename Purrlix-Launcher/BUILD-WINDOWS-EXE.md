# Purrlix Launcher: build and setup

## Requirements
- Node.js 20 or 22 (https://nodejs.org)
- Internet (the first launch downloads Minecraft files and, if needed, Java)

## 1. Desktop app (this is where Minecraft really launches)
```bash
npm install --legacy-peer-deps
npm run electron:dev
```
This runs `vite build` and then opens the Electron window.

## 2. Build the Windows .exe
```bash
npm run dist:win
```
You get one installer, `Purrlix-Launcher-Setup-x.y.z.exe`, in the `release/` folder.

## 3. UI only in a browser (Minecraft will NOT launch)
```bash
npm run dev
```
Open `http://localhost:3000`. A browser cannot run Java, so the game only starts from the desktop app.

## Where game data is stored
`%APPDATA%\.phoenix-launcher`: `versions/`, `libraries/`, `assets/`, `runtime/` (auto-downloaded Java) and `instances/<id>/` (mods, saves, logs).
Launch log: `instances/<id>/logs/phoenix-launch.log`.

## Supported loaders and accounts
Vanilla, Fabric and Quilt (automatic). Forge and NeoForge are installed through their installers (experimental).
Accounts: local (offline) username, or Microsoft sign-in (needs a client ID, see below).

## Closing the window
The X button hides Purrlix Launcher to the system tray. Use the tray icon menu to quit.

## Discord profile ("Playing Purrlix Launcher")
Open `electron/config.cjs`, create an application at https://discord.com/developers/applications named "Purrlix Launcher", and paste its Application ID into `DISCORD_CLIENT_ID`. Discord must be running on the same PC.

## Microsoft sign-in
Register an Azure (Microsoft Entra) app as a "Mobile and desktop" public client, allow personal Microsoft accounts, enable "Allow public client flows", request Minecraft API access at https://aka.ms/AppRegistration, then paste the client ID into `MICROSOFT_CLIENT_ID` in `electron/config.cjs`. Local accounts work without this.

## FPS boost
Each FPS preset writes real `options.txt` values, and "Auto-install FPS mods" downloads Sodium, Lithium, FerriteCore, EntityCulling, ImmediatelyFast and ModernFix from Modrinth (Fabric/Quilt only).

## 4. Build the .exe with GitHub Actions (no local npm)
1. Upload this project to a GitHub repo (the workflow lives in `.github/workflows/build-windows.yml`).
2. Repo > Actions > "Build Windows .exe" > Run workflow.
3. After 5-10 minutes, download the "Purrlix-Launcher-Windows" artifact from the run.
For a Releases link, push a tag: `git tag v1.1.0 && git push --tags`.

## 5. Phone / web version (Netlify)
The game does not run on a phone, but the launcher UI (accounts, mod search, skins, FPS presets) works in a phone browser.
1. Upload the project to a GitHub repo.
2. https://app.netlify.com > Add new site > Import from Git > pick your repo.
3. Build settings come from `netlify.toml` (`npm run build`, publish `dist`). Click Deploy.

## Windows Defender / SmartScreen warning
A new, unsigned app always triggers "Windows protected your PC". It does not mean the file is a virus. It means Microsoft has not seen this file before and it has no paid code-signing certificate. Ways to reduce it:
1. **Sign the exe.** Buy a code-signing certificate (or use Azure Trusted Signing / SignPath Foundation, which is free for open-source projects). Add repository secrets `CSC_LINK` (base64 of the .pfx) and `CSC_KEY_PASSWORD`; the GitHub workflow signs automatically when they exist.
2. **Report a false positive** at https://www.microsoft.com/wdsi/filesubmission (choose "Software developer") so Defender learns the file is safe.
3. **Ship one installer** from a stable GitHub Releases link. Reputation builds as more people download the same file.
4. Users can click "More info" then "Run anyway".

## Skins and capes in game
For local (offline) accounts the launcher installs the CustomSkinLoader mod on Fabric/Quilt and writes your selected skin and the Purrlix cape into `CustomSkinLoader/LocalSkin` inside the instance folder. Vanilla, Forge and NeoForge cannot show custom skins for offline accounts. Other players only see your skin if they use the same mod.

## Discord status
Browsing the launcher shows "Browsing profiles". While a game runs it shows "Playing Minecraft <version>", "Playing singleplayer in Minecraft <version>" or "Playing multiplayer in Minecraft <version>" with the server address. The header shows a Discord indicator. If it says "waiting", open the Discord desktop app on the same PC (not as administrator) and check Settings > Activity Privacy > "Share your detected activity".

## Worlds, server join and more
- **Worlds tab:** list the worlds of the active profile, import a world `.zip`, and search/download worlds from CurseForge. CurseForge needs a free API key from https://console.curseforge.com pasted into `CURSEFORGE_API_KEY` in `electron/config.cjs`. Some authors disable direct downloads; those show "No direct download" and can be opened on the CurseForge page.
- **Join buttons:** the server list shows live player counts. JOIN starts the game and connects straight to that server (Minecraft 1.20+ uses quickPlay, older versions use --server). Add your own servers under the list.
- **Playtime and last played** are tracked per profile, "Recommend RAM for my PC" picks about half of your installed RAM, and a banner appears when a newer GitHub Release exists (`GITHUB_REPO` in `electron/config.cjs`).

## Settings tab
The old "Setup .exe" tab was replaced by Settings (Java path and game data folder, both optional).

## CurseForge key note
The CurseForge key in `electron/config.cjs` ships inside the .exe, so anyone can extract it. If it leaks, create a new one at https://console.curseforge.com and rebuild.

## Getting rid of the "dangerous file" warnings for real
Only a trusted signature removes them. Options, cheapest first:
1. **Microsoft Store** (one-time ~US$19 individual developer account). Store apps are signed by Microsoft and show no SmartScreen or browser warning. electron-builder can build an `appx` target once you reserve an app name in Partner Center.
2. **SignPath Foundation** (free code signing for open-source projects). Needs a public repo and an application at https://signpath.org.
3. **Azure Trusted Signing** (about US$10 per month, available only in some countries) or a **code-signing certificate** from a CA. Put the certificate in the `CSC_LINK` and `CSC_KEY_PASSWORD` repository secrets; the workflow signs automatically.
Until then: share the `.zip` from the GitHub Release (browsers block it far less than a bare .exe) and report the file as safe at https://www.microsoft.com/wdsi/filesubmission and https://safebrowsing.google.com/safebrowsing/report_error/.

## Purrlix Client mod (HUD)
Source: `purrlix-client-mod/` in the repo root (original code, MIT). Run the "Build Purrlix Client mod" workflow (or push a tag like `mod-v1.0.0` to publish a release), then copy the jar's direct download link into `PHOENIX_CLIENT_JAR_URL` in `electron/config.cjs` and rebuild the launcher. Fabric 1.21.4 profiles then get it automatically. In game press Right Shift for its menu. Motion blur is not included yet.

## Why the game can lag, and what the launcher now does
Pre-touching the whole heap and a heap bigger than the PC can spare (swapping) made mobs and the game stutter. Now: no AlwaysPreTouch, small initial heap, RAM capped to 65% of installed memory, Minecraft runs at above-normal CPU priority, and Windows is told to use the high-performance GPU for Java on laptops with two GPUs.

## Screen recorder
Click **Record** in the launcher header, or press **F9** anywhere (global shortcut), to start/stop. Recordings are saved as `.webm`
in `Videos/Purrlix Recordings` (system audio is included on Windows). The folder button next to it opens that directory.

## v1.2 features
- **Crash helper**: after a failed launch the game log / crash report is read and the likely cause is shown in the log window.
- **Mods tab**: Modrinth search and install (mods, shaders, resource packs, required dependencies), installed list with enable/disable/delete, update checker, `.mrpack` import and export.
- **Library tab**: screenshots gallery, world backups (automatic before each launch, newest 3 kept) with restore, duplicate profile.
- **Settings**: "What's new" (GitHub releases) and one-click update (downloads the newest Setup .exe from the latest release and starts it). Release assets must be attached by the tag build.

## v1.3 features
- **Library**: saved servers with live player counts + JOIN, friends list (saved names and servers; no live online status), play-time stats, auto RAM, keybind copy/reset between profiles.
- **Skins**: "Use on my Minecraft account" uploads the selected skin to a Microsoft account (classic/slim).
- **Mods**: preview image for shaders/resource packs, "Verified on Modrinth" / "Unverified" badge per file.
- **Settings**: six accent themes and "Hide the launcher while the game runs".

## Android app (.apk)
The workflow's `android` job wraps the web UI with Capacitor and builds `Purrlix-Launcher-Android.apk` (debug-signed, install by sideloading).
It manages accounts, skins and the other screens, but **cannot start Minecraft Java** (a phone has no Java runtime for it).
To get server counts / Modrinth data in the app, deploy the web version (Netlify) and add the repository variable `PHOENIX_API_BASE` with its URL.

## v1.5
- Capes: in-game cape texture now fills the full 64x32 sheet (back, inner face, elytra wings). Purrlix Client 1.3 plays an animated cape for you.

## v1.4
- Darker "dangerous" built-in skins, animated Purrlix cape in the 3D viewer (in game the cape is a still image: Minecraft cannot play animated capes), calmer 3D lighting.
- Auto-install of Purrlix Client + Fabric API in Fabric 1.21.4 profiles (needs a GitHub release that has `purrlix-client-*.jar` attached; the tag build does that).
- Broken resource packs are set aside (`.broken`) and missing ones removed from options.txt before launch.

## v1.6
- **Purrlix Client is bundled in the installer.** The workflow builds the mod first and ships the jar inside the launcher, so the Purrlix loading screen and HUD no longer depend on a GitHub release. The launch log says "Installed Purrlix Client ... (bundled with the launcher)" or why it was skipped.
- **Per-instance switch:** Library > Profile > Purrlix Client mod. Off parks the jar as `.jar.disabled`.
- **Mod menu (Right Shift):** item icons on every row, chamfered buttons, and a "Fast place delay" control (MAX / 1t / 2t / 3t).
- **Less lag:** while the game runs the launcher pauses animations, blur and the 3D skin viewport.
- Android job: `chmod +x gradlew`, `--no-daemon`.
- World downloader: prefers .zip files, clearer errors, ZIP64 support.

## v1.6 launcher upgrades (10)
1. **Command palette** (Ctrl+K): pages, profiles and "Play".
2. **Keyboard shortcuts:** Ctrl+1..9 open the pages, Ctrl+Enter plays the selected profile.
3. **Lite mode** (Settings > Appearance): no animations or blur.
4. **Accent colour picker** on top of the ready-made themes.
5. **UI size** 90% to 125%.
6. **Export / import launcher data** (profiles, skins, settings, play history) as one JSON file.
7. **Desktop notifications** when the game starts or closes while the launcher is in the background.
8. **What's new** window once after an update.
9. **Profile notes** (Library > Profile).
10. **Copy system info** for bug reports.

## Less lag (v1.6.x)
- Lite mode starts on by itself on PCs with 4 CPU threads or less (change it in Settings > Appearance).
- The 3D skin viewer is capped at 30 FPS and stops while the game runs or the window is hidden.
- Purrlix Client 1.7 refreshes item counts, biome, light, RAM and waypoint distances every 10 ticks instead of every frame.

## Web version upgrades
- The browser tab icon is back (`favicon.ico`, 192 and 512 px icons in `index.html`).
- A banner in the web version offers "Install as an app" (when the browser allows it) and the Windows download. It can be closed.
- The Mods page now works in the browser: browse Modrinth mods, shaders and modpacks for the profile's Minecraft version and open them. Installing still needs the Windows app.

## Uninstall

When you uninstall Purrlix Launcher, a question asks whether to also delete all data (profiles, worlds, mods, screenshots, accounts). Choosing No keeps everything. If you moved the data folder in Settings, that custom folder is not touched and must be deleted by hand. Updates never show this question. Not tested on a real Windows install yet.

## Purrlix Boost

Create Profile has a Purrlix Boost box with buttons for Minecraft 1.21.1 to 1.21.11. A button makes a Fabric profile named "Purrlix Boost <version>" and the launcher installs Sodium, Lithium, FerriteCore, EntityCulling and ImmediatelyFast for that version from Modrinth when the game starts. If a mod has no build for a version, it is skipped. Not tested on a real run. Purrlix Client itself still supports only 1.21.4.

## Skins and capes (v1.6)

- Skin Studio: type a player name and press Get skin to add that player's skin (Mojang API through the launcher's local server; needs internet). Players without a custom skin show a message.
- The Purrlix cape now shows the real app icon with a small "PURRLIX LAUNCHER" line. The built-in skins have brighter colours. Skins already saved on a PC keep their old look; use "Reset" or add new ones to see the new colours.

## Animated capes

Profile tab (Library) has an "Animated cape" box. With it on, a Fabric profile on Minecraft 1.21.11 downloads the ClientCapes mod (plus Fabric API and Mod Menu) from Modrinth when the game starts. "Add cape file" copies a .gif or .png into `config/custom_capes`; pick it in Mod Menu in game. Only you see the cape. The mod is All Rights Reserved, so it is downloaded from Modrinth and never bundled. A "Purrlix Boost 1.21.11" profile turns it on by default. Not tested in a real game.
