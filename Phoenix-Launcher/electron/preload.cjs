const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, cb) {
  const handler = (_event, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('phoenixDesktop', {
  isElectron: true,
  getInfo: () => ipcRenderer.invoke('phoenix:get-info'),
  pickJavaExecutable: () => ipcRenderer.invoke('phoenix:pick-java'),
  detectJava: (dataDir) => ipcRenderer.invoke('phoenix:detect-java', dataDir),
  openFolder: (payload) => ipcRenderer.invoke('phoenix:open-folder', payload),
  launchInstance: (payload) => ipcRenderer.invoke('phoenix:launch-instance', payload),
  onProgress: (cb) => subscribe('phoenix:progress', cb),
  onExit: (cb) => subscribe('phoenix:exit', cb),
});
