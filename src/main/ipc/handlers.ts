import { ipcMain, shell } from 'electron'
import log from 'electron-log'
import { MAIN_CHANNELS, RENDERER_CHANNELS } from '../../shared/types/ipc'
import { broadcaster } from './broadcaster'
import { settingsStore } from '../store/SettingsStore'
import { platformManager } from '../services/PlatformManager'
import { emoteCacheManager } from '../emotes/EmoteCacheManager'
import { twitchAuth } from '../auth/TwitchAuth'
import { youtubeAuth } from '../auth/YouTubeAuth'
import { tokenStore } from '../auth/TokenStore'
import type { ConnectChannelPayload, DisconnectChannelPayload } from '../../shared/types/channel'
import type {
  SendMessagePayload,
  AuthLogoutPayload,
  FetchEmotesPayload,
  ShellOpenPayload,
  ModActionPayload
} from '../../shared/types/ipc'

export function registerIpcHandlers(): void {
  // Channel management
  ipcMain.handle(MAIN_CHANNELS.CONNECT_CHANNEL, async (_e, payload: ConnectChannelPayload) => {
    await platformManager.connect(payload)
  })

  ipcMain.handle(MAIN_CHANNELS.DISCONNECT_CHANNEL, async (_e, payload: DisconnectChannelPayload) => {
    await platformManager.disconnect(payload.channelId)
  })

  // Chat send
  ipcMain.handle(MAIN_CHANNELS.SEND_MESSAGE, async (_e, payload: SendMessagePayload) => {
    await platformManager.sendMessage(payload.channelId, payload.message)
  })

  // Settings
  ipcMain.handle(MAIN_CHANNELS.GET_SETTINGS, () => {
    return settingsStore.get()
  })

  ipcMain.handle(MAIN_CHANNELS.SET_SETTINGS, (_e, partial) => {
    return settingsStore.set(partial)
  })

  // Auth
  ipcMain.handle(MAIN_CHANNELS.AUTH_TWITCH_START, async () => {
    await twitchAuth.startFlow()
  })

  ipcMain.handle(MAIN_CHANNELS.AUTH_YOUTUBE_START, async () => {
    await youtubeAuth.startFlow()
  })

  ipcMain.handle(MAIN_CHANNELS.AUTH_LOGOUT, async (_e, payload: AuthLogoutPayload) => {
    if (payload.platform === 'twitch' || payload.platform === 'youtube') {
      platformManager.logoutPlatform(payload.platform)
      await tokenStore.clearTokens(payload.platform)
      broadcaster.send(RENDERER_CHANNELS.AUTH_STATE_CHANGED, {
        platform: payload.platform,
        state: { status: 'unauthenticated' }
      })
    }
  })

  ipcMain.handle(MAIN_CHANNELS.GET_AUTH_STATE, () => {
    return {
      twitch: tokenStore.getAuthState('twitch'),
      youtube: tokenStore.getAuthState('youtube')
    }
  })

  // Connections
  ipcMain.handle(MAIN_CHANNELS.GET_CONNECTION_STATES, () => {
    return platformManager.getAllConnectionStates()
  })

  // Emotes
  ipcMain.handle(MAIN_CHANNELS.FETCH_EMOTES, async (_e, payload: FetchEmotesPayload) => {
    await emoteCacheManager.fetchForChannel(payload)
  })

  // Mod actions
  ipcMain.handle(MAIN_CHANNELS.MOD_ACTION, async (_e, payload: ModActionPayload) => {
    try {
      await platformManager.modAction(payload)
    } catch (err) {
      log.error('Mod action failed:', payload.action, err)
      throw err
    }
  })

  // Shell
  ipcMain.handle(MAIN_CHANNELS.SHELL_OPEN_EXTERNAL, async (_e, payload: ShellOpenPayload) => {
    await shell.openExternal(payload.url)
  })

  // Window controls
  ipcMain.handle(MAIN_CHANNELS.WINDOW_MINIMIZE, e => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    win?.minimize()
  })

  ipcMain.handle(MAIN_CHANNELS.WINDOW_MAXIMIZE, e => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle(MAIN_CHANNELS.WINDOW_CLOSE, e => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    win?.close()
  })

  ipcMain.handle(MAIN_CHANNELS.WINDOW_IS_MAXIMIZED, e => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    return win?.isMaximized() ?? false
  })
}
