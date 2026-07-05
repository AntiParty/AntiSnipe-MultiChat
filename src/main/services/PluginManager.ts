import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, watchFile, unwatchFile } from 'fs'
import { join } from 'path'
import log from 'electron-log'
import { compilePlugin, runPlugin, type CompiledPlugin } from './pluginSandbox'
import type { PluginMeta, PluginRecord, PluginMessage, PluginAction } from '../../shared/types/plugin'
import type { NormalizedMessage } from '../../shared/types/message'

function toPluginMessage(msg: NormalizedMessage): PluginMessage {
  const text = msg.parts.map(p =>
    p.type === 'text' || p.type === 'mention' ? p.content
    : p.type === 'emote' ? p.emote.name
    : p.type === 'link' ? p.url : ''
  ).join('')
  // Raw badge IDs survive even when badge images aren't cached
  const badges = msg.badgeIds ?? msg.badges.map(b => b.id)
  return {
    id: msg.id, platform: msg.platform, channelId: msg.channelId,
    author: msg.authorName, authorDisplay: msg.authorDisplayName,
    text, messageType: msg.messageType, badges,
    isMod: badges.includes('moderator') || badges.includes('broadcaster'),
    isSubscriber: badges.includes('subscriber') || badges.includes('founder')
  }
}

const STATE_FILE = 'plugins-state.json'

export class PluginManager {
  private pluginsDir: string
  private stateFile: string
  private records  = new Map<string, PluginRecord>()
  private compiled = new Map<string, CompiledPlugin>()
  private enabledState: Record<string, boolean> = {}  // id → enabled
  private changeCallbacks: Array<() => void> = []

  constructor() {
    this.pluginsDir = join(app.getPath('userData'), 'plugins')
    this.stateFile  = join(this.pluginsDir, STATE_FILE)
    const firstRun = !existsSync(this.pluginsDir)
    if (firstRun) {
      mkdirSync(this.pluginsDir, { recursive: true })
    }
    this.loadState()
    this.writeExamplePlugins()  // writes only missing files
  }

  private loadState(): void {
    try {
      if (existsSync(this.stateFile)) {
        this.enabledState = JSON.parse(readFileSync(this.stateFile, 'utf8'))
      }
    } catch { /* corrupt file — start fresh */ }
  }

  private saveState(): void {
    try {
      writeFileSync(this.stateFile, JSON.stringify(this.enabledState, null, 2), 'utf8')
    } catch (err) {
      log.warn('PluginManager: failed to save state', err)
    }
  }

  /** Load (or reload) all .js files from the plugins directory. */
  load(): void {
    // Stop watching old files
    for (const record of this.records.values()) {
      unwatchFile(record.meta.filePath)
    }
    this.records.clear()
    this.compiled.clear()

    let files: string[] = []
    try {
      files = readdirSync(this.pluginsDir).filter(f => f.endsWith('.js'))
    } catch (err) {
      log.error('PluginManager: cannot read plugins dir', err)
      return
    }

    for (const file of files) {
      const filePath = join(this.pluginsDir, file)
      this.loadFile(filePath)

      // Watch for changes and hot-reload
      watchFile(filePath, { interval: 1000 }, () => {
        log.info('PluginManager: reloading', file)
        this.loadFile(filePath)
        this.changeCallbacks.forEach(cb => cb())
      })
    }
  }

  private loadFile(filePath: string): void {
    const id = filePath.replace(/\\/g, '/').split('/').pop()!.replace(/\.js$/, '')
    let code = ''
    let error: string | undefined

    try {
      code = readFileSync(filePath, 'utf8')
    } catch (err) {
      error = String(err)
      log.warn('PluginManager: failed to read', filePath, err)
    }

    const nameMatch = code.match(/\/\/\s*@name\s+(.+)/)
    const name = nameMatch ? nameMatch[1].trim() : id

    // Compile in main process (vm module — no CSP)
    this.compiled.delete(id)
    if (!error && code) {
      try {
        const compiled = compilePlugin(id, code)
        if (compiled) {
          this.compiled.set(id, compiled)
        } else {
          error = 'Plugin did not export a default function'
        }
      } catch (err) {
        error = `Compile error: ${err instanceof Error ? err.message : String(err)}`
        log.warn(`PluginManager: compile error "${id}":`, err)
      }
    }

    // Enabled defaults to true for new plugins; persisted state overrides
    const enabled = this.enabledState[id] ?? true
    const meta: PluginMeta = { id, name, enabled, filePath, error }
    this.records.set(id, { meta, code })
  }

  /** Run all enabled plugins against a NormalizedMessage. Returns first action or null. */
  applyToMessage(msg: NormalizedMessage): PluginAction | null {
    if (this.compiled.size === 0) return null
    return this.applyToPluginMessage(toPluginMessage(msg))
  }

  /** Run all enabled plugins against a PluginMessage. Returns first action or null. */
  applyToPluginMessage(pmsg: PluginMessage): PluginAction | null {
    for (const [id, compiled] of this.compiled) {
      const record = this.records.get(id)
      if (!record?.meta.enabled) continue
      try {
        const action = runPlugin(compiled, pmsg)
        if (action) return action
      } catch (err) {
        // Runtime error or timeout: disable the plugin until it's edited or
        // reloaded, and surface the error in the plugin UI instead of
        // paying the cost (and hiding the bug) on every message.
        this.compiled.delete(id)
        const message = err instanceof Error ? err.message : String(err)
        record.meta.error = `Runtime error (plugin disabled until reloaded): ${message}`
        log.warn(`PluginManager: runtime error in "${id}":`, message)
        this.changeCallbacks.forEach(cb => cb())
      }
    }
    return null
  }

  getAll(): PluginRecord[] {
    return Array.from(this.records.values())
  }

  /** Toggle enabled state for a plugin. Persisted to disk. Returns updated list. */
  toggleEnabled(id: string, enabled: boolean): PluginRecord[] {
    const record = this.records.get(id)
    if (!record) throw new Error(`Plugin not found: ${id}`)
    record.meta.enabled = enabled
    this.enabledState[id] = enabled
    this.saveState()
    return this.getAll()
  }

  /** Write updated code to disk and re-parse immediately. Returns updated list. */
  save(id: string, code: string): PluginRecord[] {
    const record = this.records.get(id)
    if (!record) throw new Error(`Plugin not found: ${id}`)
    writeFileSync(record.meta.filePath, code, 'utf8')
    this.loadFile(record.meta.filePath)
    return this.getAll()
  }

  /** Create a new plugin file, start watching it, return updated list. */
  create(filename: string, code: string): PluginRecord[] {
    let safe = filename.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'my-plugin'
    // Never overwrite an existing plugin — uniquify the name instead
    if (existsSync(join(this.pluginsDir, `${safe}.js`))) {
      let n = 2
      while (existsSync(join(this.pluginsDir, `${safe}-${n}.js`))) n++
      safe = `${safe}-${n}`
    }
    const filePath = join(this.pluginsDir, `${safe}.js`)
    writeFileSync(filePath, code, 'utf8')
    this.loadFile(filePath)
    watchFile(filePath, { interval: 1000 }, () => {
      log.info('PluginManager: reloading', safe)
      this.loadFile(filePath)
      this.changeCallbacks.forEach(cb => cb())
    })
    return this.getAll()
  }

  getPluginsDir(): string {
    return this.pluginsDir
  }

  onPluginsChanged(cb: () => void): () => void {
    this.changeCallbacks.push(cb)
    return () => { this.changeCallbacks = this.changeCallbacks.filter(c => c !== cb) }
  }

  shutdown(): void {
    for (const record of this.records.values()) {
      unwatchFile(record.meta.filePath)
    }
  }

  private writeExamplePlugins(): void {
    // Write only files that don't exist yet — safe to call on every launch
    const files: Array<{ name: string; content: string }> = [
      {
        name: 'bot-filter.js',
        content: `// @name Bot Filter
// Hides messages from known bot accounts.
// Add or remove bot usernames (lowercase) from the BOTS set below.

const BOTS = new Set([
  'nightbot',
  'streamelements',
  'streamlabs',
  'moobot',
  'fossabot',
  'wizebot',
  'botisimo',
  'soundalerts',
])

export default function botFilter(msg) {
  if (BOTS.has(msg.author.toLowerCase())) {
    return { type: 'hide' }
  }
  return null
}
`
      },
      {
        name: 'spam-filter.js',
        content: `// @name Spam Filter
// Hides messages that look like spam. Mods and subscribers are never
// filtered. Tune the thresholds below to taste.

const MIN_CAPS_LEN = 12       // ignore short shouts
const CAPS_RATIO = 0.75       // fraction of letters that are uppercase
const MAX_REPEAT = 8          // same char repeated N+ times
const MAX_WORD_REPEAT = 6     // same word repeated N+ times in a row
const MAX_LENGTH = 500        // wall of text

export default function spamFilter(msg) {
  if (msg.isMod || msg.isSubscriber) return null
  const text = msg.text.trim()
  if (!text) return null

  // ALL CAPS
  if (text.length >= MIN_CAPS_LEN) {
    const letters = text.replace(/[^a-zA-Z]/g, '')
    if (letters.length > 6) {
      const upper = letters.replace(/[^A-Z]/g, '').length / letters.length
      if (upper >= CAPS_RATIO) return { type: 'hide' }
    }
  }

  // Repeated single character: aaaaaa, !!!!!!
  if (new RegExp('(.)\\\\1{' + (MAX_REPEAT - 1) + ',}').test(text)) return { type: 'hide' }

  // Repeated word: "lol lol lol lol lol lol"
  if (new RegExp('\\\\b(\\\\w+)(\\\\s+\\\\1\\\\b){' + (MAX_WORD_REPEAT - 1) + ',}', 'i').test(text)) {
    return { type: 'hide' }
  }

  // Wall of text
  if (text.length > MAX_LENGTH) return { type: 'hide' }

  return null
}
`
      },
      {
        name: 'first-message-highlight.js',
        content: `// @name First-Time Chatter Highlight
// Highlights the FIRST message each user sends this session, so you never
// miss a new chatter saying hi. Remembers who has spoken until the app closes.

const seen = new Set()

export default function firstMessage(msg) {
  const key = msg.platform + ':' + msg.channelId + ':' + msg.author.toLowerCase()
  if (seen.has(key)) return null
  seen.add(key)
  return { type: 'highlight', color: 'rgba(80, 200, 120, 0.16)' }
}
`
      },
      {
        name: 'link-filter.js',
        content: `// @name Link Filter
// Hides messages containing links from non-mods / non-subscribers.
// Good for locking down chat during a raid or when link spam hits.
// Set BLOCK_ALL to true to hide links from everyone.

const BLOCK_ALL = false
const LINK_RE = /(https?:\\/\\/|www\\.|[a-z0-9-]+\\.(com|net|org|gg|tv|io|xyz|link)\\b)/i

export default function linkFilter(msg) {
  if (!BLOCK_ALL && (msg.isMod || msg.isSubscriber)) return null
  if (LINK_RE.test(msg.text)) return { type: 'hide' }
  return null
}
`
      },
      {
        name: 'copypasta-filter.js',
        content: `// @name Copypasta / Emote-Spam Filter
// Hides messages that are just a wall of repeated emotes or the same short
// token pasted over and over (common raid copypasta). Mods/subs are exempt.

export default function copypasta(msg) {
  if (msg.isMod || msg.isSubscriber) return null
  const tokens = msg.text.trim().split(/\\s+/).filter(Boolean)
  if (tokens.length < 8) return null

  // If 80%+ of tokens are the same single token, it's spam
  const counts = new Map()
  for (const t of tokens) counts.set(t, (counts.get(t) || 0) + 1)
  let top = 0
  for (const n of counts.values()) if (n > top) top = n
  if (top / tokens.length >= 0.8) return { type: 'hide' }

  return null
}
`
      },
      {
        name: 'vip-tagger.js',
        content: `// @name VIP Tagger
// Adds a purple "VIP" tag to messages from a configured list of users.
// Edit VIP_USERS below (lowercase login names).

const VIP_USERS = new Set([
  'your_friend_here',
])

export default function vipTagger(msg) {
  if (VIP_USERS.has(msg.author.toLowerCase())) {
    return { type: 'tag', label: 'VIP', color: '#a78bfa' }
  }
  return null
}
`
      },
      {
        name: 'keyword-highlight.js',
        content: `// @name Keyword Highlight
// Highlights messages containing any of the keywords below (case-insensitive).

const KEYWORDS = [
  'giveaway',
  'clip that',
  '!commands',
]

const COLOR = 'rgba(255, 200, 0, 0.15)'

export default function keywordHighlight(msg) {
  const lower = msg.text.toLowerCase()
  for (const kw of KEYWORDS) {
    if (lower.includes(kw.toLowerCase())) {
      return { type: 'highlight', color: COLOR }
    }
  }
  return null
}
`
      },
      {
        name: 'song.js',
        content: `// @name !song Command
// Type !song in chat to post the currently playing Spotify track (Windows only).
// The app reads the Spotify window title — no API key required.

export default function song(msg) {
  if (msg.text.trim().toLowerCase() === '!song') {
    return { type: 'command', respond: '__song__' }
  }
  return null
}
`
      },
    ]

    for (const file of files) {
      const dest = join(this.pluginsDir, file.name)
      if (existsSync(dest)) continue  // never overwrite user edits
      try {
        writeFileSync(dest, file.content, 'utf8')
      } catch { /* ignore */ }
    }
  }
}

export const pluginManager = new PluginManager()
