# Phoenix Launcher — Kaise chalayein

## Zaroori
- Node.js 20 ya 22 (https://nodejs.org)
- Internet (pehli launch par Minecraft files aur zaroorat par Java download hoti hai)

## 1. Desktop app (asli Minecraft launch yahin se hota hai)
```bash
npm install
npm run electron:dev
```
Ye pehle `vite build` karta hai phir Electron window kholta hai.

## 2. Windows .exe banana
```bash
npm install
npm run dist:win
```
`release/` folder mein installer (`Phoenix Launcher Setup x.y.z.exe`) aur portable `.exe` milenge.

## 3. Sirf browser mein UI dekhna (Minecraft launch NAHI hoga)
```bash
npm run dev
```
`http://localhost:3000` kholo. Browser Java nahi chala sakta, isliye game sirf desktop app se chalta hai.

## Game data kahan save hota hai
`%APPDATA%\.phoenix-launcher` — `versions/`, `libraries/`, `assets/`, `runtime/` (auto-downloaded Java) aur `instances/<id>/` (mods, saves, logs).
Launch log: `instances/<id>/logs/phoenix-launch.log`.

## Supported loaders
Vanilla, Fabric, Quilt (auto). Forge / NeoForge installer se install hote hain (experimental).
Account: offline username mode.

## 4. Bina npm ke .exe (GitHub se automatic)
1. Is folder ko ek GitHub repo mein upload karo.
2. Repo > Actions > "Build Windows .exe" > Run workflow.
3. 5-10 minute baad run ke andar "Phoenix-Launcher-Windows" artifact se .exe download karo.
Release link chahiye to tag push karo: `git tag v1.1.0 && git push --tags` — .exe Releases mein khud lag jayegi.

## 5. Phone / Web version (Netlify)
Game phone par nahi chalta, lekin launcher ki UI (profiles, mods search, skins, FPS presets) phone browser mein chalti hai.
1. Project ko GitHub repo mein upload karo.
2. https://app.netlify.com > Add new site > Import from Git > apna repo chuno.
3. Build settings khud `netlify.toml` se aa jayengi (npm run build, publish dist). Deploy dabao.
