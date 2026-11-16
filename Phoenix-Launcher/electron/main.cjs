const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage, safeStorage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalServer } = require('./localServer.cjs');
const { launch, stopLaunch, detectJavas } = require('./launcher.cjs');
const discord = require('./discord.cjs');
const microsoft = require('./microsoft.cjs');

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

ipcMain.handle('phoenix:presence', (_e, activity) => {
  discord.setPresence(activity || null);
});

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

    const result = await launch(
      { ...payload, auth, dataDir: dataDir(payload.dataDir) },
      {
        emit: (evt) => send('phoenix:progress', evt),
        onExit: (info) => {
          running.delete(info.instanceId);
          send('phoenix:exit', info);
          discord.setPresence({ details: 'In the launcher', state: payload.instance.name });
        },
      }
    );
    running.set(id, result.pid);
    discord.setPresence({
      details: `Playing Minecraft ${payload.instance.mcVersion}`,
      state: `${payload.instance.name} (${payload.instance.loader})`,
      startedAt: Date.now(),
    });
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

ipcMain.handle('phoenix:stop-instance', (_e, id) => ({ ok: stopLaunch(id) }));

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
      discord.setPresence({ details: 'In the launcher', state: 'Choosing a profile' });
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
