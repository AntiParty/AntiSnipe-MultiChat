import { BrowserWindow } from 'electron'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { BROADCAST_INTERVAL_MS, BROADCAST_BATCH_SIZE } from '../../shared/constants'
import { settingsStore } from '../store/SettingsStore'
import type { NormalizedMessage } from '../../shared/types/message'

// Hard cap on buffered messages — beyond this, oldest are dropped. Protects
// memory when chat is faster than the renderer or the window is briefly gone.
const MAX_QUEUE_SIZE = 2000

class Broadcaster {
  private queue: NormalizedMessage[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private win: BrowserWindow | null = null

  setWindow(window: BrowserWindow): void {
    this.win = window
  }

  enqueue(messages: NormalizedMessage | NormalizedMessage[]): void {
    const arr = Array.isArray(messages) ? messages : [messages]
    this.queue.push(...arr)
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue.splice(0, this.queue.length - MAX_QUEUE_SIZE)
    }
    // Flash taskbar when a mention arrives (if window not already focused)
    if (this.win && !this.win.isDestroyed()) {
      const settings = settingsStore.get()
      if (settings.flashOnMention && !this.win.isFocused() && arr.some(m => m.isMention)) {
        this.win.flashFrame(true)
      }
    }
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), BROADCAST_INTERVAL_MS)
    }
  }

  private flush(): void {
    this.timer = null
    if (!this.win || this.win.isDestroyed() || !this.win.webContents) {
      // No renderer to deliver to — drop the buffer instead of hoarding it
      this.queue = []
      return
    }

    // One capped batch per tick so a spam burst is spread across frames
    // instead of landing on the renderer as a single giant update
    const batch = this.queue.splice(0, BROADCAST_BATCH_SIZE)
    if (batch.length > 0) {
      try {
        this.win.webContents.send(RENDERER_CHANNELS.MESSAGE_BATCH, batch)
      } catch {
        // window may have been destroyed between checks
      }
    }

    if (this.queue.length > 0) {
      this.timer = setTimeout(() => this.flush(), BROADCAST_INTERVAL_MS)
    }
  }

  send<T>(channel: string, payload: T): void {
    if (!this.win || this.win.isDestroyed()) return
    try {
      this.win.webContents.send(channel, payload)
    } catch {
      // ignore
    }
  }
}

export const broadcaster = new Broadcaster()
