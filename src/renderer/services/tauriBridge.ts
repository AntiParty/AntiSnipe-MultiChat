import type { ChatBridge, ChatBridgeEventMap, ChatBridgeInvokeMap, MainChannel, RendererChannel } from '../../shared/types/ipc'
import { MAIN_CHANNELS } from '../../shared/types/ipc'

type TauriInvoke = <T>(command: string, payload?: unknown) => Promise<T>
type TauriUnlisten = () => void
type TauriEvent<T> = { payload: T }
type TauriListen = <T>(event: string, handler: (event: TauriEvent<T>) => void) => Promise<TauriUnlisten>

export interface TauriBridgeDependencies {
  invoke: TauriInvoke
  listen: TauriListen
}

const COMMAND_MAP: Record<MainChannel, string> = {
  [MAIN_CHANNELS.CONNECT_CHANNEL]: 'channel_connect',
  [MAIN_CHANNELS.DISCONNECT_CHANNEL]: 'channel_disconnect',
  [MAIN_CHANNELS.SEND_MESSAGE]: 'chat_send',
  [MAIN_CHANNELS.GET_SETTINGS]: 'settings_get',
  [MAIN_CHANNELS.SET_SETTINGS]: 'settings_set',
  [MAIN_CHANNELS.AUTH_TWITCH_START]: 'auth_twitch_start',
  [MAIN_CHANNELS.AUTH_YOUTUBE_START]: 'auth_youtube_start',
  [MAIN_CHANNELS.AUTH_LOGOUT]: 'auth_logout',
  [MAIN_CHANNELS.GET_AUTH_STATE]: 'auth_get_state',
  [MAIN_CHANNELS.GET_CONNECTION_STATES]: 'connections_get_all',
  [MAIN_CHANNELS.FETCH_EMOTES]: 'emotes_fetch',
  [MAIN_CHANNELS.MOD_ACTION]: 'mod_action',
  [MAIN_CHANNELS.GET_SELF_MOD_STATUSES]: 'mod_get_self_statuses',
  [MAIN_CHANNELS.MEDIA_GET_CURRENT]: 'media_get_current',
  [MAIN_CHANNELS.PLUGIN_APPLY]: 'plugins_apply',
  [MAIN_CHANNELS.GET_PLUGINS]: 'plugins_get_all',
  [MAIN_CHANNELS.SAVE_PLUGIN]: 'plugins_save',
  [MAIN_CHANNELS.CREATE_PLUGIN]: 'plugins_create',
  [MAIN_CHANNELS.OPEN_PLUGINS_FOLDER]: 'plugins_open_folder',
  [MAIN_CHANNELS.RELOAD_PLUGINS]: 'plugins_reload',
  [MAIN_CHANNELS.TOGGLE_PLUGIN]: 'plugins_toggle',
  [MAIN_CHANNELS.GET_VIEWER_COUNTS]: 'streams_viewer_counts',
  [MAIN_CHANNELS.GET_VIEWER_LIST]: 'viewers_get_list',
  [MAIN_CHANNELS.GET_RECENT_MESSAGES]: 'chat_get_recent_messages',
  [MAIN_CHANNELS.GET_USER_CARD]: 'twitch_get_user_card',
  [MAIN_CHANNELS.OPEN_USER_CARD_WINDOW]: 'usercard_open_window',
  [MAIN_CHANNELS.FETCH_7TV_COSMETICS]: 'seven_tv_fetch_cosmetics',
  [MAIN_CHANNELS.SHELL_OPEN_EXTERNAL]: 'shell_open_external',
  [MAIN_CHANNELS.UPDATE_CHECK]: 'updater_check',
  [MAIN_CHANNELS.UPDATE_INSTALL]: 'updater_install',
  [MAIN_CHANNELS.WINDOW_MINIMIZE]: 'window_minimize',
  [MAIN_CHANNELS.WINDOW_MAXIMIZE]: 'window_maximize',
  [MAIN_CHANNELS.WINDOW_CLOSE]: 'window_close',
  [MAIN_CHANNELS.WINDOW_IS_MAXIMIZED]: 'window_is_maximized'
}

const PAYLOAD_ARG_CHANNELS = new Set<MainChannel>([
  MAIN_CHANNELS.DISCONNECT_CHANNEL,
  MAIN_CHANNELS.SEND_MESSAGE,
  MAIN_CHANNELS.AUTH_LOGOUT,
  MAIN_CHANNELS.FETCH_EMOTES,
  MAIN_CHANNELS.MOD_ACTION,
  MAIN_CHANNELS.PLUGIN_APPLY,
  MAIN_CHANNELS.SAVE_PLUGIN,
  MAIN_CHANNELS.CREATE_PLUGIN,
  MAIN_CHANNELS.TOGGLE_PLUGIN,
  MAIN_CHANNELS.GET_VIEWER_LIST,
  MAIN_CHANNELS.GET_USER_CARD,
  MAIN_CHANNELS.OPEN_USER_CARD_WINDOW,
  MAIN_CHANNELS.FETCH_7TV_COSMETICS,
  MAIN_CHANNELS.SHELL_OPEN_EXTERNAL
])

function mapTauriArgs(channel: MainChannel, payload: unknown): unknown {
  if (payload === undefined) return undefined
  return PAYLOAD_ARG_CHANNELS.has(channel) ? { payload } : payload
}

function getWindow(): Window | undefined {
  return typeof window === 'undefined' ? undefined : window
}

function getTauriDependencies(): TauriBridgeDependencies {
  const tauri = getWindow()?.__TAURI__
  const invoke = tauri?.core?.invoke
  const listen = tauri?.event?.listen

  if (!invoke || !listen) {
    throw new Error('Tauri API is not available on window.__TAURI__')
  }

  return { invoke, listen }
}

export function createTauriBridge({ invoke, listen }: TauriBridgeDependencies): ChatBridge {
  return {
    invoke(channel, payload) {
      return invoke(COMMAND_MAP[channel], mapTauriArgs(channel, payload))
    },

    on(channel, handler) {
      let disposed = false
      let unlisten: TauriUnlisten | null = null

      listen<ChatBridgeEventMap[typeof channel]>(channel, event => {
        handler(event.payload)
      }).then(registeredUnlisten => {
        if (disposed) {
          registeredUnlisten()
          return
        }

        unlisten = registeredUnlisten
      }).catch(error => {
        console.error(`Failed to listen for Tauri event "${channel}"`, error)
      })

      return () => {
        if (disposed) return
        disposed = true
        unlisten?.()
      }
    }
  }
}

export function installTauriBridge(dependencies: TauriBridgeDependencies = getTauriDependencies()): ChatBridge {
  const bridge = createTauriBridge(dependencies)
  const targetWindow = getWindow()

  if (!targetWindow) {
    throw new Error('Cannot install chatBridge without a window object')
  }

  targetWindow.chatBridge = bridge
  return bridge
}

export function ensureTauriBridgeInstalled(): ChatBridge {
  return getWindow()?.chatBridge ?? installTauriBridge()
}

export function mapTauriCommand(channel: MainChannel): string {
  return COMMAND_MAP[channel]
}
