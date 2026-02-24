const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow } = require('electron')

const isDev = !!process.env.VITE_DEV_SERVER_URL
const isPacked = app.isPackaged
const apiPort = Number(process.env.EMBERS_API_PORT || '4010')

let apiServer = null

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function resolvePreferredDataDir(userDataDir) {
  // Development: use workspace data directory if available
  if (isDev) {
    const workspaceDataDir = path.join('C:', 'dev', 'development', 'Embers', 'data')
    if (await pathExists(workspaceDataDir)) {
      return workspaceDataDir
    }
  }

  // Packed app: check for portable data dir first (same folder as exe)
  if (isPacked) {
    const portableDataDir = path.join(path.dirname(app.getPath('exe')), 'data')
    if (await pathExists(portableDataDir)) {
      return portableDataDir
    }
  }

  // Fall back to user data directory
  return path.join(userDataDir, 'Embers', 'data')
}

async function startApiServer() {
  const userDataDir = app.getPath('userData')
  const dataDir = await resolvePreferredDataDir(userDataDir)
  await fs.mkdir(dataDir, { recursive: true })
  process.env.EMBERS_DATA_DIR = dataDir

  const appModuleUrl = pathToFileURL(path.join(app.getAppPath(), 'server', 'app.js')).href
  const apiModule = await import(appModuleUrl)
  apiServer = await apiModule.startEmbersApi(apiPort)
}

function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'assets', 'icons', 'pixcope-icon.png')

  const mainWindow = new BrowserWindow({
    width: 1580,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#f1f5fb',
    icon: iconPath,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'))
  }
}

app.whenReady().then(async () => {
  await startApiServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (apiServer) {
    apiServer.close()
  }
})
