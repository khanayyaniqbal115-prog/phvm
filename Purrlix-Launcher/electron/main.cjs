const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, safeStorage, Notification, desktopCapturer, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalServer } = require('./localServer.cjs');
const { launch, stopLaunch, killProcessTree, detectJavas } = require('./launcher.cjs');
const discord = require('./discord.cjs');
const microsoft = require('./microsoft.cjs');
const spotify = require('./spotify.cjs');
const worlds = require('./worlds.cjs');
const manage = require('./manage.cjs');
const config = require('./config.cjs');
const os = require('os');

// The launcher window itself should stay small: cap the JavaScript heap.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=256');

let mainWindow = null;
let tray = null;
let localPort = null;
let quitting = false;
let msLoginCancelled = false;
const hiddenForGame = new Set(); // instances for which the launcher window was hidden while the game runs
const running = new Map(); // instanceId -> 'starting' | pid

// World backups run in a worker thread: zipping a large world on the main thread froze the launcher window.
function backupWorlds(savesDir, backupsDir) {
  return new Promise((resolve) => {
    try {
      const { Worker } = require('worker_threads');
      const w = new Worker(path.join(__dirname, 'backupWorker.cjs'), { workerData: { savesDir, backupsDir } });
      w.once('message', (m) => resolve(m && m.ok ? m.done : []));
      w.once('error', () => resolve([]));
      w.once('exit', () => resolve([]));
    } catch {
      resolve([]);
    }
  });
}

function dataDir(custom) {
  const c = typeof custom === 'string' ? custom.trim() : '';
  if (c && !c.includes('%')) return c;
  return path.join(app.getPath('appData'), '.phoenix-launcher');
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function trayImage() {
  const file = path.join(__dirname, 'tray.png');
  return fs.existsSync(file) ? nativeImage.createFromPath(file).resize({ width: 20, height: 20 }) : nativeImage.createEmpty();
}

function showWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  tray = new Tray(trayImage());
  tray.setToolTip('Purrlix Launcher');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Purrlix Launcher', click: showWindow },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on('click', showWindow);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#090C12',
    title: 'Purrlix Launcher',
    ...(fs.existsSync(path.join(__dirname, '../purrlix.ico')) ? { icon: path.join(__dirname, '../purrlix.ico') } : {}),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Open links in the system browser, not inside the app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(`http://127.0.0.1:${localPort}`) && !(process.env.PHOENIX_DEV_URL && url.startsWith(process.env.PHOENIX_DEV_URL))) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  // Closing the window sends the launcher to the background (system tray) instead of quitting
  mainWindow.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    mainWindow.hide();
    if (!app.phoenixHintShown && Notification.isSupported()) {
      app.phoenixHintShown = true;
      new Notification({ title: 'Purrlix Launcher', body: 'Still running in the background. Click the tray icon to open it, or right-click it to quit.' }).show();
    }
  });

  if (process.env.PHOENIX_DEV_URL) {
    await mainWindow.loadURL(process.env.PHOENIX_DEV_URL);
    return;
  }

  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    dialog.showErrorBox('Purrlix Launcher', 'dist/index.html was not found. Run "npm run build" first, then "npm run electron:dev".');
    quitting = true;
    app.quit();
    return;
  }
  const { port } = await startLocalServer(distDir);
  localPort = port;
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

// ---------------------------------------------------------------- IPC

ipcMain.handle('phoenix:get-info', () => ({
  platform: process.platform,
  dataDir: dataDir(),
  version: app.getVersion(),
  microsoftConfigured: microsoft.isConfigured(),
  discordConfigured: discord.enabled(),
  totalMemMb: Math.round(os.totalmem() / 1048576),
  cpus: os.cpus().length,
  curseforgeConfigured: worlds.cfConfigured(),
}));

ipcMain.handle('phoenix:pick-java', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose the Java executable (java.exe / javaw.exe)',
    filters: process.platform === 'win32' ? [{ name: 'Java Executable', extensions: ['exe'] }] : [],
    properties: ['openFile'],
  });
  return res.canceled ? null : res.filePaths[0];
});

ipcMain.handle('phoenix:detect-java', async (_e, custom) => detectJavas(dataDir(custom)));

ipcMain.handle('phoenix:open-folder', async (_e, payload) => {
  const root = dataDir(payload && payload.dataDir);
  const target = payload && payload.instanceId ? path.join(root, 'instances', String(payload.instanceId).replace(/[^\w.-]+/g, '_')) : root;
  fs.mkdirSync(target, { recursive: true });
  const err = await shell.openPath(target);
  return err ? { ok: false, error: err } : { ok: true, path: target };
});

// ---------------------------------------------------------------- Worlds and updates

const savesDirFor = (payload) =>
  path.join(dataDir(payload && payload.dataDir), 'instances', String((payload && payload.instanceId) || 'default').replace(/[^\w.-]+/g, '_'), 'saves');

ipcMain.handle('phoenix:list-worlds', (_e, payload) => {
  try {
    return { ok: true, worlds: worlds.listWorlds(savesDirFor(payload)) };
  } catch (e) {
    return { ok: false, error: e.message, worlds: [] };
  }
});

ipcMain.handle('phoenix:import-world', async (_e, payload) => {
  try {
    const picked = await dialog.showOpenDialog(mainWindow, { title: 'Choose a world .zip', filters: [{ name: 'World zip', extensions: ['zip'] }], properties: ['openFile'] });
    if (picked.canceled || !picked.filePaths[0]) return { ok: false, cancelled: true };
    const res = worlds.installWorldZip(picked.filePaths[0], savesDirFor(payload), path.basename(picked.filePaths[0], '.zip'));
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('phoenix:cf-search', async (_e, query) => {
  try {
    return { ok: true, results: await worlds.curseforgeSearchWorlds(String(query || '').slice(0, 80)) };
  } catch (e) {
    return { ok: false, error: e.message, results: [] };
  }
});

ipcMain.handle('phoenix:cf-download', async (_e, payload) => {
  try {
    const res = await worlds.curseforgeDownloadWorld(payload.world, savesDirFor(payload));
    return { ok: true, ...res };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('phoenix:check-update', async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${config.GITHUB_REPO}/releases/latest`, {
      headers: { 'User-Agent': 'PurrlixLauncher', Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false };
    const rel = await res.json();
    const latest = String(rel.tag_name || '').replace(/^v/, '');
    const num = (v) => v.split('.').map((n) => parseInt(n, 10) || 0);
    const a = num(latest);
    const b = num(app.getVersion());
    let newer = false;
    for (let i = 0; i < 3; i++) {
      if ((a[i] || 0) !== (b[i] || 0)) {
        newer = (a[i] || 0) > (b[i] || 0);
        break;
      }
    }
    return { ok: true, latest, newer, url: rel.html_url };
  } catch {
    return { ok: false };
  }
});

// Bedrock / Pocket Edition: only the minecraft: protocol, only known-safe shapes.
ipcMain.handle('phoenix:open-minecraft', async (_e, uri) => {
  const u = String(uri || '');
  const ok = /^minecraft:(\/\/(\?addExternalServer=[^&\s]{1,200}|connect\/\?serverUrl=[A-Za-z0-9.\-]{1,100}&serverPort=\d{1,5}))?$/.test(u);
  const store = u === 'ms-windows-store://pdp/?productid=9NBLGGH2JHXJ';
  if (!ok && !store) return { ok: false, error: 'Not a valid Minecraft link' };
  try {
    await shell.openExternal(u);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'Could not open Minecraft Bedrock. Install it from the Microsoft Store (Minecraft for Windows) first.' };
  }
});

ipcMain.handle('phoenix:open-external', (_e, url) => {
  if (/^https:\/\//i.test(String(url))) shell.openExternal(String(url));
  return { ok: true };
});

ipcMain.handle('phoenix:presence', () => ({ ok: true }));
ipcMain.handle('phoenix:discord-status', () => discord.status());

ipcMain.handle('phoenix:ms-login', async () => {
  msLoginCancelled = false;
  try {
    const account = await microsoft.login(
      (code) => {
        send('phoenix:ms-code', code);
        shell.openExternal(code.verificationUri);
      },
      () => msLoginCancelled
    );
    return { ok: true, ...account };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

ipcMain.handle('phoenix:ms-cancel', () => {
  msLoginCancelled = true;
});

ipcMain.handle('phoenix:ms-remove', (_e, uuid) => {
  try {
    microsoft.removeAccount(uuid);
  } catch {
    /* ignore */
  }
});

ipcMain.handle('phoenix:launch-instance', async (_e, payload) => {
  const id = payload && payload.instance && payload.instance.id;
  if (id && running.has(id)) return { ok: false, error: 'This profile is already running.' };
  if (id) running.set(id, 'starting');
  try {
    // Microsoft accounts: get a fresh token right before launch
    let auth = payload.auth || { type: 'offline', username: payload.username };
    if (auth.type === 'microsoft') {
      send('phoenix:progress', { stage: 'auth', message: 'Signing in with Microsoft...', percent: 1, instanceId: id });
      const cred = await microsoft.getCredentials(auth.uuid);
      auth = { type: 'microsoft', username: cred.username, uuid: cred.uuid, accessToken: cred.accessToken, xuid: cred.xuid };
    }

    try {
      const backed = await backupWorlds(savesDirFor({ dataDir: payload.dataDir, instanceId: id }), backupsDirFor({ dataDir: payload.dataDir, instanceId: id }));
      if (backed.length) send('phoenix:progress', { stage: 'backup', message: `World backup saved: ${backed.join(', ')}`, percent: 2, instanceId: id });
    } catch {
      /* backup problems must never block the game */
    }

    const startedAt = Date.now();
    let gameState = { kind: 'menu' };
    const showPlaying = () => discord.setPresence(playingPresence(payload.instance, gameState, startedAt, auth.username));
    showPlaying();
    const result = await launch(
      { ...payload, auth, dataDir: dataDir(payload.dataDir) },
      {
        emit: (evt) => {
          send('phoenix:progress', evt);
          if (evt.stage === 'game-log' && typeof evt.message === 'string') {
            const next = parseGameState(evt.message, gameState);
            if (next !== gameState) {
              gameState = next;
              showPlaying();
            }
          }
        },
        onExit: (info) => {
          running.delete(info.instanceId);
          if (hiddenForGame.delete(info.instanceId) && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
          }
          send('phoenix:exit', info);
          discord.setPresence(browsingPresence());
          try {
            if (running.size <= 1) os.setPriority(process.pid, os.constants.priority.PRIORITY_NORMAL);
          } catch {
            /* ignore */
          }
          if (payload.backupOnExit !== false) {
            // back up worlds that changed during this session (after the game has released its files)
            setTimeout(() => {
              void backupWorlds(savesDirFor({ dataDir: payload.dataDir, instanceId: id }), backupsDirFor({ dataDir: payload.dataDir, instanceId: id })).then((done) => {
                if (done.length) send('phoenix:progress', { stage: 'backup', message: `World backup saved: ${done.join(', ')}`, instanceId: id });
              });
            }, 4000);
          }
        },
      }
    );
    running.set(id, result.pid);
        // Give the game more CPU time than the launcher while it runs (no admin rights needed for these two levels)
        try {
          require('os').setPriority(result.pid, require('os').constants.priority.PRIORITY_ABOVE_NORMAL);
          require('os').setPriority(process.pid, require('os').constants.priority.PRIORITY_BELOW_NORMAL);
        } catch {
          /* not supported here: nothing changes */
        }
    gameDirs.set(id, instanceDirFor({ dataDir: payload.dataDir, instanceId: id }));
    startNowPlayingFeed();
    showPlaying();
    if (payload.hideOnLaunch && mainWindow && !mainWindow.isDestroyed()) {
      hiddenForGame.add(id);
      mainWindow.hide();
    }
    return { ok: true, ...result };
  } catch (err) {
    if (id) running.delete(id);
    const cancelled = err && err.name === 'CancelledError';
    send('phoenix:progress', {
      stage: cancelled ? 'cancelled' : 'error',
      message: cancelled ? 'Launch cancelled.' : err.message,
      level: cancelled ? undefined : 'error',
      instanceId: id,
    });
    return { ok: false, cancelled, error: err && err.message ? err.message : String(err) };
  }
});

// ---------------------------------------------------------------- Spotify "now playing" for the in-game HUD

const gameDirs = new Map(); // instance id -> game folder, while the game runs
let feedTimer = null;

// Every 5 seconds while a game runs and Spotify is connected: write purrlix-nowplaying.json into the game folder. The Purrlix Client
// mod reads that small file to show "Music Title - Artist" on the HUD. Nothing is written when Spotify is not connected.
function startNowPlayingFeed() {
  if (feedTimer) return;
  const tick = async () => {
    for (const id of [...gameDirs.keys()]) if (!running.has(id)) gameDirs.delete(id);
    if (!gameDirs.size) {
      clearInterval(feedTimer);
      feedTimer = null;
      return;
    }
    if (!spotify.status().signedIn) return;
    try {
      const now = await spotify.nowPlaying();
      const body = JSON.stringify({ title: now.title || '', artist: now.artist || '', playing: Boolean(!now.idle && now.playing), at: Date.now() });
      for (const dir of gameDirs.values()) fs.writeFileSync(path.join(dir, 'purrlix-nowplaying.json'), body);
    } catch {
      /* Spotify offline or rate limited: the mod hides the line after 20 s */
    }
  };
  feedTimer = setInterval(tick, 5000);
  void tick();
}

// ---------------------------------------------------------------- Discord presence text

function browsingPresence() {
  return { details: 'Browsing profiles', state: 'Purrlix Launcher' };
}

// Reads Minecraft's console output to know whether the player is in a menu, singleplayer or on a server.
function parseGameState(line, prev) {
  const conn = line.match(/Connecting to ([^,\s]+), (\d+)/);
  if (conn) {
    const host = conn[1];
    return prev.kind === 'multi' && prev.host === host ? prev : { kind: 'multi', host };
  }
  if (/Starting integrated server|Loading level|Preparing spawn area|Starting minecraft server version/i.test(line)) {
    return prev.kind === 'single' ? prev : { kind: 'single' };
  }
  if (/Stopping server|Disconnected from server|Stopping!|Client disconnected|Lost connection/i.test(line)) {
    return prev.kind === 'menu' ? prev : { kind: 'menu' };
  }
  return prev;
}

function headUrl(username) {
  return /^[A-Za-z0-9_]{3,16}$/.test(String(username || '')) ? `https://mc-heads.net/avatar/${encodeURIComponent(username)}/128` : '';
}

function playingPresence(instance, game, startedAt, username) {
  const v = instance.mcVersion;
  const base = { state: instance.name, startedAt, username, headUrl: headUrl(username) };
  if (game.kind === 'single') return { ...base, details: `Singleplayer - Minecraft ${v}` };
  if (game.kind === 'multi') return { ...base, details: `Playing on ${game.host}` };
  return { ...base, details: `In menu - Minecraft ${v} (${instance.loader})` };
}

ipcMain.handle('phoenix:stop-instance', (_e, id) => {
  const ok = stopLaunch(id);
  // Fallback: also kill by the pid we stored, in case the engine entry is already gone.
  const pid = running.get(id);
  if (pid) killProcessTree(pid);
  return { ok: ok || Boolean(pid) };
});

// ---------------------------------------------------------------- Profile tools (mods, backups, screenshots, news)

const instanceDirFor = (p) =>
  path.join(dataDir(p && p.dataDir), 'instances', String((p && p.instanceId) || 'default').replace(/[^\w.-]+/g, '_'));
const backupsDirFor = (p) =>
  path.join(dataDir(p && p.dataDir), 'backups', String((p && p.instanceId) || 'default').replace(/[^\w.-]+/g, '_'));

function safeIpc(name, fn) {
  ipcMain.handle(name, async (_e, payload) => {
    try {
      return { ok: true, ...(await fn(payload || {})) };
    } catch (e) {
      return { ok: false, error: e && e.message ? e.message : String(e) };
    }
  });
}

// Spotify: sign in, now playing, play / pause / next / previous
safeIpc('phoenix:spotify-status', () => spotify.status());
safeIpc('phoenix:spotify-login', async () => {
  await spotify.login((u) => shell.openExternal(u));
  return spotify.status();
});
safeIpc('phoenix:spotify-cancel', () => (spotify.cancelLogin(), {}));
safeIpc('phoenix:spotify-logout', () => (spotify.logout(), {}));
safeIpc('phoenix:spotify-now', async () => ({ now: await spotify.nowPlaying() }));
safeIpc('phoenix:spotify-search', async (p) => ({ tracks: await spotify.search(p.query) }));
safeIpc('phoenix:spotify-play-uri', async (p) => (await spotify.playUri(p.uri), {}));
safeIpc('phoenix:spotify-control', async (p) => (await spotify.control(String(p.action), p.value), {}));

// Animated capes (ClientCapes mod, Fabric 1.21.11): the mod reads .png / .gif files from config/custom_capes.
const capesDirFor = (p) => path.join(instanceDirFor(p), 'config', 'custom_capes');
safeIpc('phoenix:cape-add', (p) => {
  const name = path.basename(String(p.name || '')).replace(/[^\w.\- ]+/g, '_');
  if (!/\.(png|gif)$/i.test(name)) throw new Error('Choose a .png or .gif file.');
  const buf = Buffer.from(String(p.data || ''), 'base64');
  if (buf.length < 8 || buf.length > 8 * 1024 * 1024) throw new Error('The cape file must be smaller than 8 MB.');
  const isPng = buf.slice(0, 4).toString('hex') === '89504e47';
  const isGif = buf.slice(0, 3).toString('latin1') === 'GIF';
  if (!isPng && !isGif) throw new Error('That file is not a real PNG or GIF image.');
  const dir = capesDirFor(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return { file: name };
});
const CAPE_CODE_MAX = 300 * 1024;
safeIpc('phoenix:cape-export', (p) => {
  const name = path.basename(String(p.name || ''));
  const file = path.join(capesDirFor(p), name);
  if (!/\.(png|gif)$/i.test(name) || !fs.existsSync(file)) throw new Error('Cape not found.');
  const buf = fs.readFileSync(file);
  if (buf.length > CAPE_CODE_MAX) throw new Error('This cape is too big for a code (limit 300 KB). Send the file itself.');
  return { code: 'PHXC1.' + Buffer.from(JSON.stringify({ n: name, d: buf.toString('base64') })).toString('base64url') };
});

safeIpc('phoenix:cape-import', (p) => {
  const m = String(p.code || '').trim().match(/^PHXC1\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('That is not a Purrlix cape code (it should start with PHXC1.).');
  let obj;
  try {
    obj = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
  } catch {
    throw new Error('The cape code is damaged. Copy it again.');
  }
  const name = path.basename(String(obj.n || 'cape.png')).replace(/[^\w.\- ]+/g, '_');
  const buf = Buffer.from(String(obj.d || ''), 'base64');
  const isPng = buf.slice(0, 4).toString('hex') === '89504e47';
  const isGif = buf.slice(0, 3).toString('latin1') === 'GIF';
  if (!/\.(png|gif)$/i.test(name) || buf.length < 8 || buf.length > CAPE_CODE_MAX || (!isPng && !isGif)) throw new Error('The cape code does not contain a valid cape.');
  const dir = capesDirFor(p);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), buf);
  return { file: name };
});

safeIpc('phoenix:cape-list', (p) => {
  const dir = capesDirFor(p);
  return { files: fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.(png|gif)$/i.test(f)) : [] };
});

safeIpc('phoenix:analyze-crash', (p) => manage.analyzeCrash(instanceDirFor(p), String(p.extra || '')));

safeIpc('phoenix:mods-search', async (p) => ({ results: await manage.searchProjects(p) }));
safeIpc('phoenix:mods-install', async (p) => ({ installed: await manage.installProject({ ...p, gameDir: instanceDirFor(p) }) }));
safeIpc('phoenix:client-status', (p) => {
  const dir = path.join(instanceDirFor(p), 'mods');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^(purrlix|phoenix)-client.*\.jar(\.disabled)?$/i.test(f)) : [];
  return { files };
});
safeIpc('phoenix:mods-list', async (p) => ({ items: await manage.listInstalled(instanceDirFor(p)) }));
safeIpc('phoenix:mods-check-updates', async (p) => ({ updates: await manage.checkUpdates(instanceDirFor(p), p.loader, p.mcVersion) }));
safeIpc('phoenix:mods-apply-updates', async (p) => ({ updated: await manage.applyUpdates(instanceDirFor(p), p.updates || []) }));
safeIpc('phoenix:mods-toggle', (p) => (manage.toggleFile(instanceDirFor(p), p.type, p.file, Boolean(p.enable), p.projectId), {}));
safeIpc('phoenix:mods-remove', (p) => (manage.removeFile(instanceDirFor(p), p.type, p.file, p.projectId), {}));

safeIpc('phoenix:pack-export', async (p) => {
  const picked = await dialog.showSaveDialog(mainWindow, {
    title: 'Export modpack',
    defaultPath: path.join(app.getPath('documents'), `${String(p.name || 'Purrlix-Pack').replace(/[^\w.-]+/g, '_')}.mrpack`),
    filters: [{ name: 'Modrinth modpack', extensions: ['mrpack'] }],
  });
  if (picked.canceled || !picked.filePath) return { cancelled: true };
  const res = await manage.exportMrpack({ gameDir: instanceDirFor(p), dest: picked.filePath, name: p.name, mcVersion: p.mcVersion, loader: p.loader });
  shell.showItemInFolder(picked.filePath);
  return { ...res, file: picked.filePath };
});

safeIpc('phoenix:pack-import', async (p) => {
  const picked = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a modpack',
    filters: [{ name: 'Modrinth modpack', extensions: ['mrpack', 'zip'] }],
    properties: ['openFile'],
  });
  if (picked.canceled || !picked.filePaths[0]) return { cancelled: true };
  const res = await manage.importMrpack(picked.filePaths[0], instanceDirFor(p));
  return res;
});

safeIpc('phoenix:backups-list', (p) => ({ backups: manage.listBackups(backupsDirFor(p)) }));
safeIpc('phoenix:backup-world', (p) => ({ file: manage.backupWorld(savesDirFor(p), String(p.world), backupsDirFor(p), 5) }));
safeIpc('phoenix:backup-restore', (p) => {
  const file = path.join(backupsDirFor(p), path.basename(String(p.file)));
  if (!fs.existsSync(file)) throw new Error('Backup file not found.');
  const res = worlds.installWorldZip(file, savesDirFor(p), String(p.world || 'Restored world'));
  return { name: res.name };
});
safeIpc('phoenix:backup-delete', (p) => (fs.rmSync(path.join(backupsDirFor(p), path.basename(String(p.file))), { force: true }), {}));
safeIpc('phoenix:backups-open', async (p) => {
  const dir = backupsDirFor(p);
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return {};
});

safeIpc('phoenix:clone-instance', (p) => {
  const clean = (v) => String(v).replace(/[^\w.-]+/g, '_');
  const from = path.join(dataDir(p.dataDir), 'instances', clean(p.fromId));
  const to = path.join(dataDir(p.dataDir), 'instances', clean(p.toId));
  if (fs.existsSync(to)) throw new Error('Target profile folder already exists.');
  manage.duplicateFolder(from, to);
  return {};
});

safeIpc('phoenix:screenshots-list', (p) => {
  const shots = manage.listScreenshots(instanceDirFor(p), 60).map((s) => {
    let thumb = '';
    try {
      thumb = nativeImage.createFromPath(s.file).resize({ width: 320 }).toDataURL();
    } catch {
      /* unreadable image */
    }
    return { name: s.name, time: s.t, thumb };
  });
  return { shots };
});
safeIpc('phoenix:screenshot-open', async (p) => {
  const file = path.join(instanceDirFor(p), 'screenshots', path.basename(String(p.name)));
  if (fs.existsSync(file)) await shell.openPath(file);
  return {};
});
safeIpc('phoenix:screenshot-delete', (p) => (fs.rmSync(path.join(instanceDirFor(p), 'screenshots', path.basename(String(p.name))), { force: true }), {}));
safeIpc('phoenix:screenshots-open-folder', async (p) => {
  const dir = path.join(instanceDirFor(p), 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return {};
});

safeIpc('phoenix:copy-keybinds', (p) => {
  const clean = (v) => String(v).replace(/[^\w.-]+/g, '_');
  const root = path.join(dataDir(p.dataDir), 'instances');
  const n = manage.copyKeybinds(p.fromId ? path.join(root, clean(p.fromId)) : null, path.join(root, clean(p.toId)));
  return { count: n };
});

safeIpc('phoenix:upload-skin', async (p) => {
  const png = Buffer.from(String(p.skinPng || ''), 'base64');
  if (png.length < 100 || png.length > 200 * 1024) throw new Error('Invalid skin image.');
  await microsoft.uploadSkin(String(p.uuid), png, p.variant);
  return {};
});

// Looks up a Minecraft username and returns that player's real skin (PNG data URL) so a new profile starts with it.
safeIpc('phoenix:fetch-skin', async (_e, name) => {
  const n = String(name || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) return { found: false };
  try {
    const a = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(n)}`);
    if (!a.ok) return { found: false };
    const { id } = await a.json();
    const b = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`);
    if (!b.ok) return { found: false };
    const prof = await b.json();
    const tex = (prof.properties || []).find((x) => x.name === 'textures');
    if (!tex) return { found: false, uuid: id };
    const parsed = JSON.parse(Buffer.from(tex.value, 'base64').toString());
    const skin = parsed.textures && parsed.textures.SKIN;
    if (!skin || !skin.url) return { found: false, uuid: id };
    const png = await fetch(skin.url);
    if (!png.ok) return { found: false, uuid: id };
    const buf = Buffer.from(await png.arrayBuffer());
    return { found: true, uuid: id, name: prof.name, model: skin.metadata && skin.metadata.model === 'slim' ? 'slim' : 'classic', dataUrl: 'data:image/png;base64,' + buf.toString('base64') };
  } catch {
    return { found: false };
  }
});

safeIpc('phoenix:news', async () => ({ news: await manage.fetchNews(config.GITHUB_REPO) }));

// Downloads the newest Setup .exe from the latest GitHub release, starts it and closes the launcher.
safeIpc('phoenix:install-update', async () => {
  const rel = await manage.getJson(`https://api.github.com/repos/${config.GITHUB_REPO}/releases/latest`);
  const asset = (rel.assets || []).find((a) => /Setup.*\.exe$/i.test(a.name));
  if (!asset) throw new Error('This release has no installer attached yet. Open the release page and download it manually.');
  const dest = path.join(os.tmpdir(), asset.name.replace(/[^\w.-]+/g, '_'));
  await manage.downloadTo(asset.browser_download_url, dest);
  const { spawn } = require('child_process');
  spawn(dest, [], { detached: true, stdio: 'ignore' }).unref();
  quitting = true;
  setTimeout(() => app.quit(), 600);
  return { file: dest };
});

// ---------------------------------------------------------------- screen recorder

function recordingsDir() {
  return path.join(app.getPath('videos'), 'Purrlix Recordings');
}

function setupRecorder() {
  // Let the renderer record the primary screen without a picker dialog (with system audio on Windows).
  session.defaultSession.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'] })
        .then((sources) => {
          if (!sources.length) return callback({});
          const wantAudio = process.platform === 'win32';
          callback(wantAudio ? { video: sources[0], audio: 'loopback' } : { video: sources[0] });
        })
        .catch(() => callback({}));
    },
    { useSystemPicker: false }
  );
  try {
    globalShortcut.register('F9', () => send('phoenix:recorder-toggle', null));
  } catch {
    /* shortcut may be taken by another app */
  }
}

// The recorder asks for the screen id here and captures it with getUserMedia: that works from the F9 hotkey too,
// while getDisplayMedia needs a click inside the launcher window (so F9 during the game did nothing).
ipcMain.handle('phoenix:recorder-source', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    return sources.length ? { ok: true, id: sources[0].id } : { ok: false, error: 'No screen found to record.' };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// Pop-up so the player sees "recording started / saved" even while the launcher is hidden behind the game.
ipcMain.handle('phoenix:recorder-note', (_e, text) => {
  try {
    if (Notification.isSupported()) new Notification({ title: 'Purrlix Recorder', body: String(text).slice(0, 200), silent: true }).show();
  } catch {
    /* optional */
  }
  return { ok: true };
});

ipcMain.handle('phoenix:save-recording', async (_e, data) => {
  try {
    const dir = recordingsDir();
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(dir, `Purrlix-${stamp}.webm`);
    fs.writeFileSync(file, Buffer.from(data));
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

safeIpc('phoenix:perf-report', (p) => ({
  text: require('./perf.cjs').build({ gameDir: instanceDirFor(p), instance: p.instance, launcherVersion: app.getVersion() }),
}));

ipcMain.handle('phoenix:list-recordings', () => {
  try {
    const dir = recordingsDir();
    if (!fs.existsSync(dir)) return { ok: true, files: [] };
    const files = fs
      .readdirSync(dir)
      .filter((f) => /\.webm$/i.test(f))
      .map((f) => {
        const st = fs.statSync(path.join(dir, f));
        return { name: f, sizeMb: Math.round((st.size / 1048576) * 10) / 10, time: st.mtimeMs };
      })
      .sort((a, b) => b.time - a.time);
    return { ok: true, files };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err), files: [] };
  }
});

// open / show in folder / delete one recording; the name is checked so only files inside the recordings folder can be touched
ipcMain.handle('phoenix:recording-action', async (_e, p) => {
  try {
    const dir = recordingsDir();
    const name = path.basename(String((p && p.name) || ''));
    const file = path.join(dir, name);
    if (!/\.webm$/i.test(name) || path.dirname(file) !== dir || !fs.existsSync(file)) return { ok: false, error: 'Recording not found.' };
    if (p.action === 'open') {
      const err = await shell.openPath(file);
      return err ? { ok: false, error: err } : { ok: true };
    }
    if (p.action === 'show') {
      shell.showItemInFolder(file);
      return { ok: true };
    }
    if (p.action === 'delete') {
      fs.rmSync(file, { force: true });
      return { ok: true };
    }
    return { ok: false, error: 'Unknown action.' };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

ipcMain.handle('phoenix:open-recordings', async () => {
  const dir = recordingsDir();
  fs.mkdirSync(dir, { recursive: true });
  await shell.openPath(dir);
  return { ok: true };
});

// ---------------------------------------------------------------- app lifecycle

// The app was renamed to Purrlix, but settings, accounts and profiles live in the old "Purrlix Launcher" data folder: keep using it.
app.setPath('userData', path.join(app.getPath('appData'), 'Phoenix Launcher'));
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    microsoft.init(app.getPath('userData'), safeStorage);
    spotify.init(app.getPath('userData'), safeStorage, (u) => shell.openExternal(u));
    createTray();
    setupRecorder();
    try {
      await createWindow();
      discord.setPresence(browsingPresence());
    } catch (err) {
      dialog.showErrorBox('Purrlix Launcher could not start', String(err && err.stack ? err.stack : err));
      quitting = true;
      app.quit();
    }
  });
}

app.on('before-quit', () => {
  quitting = true;
  try { globalShortcut.unregisterAll(); } catch {}
  discord.shutdown();
});

// Keep running in the tray when all windows are hidden/closed
app.on('window-all-closed', () => {});
