import { contextBridge, ipcRenderer, webUtils } from "electron";

contextBridge.exposeInMainWorld("ctx", {
  getVersion: () => ipcRenderer.invoke("get-version"),
  getPlatform: () => process.platform,
  getArch: () => process.arch,
  pickDirectory: () => ipcRenderer.invoke("pick-directory"),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
});
