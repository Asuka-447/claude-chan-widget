const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('chanApi', {
  onUsage: fn => ipcRenderer.on('usage', (_e, data) => fn(data)),
  onStatus: fn => ipcRenderer.on('status', (_e, data) => fn(data)),
  onSide: fn => ipcRenderer.on('side', (_e, side) => fn(side)),
  onSettings: fn => ipcRenderer.on('settings', (_e, value) => fn(value)),
  onPreview: fn => ipcRenderer.on('preview', (_e, value) => fn(value)),
  drag: (dx, dy) => ipcRenderer.send('drag', { dx, dy }),
  drop: () => ipcRenderer.send('drop'),
  menu: () => ipcRenderer.send('menu'),
  solid: hit => ipcRenderer.send('solid', hit)
})
