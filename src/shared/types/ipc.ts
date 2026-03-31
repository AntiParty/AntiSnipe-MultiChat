import type { NormalizedMessage, DeleteMessageEvent } from './message'
import type { ConnectionState, ConnectChannelPayload, DisconnectChannelPayload } from './channel'
import type { AppSettings } from './settings'
import type { EmoteData } from './emote'
import type { Platform } from './message'

// ─── Renderer → Main (invoke/handle) ───────────────────────────────────────

export const MAIN_CHANNELS = {
  CONNECT_CHANNEL: 'channel:connect',
  DISCONNECT_CHANNEL: 'channel:disconnect',
  SEND_MESSAGE: 'chat:send',
  GET_SETTINGS: 'settings:get',
  SET_SETTINGS: 'settings:set',
  AUTH_TWITCH_START: 'auth:twitch:start',
  AUTH_YOUTUBE_START: 'auth:youtube:start',
  AUTH_LOGOUT: 'auth:logout',
  GET_AUTH_STATE: 'auth:getState',
  GET_CONNECTION_STATES: 'connections:getAll',
  FETCH_EMOTES: 'emotes:fetch',
  MOD_ACTION: 'mod:action',
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:isMaximized',
} as const

export type MainChannel = (typeof MAIN_CHANNELS)[keyof typeof MAIN_CHANNELS]

// ─── Main → Renderer (push) ─────────────────────────────────────────────────

export const RENDERER_CHANNELS = {
  MESSAGE_BATCH: 'chat:messageBatch',
  DELETE_MESSAGE: 'chat:deleteMessage',
  CONNECTION_STATE: 'connection:state',
  AUTH_STATE_CHANGED: 'auth:stateChanged',
  EMOTE_BATCH_READY: 'emotes:batchReady',
  SETTINGS_UPDATED: 'settings:updated',
  UPDATE_AVAILABLE: 'updater:available',
  UPDATE_DOWNLOADED: 'updater:downloaded',
  PLATFORM_ERROR: 'error:platform',
  SELF_MOD_STATUS: 'mod:selfStatus',
} as const

export type RendererChannel = (typeof RENDERER_CHANNELS)[keyof typeof RENDERER_CHANNELS]

// ─── Payload types ───────────────────────────────────────────────────────────

export interface SendMessagePayload {
  channelId: string
  message: string
}

export interface AuthLogoutPayload {
  platform: Platform
}

export interface FetchEmotesPayload {
  channelId: string
  twitchUserId?: string
  kickUserId?: string
}

export interface ShellOpenPayload {
  url: string
}

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'error'

export interface AuthState {
  status: AuthStatus
  username?: string
  error?: string
}

export interface AllAuthState {
  twitch: AuthState
  youtube: AuthState
}

export interface AuthStateChangedPayload {
  platform: 'twitch' | 'youtube'
  state: AuthState
}

export interface EmoteBatchReadyPayload {
  channelId: string
  emotes: EmoteData[]
}

export interface PlatformErrorPayload {
  channelId: string
  code: string
  message: string
}

export type ModActionType = 'delete' | 'timeout' | 'ban' | 'unban'

export interface ModActionPayload {
  channelId: string
  action: ModActionType
  targetUserId: string
  targetUserLogin: string
  messageId?: string  // required for 'delete'
  duration?: number   // seconds, required for 'timeout'
}

export interface SelfModStatusPayload {
  channelId: string
  isMod: boolean
}

// ─── Bridge type exposed via contextBridge ──────────────────────────────────

export interface ChatBridgeInvokeMap {
  [MAIN_CHANNELS.CONNECT_CHANNEL]: [ConnectChannelPayload, void]
  [MAIN_CHANNELS.DISCONNECT_CHANNEL]: [DisconnectChannelPayload, void]
  [MAIN_CHANNELS.SEND_MESSAGE]: [SendMessagePayload, void]
  [MAIN_CHANNELS.GET_SETTINGS]: [undefined, AppSettings]
  [MAIN_CHANNELS.SET_SETTINGS]: [Partial<AppSettings>, AppSettings]
  [MAIN_CHANNELS.AUTH_TWITCH_START]: [undefined, void]
  [MAIN_CHANNELS.AUTH_YOUTUBE_START]: [undefined, void]
  [MAIN_CHANNELS.AUTH_LOGOUT]: [AuthLogoutPayload, void]
  [MAIN_CHANNELS.GET_AUTH_STATE]: [undefined, AllAuthState]
  [MAIN_CHANNELS.GET_CONNECTION_STATES]: [undefined, ConnectionState[]]
  [MAIN_CHANNELS.FETCH_EMOTES]: [FetchEmotesPayload, void]
  [MAIN_CHANNELS.MOD_ACTION]: [ModActionPayload, void]
  [MAIN_CHANNELS.SHELL_OPEN_EXTERNAL]: [ShellOpenPayload, void]
  [MAIN_CHANNELS.WINDOW_MINIMIZE]: [undefined, void]
  [MAIN_CHANNELS.WINDOW_MAXIMIZE]: [undefined, void]
  [MAIN_CHANNELS.WINDOW_CLOSE]: [undefined, void]
  [MAIN_CHANNELS.WINDOW_IS_MAXIMIZED]: [undefined, boolean]
}

export interface ChatBridgeEventMap {
  [RENDERER_CHANNELS.MESSAGE_BATCH]: NormalizedMessage[]
  [RENDERER_CHANNELS.DELETE_MESSAGE]: DeleteMessageEvent
  [RENDERER_CHANNELS.CONNECTION_STATE]: ConnectionState
  [RENDERER_CHANNELS.AUTH_STATE_CHANGED]: AuthStateChangedPayload
  [RENDERER_CHANNELS.EMOTE_BATCH_READY]: EmoteBatchReadyPayload
  [RENDERER_CHANNELS.SETTINGS_UPDATED]: AppSettings
  [RENDERER_CHANNELS.UPDATE_AVAILABLE]: { version: string }
  [RENDERER_CHANNELS.UPDATE_DOWNLOADED]: { version: string }
  [RENDERER_CHANNELS.PLATFORM_ERROR]: PlatformErrorPayload
  [RENDERER_CHANNELS.SELF_MOD_STATUS]: SelfModStatusPayload
}

export interface ChatBridge {
  invoke<C extends MainChannel>(
    channel: C,
    payload?: ChatBridgeInvokeMap[C][0]
  ): Promise<ChatBridgeInvokeMap[C][1]>

  on<C extends RendererChannel>(
    channel: C,
    handler: (payload: ChatBridgeEventMap[C]) => void
  ): () => void
}
