import { ipcMain, shell } from 'electron'
import { openUserCardWindow } from '../windows/userCardWindow'
import log from 'electron-log'
import { MAIN_CHANNELS, RENDERER_CHANNELS } from '../../shared/types/ipc'
import { broadcaster } from './broadcaster'
import { settingsStore } from '../store/SettingsStore'
import { platformManager } from '../services/PlatformManager'
import { getCurrentSong } from '../services/media'
import { emoteCacheManager } from '../emotes/EmoteCacheManager'
import { pluginManager } from '../services/PluginManager'
import { autoUpdaterManager } from '../updater/AutoUpdater'
import { twitchAuth } from '../auth/TwitchAuth'
import { youtubeAuth } from '../auth/YouTubeAuth'
import { tokenStore } from '../auth/TokenStore'
import type { ConnectChannelPayload, DisconnectChannelPayload } from '../../shared/types/channel'
import type {
  SendMessagePayload,
  AuthLogoutPayload,
  FetchEmotesPayload,
  ShellOpenPayload,
  ModActionPayload,
  SavePluginPayload,
  CreatePluginPayload,
  TogglePluginPayload,
  UserCardPayload,
  PinMessagePayload,
  UnpinMessagePayload,
  SevenTvCosmeticsPayload,
  SevenTvCosmeticsResult,
  GetViewerListPayload
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

  // Mod status hydration — renderer calls this on startup to recover statuses
  // that were broadcast before the IPC listener was registered
  ipcMain.handle(MAIN_CHANNELS.GET_SELF_MOD_STATUSES, () => {
    return platformManager.getSelfModStatuses()
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

  // Media info (Windows: Spotify window title; cross-platform fallback = empty)
  ipcMain.handle(MAIN_CHANNELS.MEDIA_GET_CURRENT, () => getCurrentSong())

  // Plugins
  ipcMain.handle(MAIN_CHANNELS.PLUGIN_APPLY, (_e, pmsg) => {
    return pluginManager.applyToPluginMessage(pmsg)
  })

  ipcMain.handle(MAIN_CHANNELS.GET_PLUGINS, () => {
    return pluginManager.getAll()
  })

  ipcMain.handle(MAIN_CHANNELS.SAVE_PLUGIN, (_e, payload: SavePluginPayload) => {
    return pluginManager.save(payload.id, payload.code)
  })

  ipcMain.handle(MAIN_CHANNELS.CREATE_PLUGIN, (_e, payload: CreatePluginPayload) => {
    return pluginManager.create(payload.filename, payload.code)
  })

  ipcMain.handle(MAIN_CHANNELS.OPEN_PLUGINS_FOLDER, () => {
    shell.openPath(pluginManager.getPluginsDir())
  })

  ipcMain.handle(MAIN_CHANNELS.RELOAD_PLUGINS, () => {
    pluginManager.load()
    return pluginManager.getAll()
  })

  ipcMain.handle(MAIN_CHANNELS.TOGGLE_PLUGIN, (_e, payload: TogglePluginPayload) => {
    return pluginManager.toggleEnabled(payload.id, payload.enabled)
  })

  ipcMain.handle(MAIN_CHANNELS.GET_VIEWER_COUNTS, () => {
    return platformManager.getViewerCounts()
  })

  ipcMain.handle(MAIN_CHANNELS.GET_STREAM_INFO, () => {
    return platformManager.getStreamInfo()
  })

  ipcMain.handle(MAIN_CHANNELS.GET_RECENT_MESSAGES, (_e, payload: { channelId: string }) => {
    return platformManager.getRecentMessages(payload.channelId)
  })

  ipcMain.handle(MAIN_CHANNELS.GET_USER_CARD, (_e, payload: UserCardPayload) => {
    return platformManager.getUserCard(payload)
  })

  // Twitch pinned messages
  ipcMain.handle(MAIN_CHANNELS.GET_PINNED_MESSAGE, async (_e, payload: { channelId: string }) => {
    try {
      return await platformManager.getPinnedMessage(payload.channelId)
    } catch (err) {
      log.warn('getPinnedMessage failed:', err)
      return null
    }
  })

  ipcMain.handle(MAIN_CHANNELS.PIN_MESSAGE, async (_e, payload: PinMessagePayload) => {
    await platformManager.pinMessage(payload.channelId, payload.messageId, payload.durationSeconds)
  })

  ipcMain.handle(MAIN_CHANNELS.UPDATE_PIN, async (_e, payload: PinMessagePayload) => {
    await platformManager.updatePinDuration(payload.channelId, payload.messageId, payload.durationSeconds)
  })

  ipcMain.handle(MAIN_CHANNELS.UNPIN_MESSAGE, async (_e, payload: UnpinMessagePayload) => {
    await platformManager.unpinMessage(payload.channelId, payload.messageId)
  })

  ipcMain.handle(MAIN_CHANNELS.GET_VIEWER_LIST, (_e, payload: GetViewerListPayload) => {
    return platformManager.getViewerList(payload.channelId)
  })

  ipcMain.handle(MAIN_CHANNELS.OPEN_USER_CARD_WINDOW, (_e, payload: UserCardPayload) => {
    openUserCardWindow(payload)
  })

  // Updater
  ipcMain.handle(MAIN_CHANNELS.UPDATE_CHECK, async () => {
    await autoUpdaterManager.checkForUpdates()
  })

  ipcMain.handle(MAIN_CHANNELS.UPDATE_INSTALL, () => {
    autoUpdaterManager.installAndRestart()
  })

  // 7TV cosmetics — fetched from main process to avoid CSP issues in renderer
  ipcMain.handle(MAIN_CHANNELS.FETCH_7TV_COSMETICS, async (_e, payload: SevenTvCosmeticsPayload): Promise<SevenTvCosmeticsResult> => {
    const empty: SevenTvCosmeticsResult = { badge: null, paint: null }
    try {
      const connRes = await fetch(`https://7tv.io/v3/users/twitch/${payload.twitchUserId}`, {
        headers: { Accept: 'application/json' }
      })
      if (!connRes.ok) return empty
      const conn = await connRes.json() as any

      const user = conn?.user
      if (!user?.id) return empty

      const style = user.style ?? {}
      const activeBadgeId: string | undefined = style.badge_id
      const activePaintId: string | undefined = style.paint_id
      const styleColor: number | undefined = style.color

      // Badge: construct CDN URL directly from the ID — no second API call needed
      const badge: SevenTvCosmeticsResult['badge'] = activeBadgeId
        ? {
            id: activeBadgeId,
            imageUrl: `https://cdn.7tv.app/badge/${activeBadgeId}/2x.webp`,
            tooltip: '7TV Badge'
          }
        : null

      // Paint: use the solid color from user.style.color as a base.
      // function=NONE + color triggers the solid-color path in paintToStyle().
      const paint: SevenTvCosmeticsResult['paint'] = activePaintId
        ? {
            id: activePaintId,
            name: '',
            function: 'NONE',
            color: typeof styleColor === 'number' ? styleColor : null,
            angle: 0,
            repeat: false,
            stops: []
          }
        : null

      log.info(`[7TV] userId=${payload.twitchUserId} badge=${badge?.id ?? 'none'} paint=${paint?.id ?? 'none'} color=${styleColor}`)
      return { badge, paint }
    } catch (err) {
      log.error('[7TV] cosmetics fetch error:', err)
      return empty
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
