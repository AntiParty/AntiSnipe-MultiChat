import type { ChatBridge } from '@shared/types/ipc'

export function useIpc(): ChatBridge {
  return window.chatBridge
}
