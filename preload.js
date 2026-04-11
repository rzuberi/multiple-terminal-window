const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("terminalApi", {
  createTerminal: (options) => ipcRenderer.invoke("terminals:create", options),
  sendInput: (payload) => ipcRenderer.send("terminals:input", payload),
  resizeTerminal: (payload) => ipcRenderer.send("terminals:resize", payload),
  closeTerminal: (payload) => ipcRenderer.send("terminals:close", payload),
  onData: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("terminal:data", handler);
    return () => ipcRenderer.removeListener("terminal:data", handler);
  },
  onExit: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("terminal:exit", handler);
    return () => ipcRenderer.removeListener("terminal:exit", handler);
  },
});
