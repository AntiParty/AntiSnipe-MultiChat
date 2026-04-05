import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import type { UserCardPayload } from '../../shared/types/ipc'

const CARD_W = 280
const CARD_H = 540

/**
 * Opens the user card as a standalone frameless always-on-top window.
 * The window is positioned near the cursor and can be dragged anywhere
 * on the screen (including outside the main app window) via native OS drag.
 */
export function openUserCardWindow(payload: UserCardPayload): void {
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { x: wa_x, y: wa_y, width: wa_w, height: wa_h } = display.workArea

  // Anchor below/right of cursor, clamped to the display work area
  const x = Math.max(wa_x, Math.min(cursor.x, wa_x + wa_w - CARD_W))
  const y = Math.max(wa_y, Math.min(cursor.y + 4, wa_y + wa_h - CARD_H))

  const win = new BrowserWindow({
    width: CARD_W,
    height: CARD_H,
    x,
    y,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    resizable: false,
    movable: true,      // native OS drag — works anywhere on screen
    skipTaskbar: true,
    backgroundColor: '#1a1a25',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  const query: Record<string, string> = {
    mode: 'usercard',
    userId: payload.userId,
    login: payload.login,
    channelId: payload.channelId
  }

  const isDev = !app.isPackaged
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    const params = new URLSearchParams(query).toString()
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?${params}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  win.once('ready-to-show', () => win.show())
}
