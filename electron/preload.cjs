const { contextBridge, ipcRenderer } = require('electron')

const apiPort = Number(process.env.EMBERS_API_PORT || '4010')

contextBridge.exposeInMainWorld('embersApiBase', `http://localhost:${apiPort}`)
contextBridge.exposeInMainWorld('embersDesktop', {
	createStartMenuShortcut: () => ipcRenderer.invoke('embers:create-start-menu-shortcut'),
})
