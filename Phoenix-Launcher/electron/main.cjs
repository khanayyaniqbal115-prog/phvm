const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startLocalServer } = require('./localServer.cjs');
const { launch, detectJavas } = require('./launcher.cjs');

let mainWindow = null;
let localPort = null;
const running = new Map(); // instanceId -> pid

function dataDir(custom) {
  const c = typeof custom === 'string' ? custom.trim() : '';
  // Purani default "%APPDATA%\.phoenix-launcher" literal text hoti thi — usse ignore karo
  if (c && !c.includes('%')) return c;
  return path.join(app.getPath('appData'), '.phoenix-launcher');
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
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

  // Links ko system browser mein kholo, app ke andar nahi
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

  if (process.env.PHOENIX_DEV_URL) {
    await mainWindow.loadURL(process.env.PHOENIX_DEV_URL);
    return;
  }

  // Packaged app mein dist app.asar ke andar hota hai — __dirname/../dist dono jagah sahi chalta hai
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    dialog.showErrorBox(
      'Phoenix Launcher',
      'dist/index.html nahi mila. Pehle "npm run build" chalao, phir "npm run electron:dev".'
    );
    app.quit();
    return;
  }
  const { port } = await startLocalServer(distDir);
  localPort = port;
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
}

ipcMain.handle('phoenix:get-info', () => ({
  platform: process.platform,
  dataDir: dataDir(),
  version: app.getVersion(),
}));

ipcMain.handle('phoenix:pick-java', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Java executable chuno (java.exe / javaw.exe)',
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

ipcMain.handle('phoenix:launch-instance', async (_e, payload) => {
  const id = payload && payload.instance && payload.instance.id;
  if (id && running.has(id)) {
    return { ok: false, error: 'Ye instance pehle se chal raha hai.' };
  }
  if (id) running.set(id, 'starting');
  try {
    const result = await launch(
      { ...payload, dataDir: dataDir(payload.dataDir) },
      {
        emit: (evt) => send('phoenix:progress', evt),
        onExit: (info) => {
          running.delete(info.instanceId);
          send('phoenix:exit', info);
        },
      }
    );
    if (id) running.set(id, result.pid);
    return { ok: true, ...result };
  } catch (err) {
    if (id) running.delete(id);
    send('phoenix:progress', { stage: 'error', message: err.message, level: 'error' });
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() =>
    createWindow().catch((err) => {
      dialog.showErrorBox('Phoenix Launcher start nahi hua', String(err && err.stack ? err.stack : err));
      app.quit();
    })
  );
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
