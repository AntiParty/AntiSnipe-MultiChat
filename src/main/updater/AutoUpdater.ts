import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { broadcaster } from '../ipc/broadcaster'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { UPDATE_CHECK_INTERVAL_MS } from '../../shared/constants'

const isDev = !app.isPackaged

class AutoUpdaterManager {
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private started = false

  start(): void {
    if (isDev) {
      log.info('Auto-updater disabled in dev mode')
      return
    }

    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', info => {
      log.info('Update available:', info.version)
      broadcaster.send(RENDERER_CHANNELS.UPDATE_AVAILABLE, { version: info.version })
    })

    autoUpdater.on('update-not-available', () => {
      log.info('App is up to date')
      broadcaster.send(RENDERER_CHANNELS.UPDATE_NOT_AVAILABLE, {})
    })

    autoUpdater.on('update-downloaded', info => {
      log.info('Update downloaded:', info.version)
      broadcaster.send(RENDERER_CHANNELS.UPDATE_DOWNLOADED, { version: info.version })
    })

    autoUpdater.on('error', err => {
      log.error('Auto-updater error:', err)
      broadcaster.send(RENDERER_CHANNELS.UPDATE_ERROR, { message: err.message })
    })

    this.started = true

    // Initial check after 30 seconds
    setTimeout(() => this.checkForUpdates(), 30_000)

    // Periodic checks every 4 hours
    this.checkTimer = setInterval(() => this.checkForUpdates(), UPDATE_CHECK_INTERVAL_MS)
  }

  async checkForUpdates(): Promise<void> {
    if (isDev) {
      broadcaster.send(RENDERER_CHANNELS.UPDATE_NOT_AVAILABLE, {})
      return
    }
    if (!this.started) {
      log.warn('checkForUpdates called before start()')
      return
    }
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      log.error('Update check failed:', err)
      broadcaster.send(RENDERER_CHANNELS.UPDATE_ERROR, { message: String(err) })
    }
  }

  installAndRestart(): void {
    autoUpdater.quitAndInstall()
  }

  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }
}

export const autoUpdaterManager = new AutoUpdaterManager()
