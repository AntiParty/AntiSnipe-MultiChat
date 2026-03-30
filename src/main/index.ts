import { app, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import log from 'electron-log'
import { settingsStore } from './store/SettingsStore'
import { registerIpcHandlers } from './ipc/handlers'
import { broadcaster } from './ipc/broadcaster'
import { platformManager } from './services/PlatformManager'
import { emoteCacheManager } from './emotes/EmoteCacheManager'
import { autoUpdaterManager } from './updater/AutoUpdater'
import { twitchAuth } from './auth/TwitchAuth'
import { youtubeAuth } from './auth/YouTubeAuth'
import { CUSTOM_PROTOCOL } from '../shared/constants'

log.initialize({ preload: true })

const isDev = !app.isPackaged

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
  process.exit(0)
}

// Register custom protocol for OAuth callbacks
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL, process.execPath, [process.argv[1]])
  }
} else {
  app.setAsDefaultProtocolClient(CUSTOM_PROTOCOL)
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

// Handle OAuth callback on Windows (second-instance)
app.on('second-instance', (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
  const url = argv.find(arg => arg.startsWith(`${CUSTOM_PROTOCOL}://`))
  if (url) handleProtocolUrl(url)
})

// Handle OAuth callback on macOS
app.on('open-url', (_event, url) => {
  handleProtocolUrl(url)
})

function handleProtocolUrl(url: string): void {
  log.info('OAuth protocol URL received:', url)
  if (url.includes('/auth/twitch')) {
    twitchAuth.handleCallback(url)
  } else if (url.includes('/auth/youtube')) {
    youtubeAuth.handleCallback(url)
  }
}

app.on('window-all-closed', () => {
  emoteCacheManager.flushToDisk()
  if (process.platform !== 'darwin') app.quit()
})
