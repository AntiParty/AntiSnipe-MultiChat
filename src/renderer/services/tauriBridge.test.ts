import { afterEach, describe, expect, it, vi } from 'vitest'
import { RENDERER_CHANNELS } from '../../shared/types/ipc'
import { createTauriBridge, installTauriBridge } from './tauriBridge'

describe('tauri bridge', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps settings:get to the settings_get Tauri command', async () => {
    const invoke = vi.fn().mockResolvedValue({ theme: 'dark' })
    const listen = vi.fn()
    const bridge = createTauriBridge({ invoke, listen })

    const result = await bridge.invoke('settings:get')

    expect(invoke).toHaveBeenCalledWith('settings_get', undefined)
    expect(result).toEqual({ theme: 'dark' })
  })

  it('maps settings:set to the settings_set Tauri command with the existing payload shape', async () => {
    const invoke = vi.fn().mockResolvedValue({ fontSize: 15 })
    const listen = vi.fn()
    const bridge = createTauriBridge({ invoke, listen })

    const payload = { fontSize: 15 }
    const result = await bridge.invoke('settings:set', payload)

    expect(invoke).toHaveBeenCalledWith('settings_set', payload)
    expect(result).toEqual({ fontSize: 15 })
  })

  it('wraps existing payload-shaped commands for Tauri struct arguments', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined)
    const listen = vi.fn()
    const bridge = createTauriBridge({ invoke, listen })

    const payload = { channelId: 'twitch:coolchan' }
    await bridge.invoke('channel:disconnect', payload)

    expect(invoke).toHaveBeenCalledWith('channel_disconnect', { payload })
  })

  it('subscribes to chat:messageBatch without renaming the event', async () => {
    const invoke = vi.fn()
    const unlisten = vi.fn()
    const listen = vi.fn().mockResolvedValue(unlisten)
    const bridge = createTauriBridge({ invoke, listen })
    const handler = vi.fn()

    bridge.on(RENDERER_CHANNELS.MESSAGE_BATCH, handler)

    expect(listen).toHaveBeenCalledWith(RENDERER_CHANNELS.MESSAGE_BATCH, expect.any(Function))
    const wrappedHandler = listen.mock.calls[0][1]
    wrappedHandler({ payload: [{ id: 'msg-1', channelId: 'channel-1' }] })

    expect(handler).toHaveBeenCalledWith([{ id: 'msg-1', channelId: 'channel-1' }])
  })

  it('returns a synchronous unsubscribe that runs after async Tauri listen registration completes', async () => {
    const invoke = vi.fn()
    const unlisten = vi.fn()
    let resolveListen: (unlisten: () => void) => void = () => {}
    const listen = vi.fn(
      () =>
        new Promise<() => void>(resolve => {
          resolveListen = resolve
        })
    )
    const bridge = createTauriBridge({ invoke, listen })

    const unsubscribe = bridge.on(RENDERER_CHANNELS.MESSAGE_BATCH, vi.fn())
    unsubscribe()
    expect(unlisten).not.toHaveBeenCalled()

    resolveListen(unlisten)
    await Promise.resolve()

    expect(unlisten).toHaveBeenCalledTimes(1)
  })

  it('installs the Tauri bridge on window.chatBridge before React bootstraps', () => {
    const invoke = vi.fn()
    const listen = vi.fn()
    vi.stubGlobal('window', {})

    const bridge = installTauriBridge({ invoke, listen })

    expect(window.chatBridge).toBe(bridge)
  })
})
