import { contextBridge, ipcRenderer } from 'electron'
import type { ChatBridge, MainChannel, RendererChannel } from '../shared/types/ipc'

const bridge = {
  invoke(channel: MainChannel, payload?: unknown): Promise<unknown> {
    return ipcRenderer.invoke(channel, payload)
  },

  on(channel: RendererChannel, handler: (payload: unknown) => void): () => void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = (_event: Electron.IpcRendererEvent, ...args: any[]) => handler(args[0])
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
} as unknown as ChatBridge

contextBridge.exposeInMainWorld('chatBridge', bridge)
