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
