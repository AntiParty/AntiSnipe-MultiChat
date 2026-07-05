/**
 * Plugin system types.
 *
 * A plugin is a .js file in userData/plugins/ that exports a default function:
 *
 *   export default function myPlugin(msg) {
 *     if (msg.author === 'someSpammer') return { type: 'hide' }
 *     if (msg.text.includes('!highlight')) return { type: 'highlight', color: '#ff0' }
 *     return null
 *   }
 */

/** Simplified message object exposed to plugins (no internal state). */
export interface PluginMessage {
  id: string
  platform: string       // 'twitch' | 'youtube' | 'kick' | 'tiktok'
  channelId: string
  author: string         // login name
  authorDisplay: string  // display name
  text: string           // raw message text
  messageType: string    // 'chat' | 'action' | 'sub' | 'redeem' | etc.
  badges: string[]       // badge IDs e.g. ['moderator', 'subscriber']
  isMod: boolean
  isSubscriber: boolean
  /** Twitch only: the author's first message ever in this channel (first-msg tag). */
  isFirstMessage?: boolean
}

export type PluginAction =
  | { type: 'hide' }
  | { type: 'highlight'; color: string }
  | { type: 'tag'; label: string; color?: string }
  | { type: 'replace'; text: string }
  /** Intercept the user's outgoing message and send `respond` instead.
   *  Use `respond: '__song__'` to substitute the currently playing track. */
  | { type: 'command'; respond: string }

/** Metadata returned by main process for each loaded plugin. */
export interface PluginMeta {
  id: string        // filename without extension
  name: string      // from plugin.meta?.name or filename
  enabled: boolean
  error?: string    // parse/load error if any
  filePath: string
}

/** Raw plugin record sent from main to renderer. */
export interface PluginRecord {
  meta: PluginMeta
  code: string      // full JS source (renderer evaluates it)
}
