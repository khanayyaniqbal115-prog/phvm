# Phoenix Launcher: build and setup

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
You get one installer, `Phoenix-Launcher-Setup-x.y.z.exe`, in the `release/` folder.

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
The X button hides Phoenix Launcher to the system tray. Use the tray icon menu to quit.

## Discord profile ("Playing Phoenix Launcher")
Open `electron/config.cjs`, create an application at https://discord.com/developers/applications named "Phoenix Launcher", and paste its Application ID into `DISCORD_CLIENT_ID`. Discord must be running on the same PC.

## Microsoft sign-in
Register an Azure (Microsoft Entra) app as a "Mobile and desktop" public client, allow personal Microsoft accounts, enable "Allow public client flows", request Minecraft API access at https://aka.ms/AppRegistration, then paste the client ID into `MICROSOFT_CLIENT_ID` in `electron/config.cjs`. Local accounts work without this.

## FPS boost
Each FPS preset writes real `options.txt` values, and "Auto-install FPS mods" downloads Sodium, Lithium, FerriteCore, EntityCulling, ImmediatelyFast and ModernFix from Modrinth (Fabric/Quilt only).

## 4. Build the .exe with GitHub Actions (no local npm)
1. Upload this project to a GitHub repo (the workflow lives in `.github/workflows/build-windows.yml`).
2. Repo > Actions > "Build Windows .exe" > Run workflow.
3. After 5-10 minutes, download the "Phoenix-Launcher-Windows" artifact from the run.
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
For local (offline) accounts the launcher installs the CustomSkinLoader mod on Fabric/Quilt and writes your selected skin and the Phoenix cape into `CustomSkinLoader/LocalSkin` inside the instance folder. Vanilla, Forge and NeoForge cannot show custom skins for offline accounts. Other players only see your skin if they use the same mod.

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

## Phoenix Client mod (HUD)
Source: `phoenix-client-mod/` in the repo root (original code, MIT). Run the "Build Phoenix Client mod" workflow (or push a tag like `mod-v1.0.0` to publish a release), then copy the jar's direct download link into `PHOENIX_CLIENT_JAR_URL` in `electron/config.cjs` and rebuild the launcher. Fabric 1.21.4 profiles then get it automatically. In game press Right Shift for its menu. Motion blur is not included yet.

## Why the game can lag, and what the launcher now does
Pre-touching the whole heap and a heap bigger than the PC can spare (swapping) made mobs and the game stutter. Now: no AlwaysPreTouch, small initial heap, RAM capped to 65% of installed memory, Minecraft runs at above-normal CPU priority, and Windows is told to use the high-performance GPU for Java on laptops with two GPUs.
