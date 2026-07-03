import type { ChatBridge } from '../shared/types/ipc'

declare global {
  interface Window {
    chatBridge: ChatBridge
  }
}

export {}
