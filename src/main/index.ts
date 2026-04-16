import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { BrowserWindow, app, protocol, shell } from 'electron'
import icon from '@resources/icon.png?asset'
import { AppConfigStore } from './infrastructure/config/app-config-store'
import { logMediaBinaryPreflight } from './infrastructure/media/media-binary-resolver'
import { registerLocalMediaProtocolHandler } from './infrastructure/media/register-local-media-protocol'
import { registerAutoUpdater } from './infrastructure/update/register-auto-updater'
import { registerIpcHandlers } from './ipc/register-ipc'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: false,
    title: 'Cloud Tools',
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.cloudtools.desktop')

  registerLocalMediaProtocolHandler()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const configStore = new AppConfigStore(app.getPath('userData'))
  logMediaBinaryPreflight(configStore.read())
  registerIpcHandlers({
    getMainWindow: () => mainWindow,
    configStore
  })

  createWindow()

  registerAutoUpdater(() => mainWindow)

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
