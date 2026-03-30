import { autoUpdater } from 'electron-updater'
import log from 'electron-log'
import { broadcaster } from '../ipc/broadcaster'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { UPDATE_CHECK_INTERVAL_MS } from '../../shared/constants'

class AutoUpdaterManager {
  private checkTimer: ReturnType<typeof setInterval> | null = null

  start(): void {
    autoUpdater.logger = log
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', info => {
      log.info('Update available:', info.version)
      broadcaster.send(RENDERER_CHANNELS.UPDATE_AVAILABLE, { version: info.version })
    })

    autoUpdater.on('update-downloaded', info => {
      log.info('Update downloaded:', info.version)
      broadcaster.send(RENDERER_CHANNELS.UPDATE_DOWNLOADED, { version: info.version })
    })

    autoUpdater.on('error', err => {
      log.error('Auto-updater error:', err)
    })

    // Initial check after 30 seconds
    setTimeout(() => this.checkForUpdates(), 30_000)

    // Periodic checks
    this.checkTimer = setInterval(() => this.checkForUpdates(), UPDATE_CHECK_INTERVAL_MS)
  }

  private async checkForUpdates(): Promise<void> {
    try {
      await autoUpdater.checkForUpdatesAndNotify()
    } catch (err) {
      log.error('Update check failed:', err)
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
