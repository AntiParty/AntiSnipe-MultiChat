import { describe, it, expect } from 'vitest'
import { compilePlugin, runPlugin } from './pluginSandbox'
import type { PluginMessage } from '../../shared/types/plugin'

const msg = (text: string): PluginMessage => ({
  id: 'm1',
  platform: 'twitch',
  channelId: 'c1',
  author: 'someuser',
  authorDisplay: 'SomeUser',
  text,
  messageType: 'chat',
  badges: ['subscriber'],
  isMod: false,
  isSubscriber: true
})

describe('compilePlugin', () => {
  it('compiles a plugin and runs it against messages', () => {
    const compiled = compilePlugin('test', `
      export default function (msg) {
        if (msg.text.includes('spam')) return { type: 'hide' }
        return null
      }
    `)
    expect(compiled).not.toBeNull()
    expect(runPlugin(compiled!, msg('this is spam'))).toEqual({ type: 'hide' })
    expect(runPlugin(compiled!, msg('hello'))).toBeNull()
  })

  it('returns null when the plugin does not export a default function', () => {
    expect(compilePlugin('bad', 'const x = 1')).toBeNull()
  })

  it('throws on syntax errors', () => {
    expect(() => compilePlugin('broken', 'export default function ( {')).toThrow()
  })

  it('supports standard globals inside the sandbox', () => {
    const compiled = compilePlugin('globals', `
      const BOTS = new Set(['nightbot'])
      export default function (msg) {
        if (BOTS.has(msg.author) || /(.)\\1{5,}/.test(msg.text)) return { type: 'hide' }
        return { type: 'tag', label: JSON.stringify(msg.badges.length) }
      }
    `)
    expect(compiled).not.toBeNull()
    expect(runPlugin(compiled!, msg('aaaaaaaa'))).toEqual({ type: 'hide' })
    expect(runPlugin(compiled!, msg('hi'))).toEqual({ type: 'tag', label: '1' })
  })
})

describe('sandbox security', () => {
  it('does not leak the host process object via intrinsic constructors', () => {
    const compiled = compilePlugin('escape', `
      export default function (msg) {
        try {
          const p = new Set().constructor.constructor('return process')()
          return { type: 'tag', label: p ? 'escaped' : 'blocked' }
        } catch {
          return { type: 'tag', label: 'blocked' }
        }
      }
    `)
    expect(compiled).not.toBeNull()
    expect(runPlugin(compiled!, msg('x'))).toEqual({ type: 'tag', label: 'blocked' })
  })

  it('has no require, process, or globalThis-based Node access', () => {
    const compiled = compilePlugin('nodeless', `
      export default function () {
        const leaks = [
          typeof require, typeof process, typeof module,
          typeof globalThis.require, typeof globalThis.process
        ].filter(t => t !== 'undefined')
        return { type: 'tag', label: String(leaks.length) }
      }
    `)
    expect(compiled).not.toBeNull()
    expect(runPlugin(compiled!, msg('x'))).toEqual({ type: 'tag', label: '0' })
  })

  it('kills plugins that run forever instead of hanging the process', () => {
    const compiled = compilePlugin('loop', `
      export default function () { while (true) {} }
    `)
    expect(compiled).not.toBeNull()
    expect(() => runPlugin(compiled!, msg('x'))).toThrow()
  })

  it('gives each plugin an isolated copy of the message', () => {
    const mutator = compilePlugin('mutator', `
      export default function (msg) { msg.text = 'MUTATED'; return null }
    `)
    const reader = compilePlugin('reader', `
      export default function (msg) {
        return msg.text === 'MUTATED' ? { type: 'hide' } : null
      }
    `)
    const original = msg('clean')
    expect(runPlugin(mutator!, original)).toBeNull()
    expect(runPlugin(reader!, original)).toBeNull()
    expect(original.text).toBe('clean')
  })
})
