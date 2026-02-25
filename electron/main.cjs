const path = require('node:path')
const fs = require('node:fs/promises')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { pathToFileURL } = require('node:url')
const { app, BrowserWindow, ipcMain } = require('electron')

const isDev = !!process.env.VITE_DEV_SERVER_URL
const isPacked = app.isPackaged
const apiPort = Number(process.env.EMBERS_API_PORT || '4010')
const execFileAsync = promisify(execFile)

let apiServer = null

function toPsLiteral(value) {
  return String(value ?? '').replace(/'/g, "''")
}

async function resolveShortcutTargetExe() {
  if (isPacked) {
    return app.getPath('exe')
  }

  const appPath = app.getAppPath()
  const packageJsonPath = path.join(appPath, 'package.json')
  let version = '1.0.0'

  try {
    const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf-8')
    const parsed = JSON.parse(packageJsonRaw)
    if (parsed?.version) version = String(parsed.version)
  } catch {
    // keep fallback
  }

  const candidates = [
    path.join(appPath, 'release', `Embers-portable-${version}`, 'Embers.exe'),
    path.join(appPath, 'release', 'Embers-win32-x64', 'Embers.exe'),
    path.join(appPath, 'release', 'win-unpacked', 'Embers.exe'),
    path.join(appPath, 'Embers.exe'),
  ]

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate
  }

  throw new Error('Unable to find Embers.exe to create Start Menu shortcut.')
}

async function createStartMenuShortcut() {
  if (process.platform !== 'win32') {
    throw new Error('Start Menu shortcut creation is only supported on Windows.')
  }

  const targetPath = await resolveShortcutTargetExe()
  const workingDirectory = path.dirname(targetPath)
  const startMenuDir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  await fs.mkdir(startMenuDir, { recursive: true })
  const shortcutPath = path.join(startMenuDir, 'Embers.lnk')

  const psCommand = [
    '$WshShell = New-Object -ComObject WScript.Shell',
    `$Shortcut = $WshShell.CreateShortcut('${toPsLiteral(shortcutPath)}')`,
    `$Shortcut.TargetPath = '${toPsLiteral(targetPath)}'`,
    `$Shortcut.WorkingDirectory = '${toPsLiteral(workingDirectory)}'`,
    `$Shortcut.IconLocation = '${toPsLiteral(targetPath)},0'`,
    "$Shortcut.Description = 'Embers desktop app'",
    '$Shortcut.Save()',
  ].join('; ')

  await execFileAsync(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCommand],
    { windowsHide: true }
  )

  return { shortcutPath, targetPath }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function startApiServer() {
  const appPath = app.getAppPath()
  const isAsarBundle = appPath.toLowerCase().includes('.asar')
  const dataDir = isAsarBundle
    ? path.join(process.resourcesPath, 'data')
    : path.join(appPath, 'data')
  await fs.mkdir(dataDir, { recursive: true })
  process.env.EMBERS_DATA_DIR = dataDir

  const appModuleUrl = pathToFileURL(path.join(app.getAppPath(), 'server', 'app.js')).href
  const apiModule = await import(appModuleUrl)
  apiServer = await apiModule.startEmbersApi(apiPort)
}

function createWindow() {
  const iconPath = path.join(app.getAppPath(), 'assets', 'icons', 'embers.png')

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
  ipcMain.handle('embers:create-start-menu-shortcut', async () => {
    return createStartMenuShortcut()
  })

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
  ipcMain.removeHandler('embers:create-start-menu-shortcut')
  if (apiServer) {
    apiServer.close()
  }
})
