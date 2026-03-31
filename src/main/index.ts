import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import log from 'electron-log'
import { settingsStore } from './store/SettingsStore'
import { registerIpcHandlers } from './ipc/handlers'
import { broadcaster } from './ipc/broadcaster'
import { platformManager } from './services/PlatformManager'
import { emoteCacheManager } from './emotes/EmoteCacheManager'
import { autoUpdaterManager } from './updater/AutoUpdater'


log.initialize({ preload: true })

// Disable QUIC — Chromium's HTTP/3 implementation emits spurious
// "Fails to find on path connection IDs" errors in the renderer process
// console. Since the app only needs standard WebSocket/HTTP/HTTPS, QUIC
// provides no benefit and produces noise in the logs.
app.commandLine.appendSwitch('disable-quic')

const isDev = !app.isPackaged

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const settings = settingsStore.get()
  const { x, y, width, height } = settings.windowBounds

  mainWindow = new BrowserWindow({
    width,
    height,
    x: x ?? undefined,
    y: y ?? undefined,
    minWidth: 320,
    minHeight: 400,
    frame: false,
    backgroundColor: '#0f0f17',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  broadcaster.setWindow(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.on('close', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const bounds = mainWindow.getBounds()
      settingsStore.setWindowBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      })
    }
    platformManager.disconnectAll()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const theme = settings.theme
  nativeTheme.themeSource = theme === 'system' ? 'system' : theme
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.antisnipe.multichat')

  registerIpcHandlers()
  emoteCacheManager.loadFromDisk()
  createWindow()

  // Re-connect saved channels
  const settings = settingsStore.get()
  for (const channel of settings.channels.filter(c => c.enabled)) {
    platformManager.connect({
      channelId: channel.id,
      platform: channel.platform,
      slug: channel.slug
    }).catch(err => log.error('Failed to connect channel on startup:', channel.id, err))
  }

  autoUpdaterManager.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Restore window if a second instance is launched
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

app.on('window-all-closed', () => {
  emoteCacheManager.shutdown()
  if (process.platform !== 'darwin') app.quit()
})
