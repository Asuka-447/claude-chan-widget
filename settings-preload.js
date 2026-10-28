const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('settingsApi', {
  get: () => ipcRenderer.invoke('settings:get'),
  save: settings => ipcRenderer.invoke('settings:save', settings),
  preview: sound => ipcRenderer.send('settings:preview', sound),
  close: () => ipcRenderer.send('settings:close')
})
