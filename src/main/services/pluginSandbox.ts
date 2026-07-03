import vm from 'vm'
import type { PluginMessage, PluginAction } from '../../shared/types/plugin'

// Max synchronous run time per plugin per message — an infinite loop in a
// plugin must not hang the main process.
export const PLUGIN_RUN_TIMEOUT_MS = 50

export interface CompiledPlugin {
  ctx: vm.Context
  callScript: vm.Script
}

// Reused invocation script — assigns the result so we can read it off the context.
const CALL_SOURCE = '__ACTION__ = __EXPORT__(__MSG__)'

// SECURITY: the context must NOT be given any main-realm objects (Set, Map,
// Object, …). A fresh vm context has its own copies of all standard globals,
// and handing over host intrinsics lets a plugin escape the sandbox via e.g.
// `Set.constructor('return process')()`. Only a neutered console goes in.
function makeSandbox(): vm.Context {
  return vm.createContext({
    console: { log: () => {}, warn: () => {}, error: () => {} }
  })
}

export function compilePlugin(id: string, code: string): CompiledPlugin | null {
  const src = code.replace(/\bexport\s+default\s+/g, '__EXPORT__ = ')
  const ctx = makeSandbox()
  vm.runInContext(`var __EXPORT__=null;\n${src}`, ctx, { timeout: 500 })
  if (vm.runInContext('typeof __EXPORT__', ctx) !== 'function') return null
  return { ctx, callScript: new vm.Script(CALL_SOURCE, { filename: `plugin:${id}` }) }
}

/**
 * Run a compiled plugin against a message. Throws on plugin runtime errors
 * and timeouts — callers decide how to surface those.
 */
export function runPlugin(compiled: CompiledPlugin, msg: PluginMessage): PluginAction | null {
  // Each plugin gets its own copy — one plugin mutating the message
  // must not affect the next one
  compiled.ctx.__MSG__ = { ...msg, badges: [...msg.badges] }
  compiled.callScript.runInContext(compiled.ctx, { timeout: PLUGIN_RUN_TIMEOUT_MS })
  const action = compiled.ctx.__ACTION__ as PluginAction | null | undefined
  if (action != null && typeof action === 'object' && typeof action.type === 'string') {
    return action
  }
  return null
}
