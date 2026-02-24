const { contextBridge } = require('electron')

const apiPort = Number(process.env.EMBERS_API_PORT || '4010')

contextBridge.exposeInMainWorld('embersApiBase', `http://localhost:${apiPort}`)
