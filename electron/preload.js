const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("kumoDesktop", {
  isDesktop: true,
  platform: process.platform,
  startOverlay: (opts) => ipcRenderer.invoke("overlay:start", opts),
  stopOverlay: () => ipcRenderer.invoke("overlay:stop"),
});
