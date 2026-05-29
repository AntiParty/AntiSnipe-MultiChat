import type { ChatBridge } from '../shared/types/ipc'

declare global {
  interface Window {
    chatBridge: ChatBridge
    __TAURI__?: {
      core?: {
        invoke: <T>(command: string, payload?: unknown) => Promise<T>
      }
      event?: {
        listen: <T>(
          event: string,
          handler: (event: { payload: T }) => void
        ) => Promise<() => void>
      }
    }
  }
}

export {}
