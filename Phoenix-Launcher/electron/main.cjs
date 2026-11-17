const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, safeStorage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalServer } = require('./localServer.cjs');
const { launch, stopLaunch, killProcessTree, detectJavas } = require('./launcher.cjs');
const discord = require('./discord.cjs');
const microsoft = require('./microsoft.cjs');
const worlds = require('./worlds.cjs');
const config = require('./config.cjs');
const os = require('os');

let mainWindow = null;
let tray = null;
let localPort = null;
let quitting = false;
let msLoginCancelled = false;
const running = new Map(); // instanceId -> 'starting' | pid

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
  tray.setToolTip('Phoenix Launcher');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open Phoenix Launcher', click: showWindow },
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
    title: 'Phoenix Launcher',
    ...(fs.existsSync(path.join(__dirname, '../phoenix.ico')) ? { icon: path.join(__dirname, '../phoenix.ico') } : {}),
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
      new Notification({ title: 'Phoenix Launcher', body: 'Still running in the background. Click the tray icon to open it, or right-click it to quit.' }).show();
    }
  });

  if (process.env.PHOENIX_DEV_URL) {
    await mainWindow.loadURL(process.env.PHOENIX_DEV_URL);
    return;
  }

  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    dialog.showErrorBox('Phoenix Launcher', 'dist/index.html was not found. Run "npm run build" first, then "npm run electron:dev".');
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
      headers: { 'User-Agent': 'PhoenixLauncher', Accept: 'application/vnd.github+json' },
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

    const startedAt = Date.now();
    let gameState = { kind: 'menu' };
    const showPlaying = () => discord.setPresence(playingPresence(payload.instance, gameState, startedAt));
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
          send('phoenix:exit', info);
          discord.setPresence(browsingPresence());
        },
      }
    );
    running.set(id, result.pid);
    showPlaying();
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

// ---------------------------------------------------------------- Discord presence text

function browsingPresence() {
  return { details: 'Browsing profiles', state: 'Phoenix Launcher' };
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

function playingPresence(instance, game, startedAt) {
  const v = instance.mcVersion;
  if (game.kind === 'single') return { details: `Playing singleplayer in Minecraft ${v}`, state: instance.name, startedAt };
  if (game.kind === 'multi') return { details: `Playing multiplayer in Minecraft ${v}`, state: `on ${game.host}`, startedAt };
  return { details: `Playing Minecraft ${v}`, state: `${instance.name} (${instance.loader})`, startedAt };
}

ipcMain.handle('phoenix:stop-instance', (_e, id) => {
  const ok = stopLaunch(id);
  // Fallback: also kill by the pid we stored, in case the engine entry is already gone.
  const pid = running.get(id);
  if (pid) killProcessTree(pid);
  return { ok: ok || Boolean(pid) };
});

// ---------------------------------------------------------------- app lifecycle

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(async () => {
    microsoft.init(app.getPath('userData'), safeStorage);
    createTray();
    try {
      await createWindow();
      discord.setPresence(browsingPresence());
    } catch (err) {
      dialog.showErrorBox('Phoenix Launcher could not start', String(err && err.stack ? err.stack : err));
      quitting = true;
      app.quit();
    }
  });
}

app.on('before-quit', () => {
  quitting = true;
  discord.shutdown();
});

// Keep running in the tray when all windows are hidden/closed
app.on('window-all-closed', () => {});
