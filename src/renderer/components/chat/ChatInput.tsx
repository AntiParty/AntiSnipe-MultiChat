import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { SendHorizonal, Lock } from 'lucide-react'
import { useStore } from '../../store'
import type { ChatterInfo } from '../../store/slices/chatSlice'
import type { NormalizedMessage } from '@shared/types/message'
import type { PluginMessage } from '@shared/types/plugin'
import type { EmoteData } from '@shared/types/emote'

type Suggestion =
  | { kind: 'chatter'; chatter: ChatterInfo }
  | { kind: 'emote'; emote: EmoteData }

function matchEmotes(emoteMap: Record<string, EmoteData> | undefined, query: string, max: number): Suggestion[] {
  if (!emoteMap || query.length < 2) return []
  const q = query.toLowerCase()
  const prefix: EmoteData[] = []
  const contains: EmoteData[] = []
  for (const emote of Object.values(emoteMap)) {
    const name = emote.name.toLowerCase()
    if (name.startsWith(q)) prefix.push(emote)
    else if (name.includes(q)) contains.push(emote)
    if (prefix.length >= max) break
  }
  return [...prefix, ...contains].slice(0, max).map(emote => ({ kind: 'emote' as const, emote }))
}

interface ChatInputProps {
  channelId: string
}

export interface ChatInputHandle {
  focus: () => void
}

const MAX_SUGGESTIONS = 8
const CHAR_LIMIT = 500
const CHAR_WARN_AT = 420

const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(function ChatInput({ channelId }, ref) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [mentionStart, setMentionStart] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }))

  const channels = useStore(s => s.channels)
  const auth = useStore(s => s.auth)
  const chatters = useStore(s => s.chattersByChannel[channelId])
  const emoteMap = useStore(s => s.emotesByChannel[channelId])

  const channel = channels.find(c => c.id === channelId)
  const isAuthRequired =
    channel?.platform === 'twitch'
      ? auth.twitch.status !== 'authenticated'
      : channel?.platform === 'youtube'
        ? auth.youtube.status !== 'authenticated'
        : false

  const charsLeft = CHAR_LIMIT - text.length
  const showCharCount = text.length >= CHAR_WARN_AT
  const isOverLimit = text.length > CHAR_LIMIT
  const canSend = text.trim().length > 0 && !isAuthRequired && !sending && !isOverLimit

  // ── Autocomplete ─────────────────────────────────────────────────────────

  /** The whitespace-delimited word the cursor is inside (start index + raw word). */
  const getWordAtCursor = useCallback((value: string, cursor: number): { start: number; word: string } => {
    let i = cursor - 1
    while (i >= 0 && value[i] !== ' ' && value[i] !== '\n') i--
    const wordStart = i + 1
    return { start: wordStart, word: value.slice(wordStart, cursor) }
  }, [])

  const matchChatters = useCallback((query: string): Suggestion[] => {
    if (!chatters) return []
    const all = [...chatters].reverse()
    const matched = query.length === 0
      ? all.slice(0, MAX_SUGGESTIONS)
      : all.filter(c =>
          c.login.toLowerCase().startsWith(query) ||
          c.displayName.toLowerCase().startsWith(query)
        ).slice(0, MAX_SUGGESTIONS)
    return matched.map(chatter => ({ kind: 'chatter' as const, chatter }))
  }, [chatters])

  const updateSuggestions = useCallback((value: string, cursor: number) => {
    const { start, word } = getWordAtCursor(value, cursor)
    let matched: Suggestion[] = []
    if (word.startsWith('@')) {
      matched = matchChatters(word.slice(1).toLowerCase())
    } else if (word.startsWith(':')) {
      // Chatterino-style :emote completion
      matched = matchEmotes(emoteMap, word.slice(1), MAX_SUGGESTIONS)
    }
    if (matched.length === 0) {
      setSuggestions([])
      setMentionStart(-1)
      return
    }
    setMentionStart(start)
    setSuggestions(matched)
    setSelectedIdx(0)
  }, [emoteMap, getWordAtCursor, matchChatters])

  const applySuggestion = useCallback((s: Suggestion) => {
    const cursor = inputRef.current?.selectionStart ?? text.length
    const { start } = getWordAtCursor(text, cursor)
    const before = text.slice(0, start)
    const after = text.slice(cursor)
    const replacement = s.kind === 'chatter' ? `@${s.chatter.displayName} ` : `${s.emote.name} `
    const newText = before + replacement + after
    setText(newText)
    setSuggestions([])
    setMentionStart(-1)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      const pos = before.length + replacement.length
      el.setSelectionRange(pos, pos)
    })
  }, [text, getWordAtCursor])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setText(val)
    updateSuggestions(val, e.target.selectionStart ?? val.length)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); applySuggestion(suggestions[selectedIdx]); return }
      if (e.key === 'Escape') { setSuggestions([]); setMentionStart(-1); return }
    }
    // Chatterino-style Tab completion on a bare word → emote suggestions
    if (e.key === 'Tab') {
      const cursor = inputRef.current?.selectionStart ?? text.length
      const { start, word } = getWordAtCursor(text, cursor)
      if (word.length >= 2 && !word.startsWith('@') && !word.startsWith(':')) {
        const matched = matchEmotes(emoteMap, word, MAX_SUGGESTIONS)
        if (matched.length > 0) {
          e.preventDefault()
          if (matched.length === 1) {
            applySuggestion(matched[0])
          } else {
            setMentionStart(start)
            setSuggestions(matched)
            setSelectedIdx(0)
          }
          return
        }
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  useEffect(() => {
    if (suggestions.length === 0) return
    const handler = (e: MouseEvent) => {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) { setSuggestions([]); setMentionStart(-1) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [suggestions.length])

  useEffect(() => {
    setSuggestions([])
    setMentionStart(-1)
    setText('')
    // Grab focus whenever the active channel changes (or on first mount)
    inputRef.current?.focus()
  }, [channelId])

  // Re-focus when the Electron window regains focus (e.g. alt-tab back)
  useEffect(() => {
    const onWindowFocus = () => {
      const active = document.activeElement
      if (!active || active === document.body || active === document.documentElement) {
        inputRef.current?.focus()
      }
    }
    window.addEventListener('focus', onWindowFocus)
    return () => window.removeEventListener('focus', onWindowFocus)
  }, [])

  // Capture any printable key typed outside an input and redirect it here
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (sending) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      if (e.key.length !== 1) return
      e.preventDefault()
      setText(prev => {
        const newText = prev + e.key
        requestAnimationFrame(() => {
          const el = inputRef.current
          if (el) {
            el.focus()
            el.setSelectionRange(newText.length, newText.length)
          }
          updateSuggestions(newText, newText.length)
        })
        return newText
      })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [sending, updateSuggestions])

  // ── Send ─────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!canSend) return
    let messageToSend = text.trim()

    // Run command plugins on !-prefixed messages before sending
    if (messageToSend.startsWith('!')) {
      const pmsg: PluginMessage = {
        id: 'cmd', platform: channel?.platform ?? 'twitch',
        channelId, author: '', authorDisplay: '',
        text: messageToSend, messageType: 'chat',
        badges: [], isMod: false, isSubscriber: false
      }
      const action = await window.chatBridge.invoke('plugins:apply', pmsg)
      if (action?.type === 'command') {
        let respond = action.respond
        if (respond === '__song__') {
          const song = await window.chatBridge.invoke('media:getCurrent')
          respond = song || '(nothing playing)'
        }
        messageToSend = respond
      } else if (action?.type === 'hide') {
        setText(''); setSuggestions([]); setMentionStart(-1)
        return
      }
    }

    setSending(true)
    try {
      await window.chatBridge.invoke('chat:send', { channelId, message: messageToSend })
      setText('')
      setSuggestions([])
      setMentionStart(-1)
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isAuthRequired) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '6px 8px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-1)',
          flexShrink: 0,
          cursor: 'default'
        }}
      >
        <Lock size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', flex: 1 }}>
          Log in to chat in <span style={{ color: 'var(--text-secondary)' }}>{channel?.displayName}</span>
        </span>
        <button
          onClick={() => window.chatBridge.invoke(
            channel?.platform === 'youtube' ? 'auth:youtube:start' : 'auth:twitch:start'
          )}
          style={{
            fontSize: '10px',
            fontWeight: 600,
            padding: '3px 9px',
            background: channel?.platform === 'twitch' ? 'var(--twitch)' : channel?.platform === 'youtube' ? 'var(--youtube)' : 'var(--accent)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            flexShrink: 0,
            borderRadius: '2px'
          }}
        >
          Log in
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-1)',
        flexShrink: 0,
        position: 'relative'
      }}
    >
      {/* @ autocomplete */}
      {suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderBottom: 'none',
            boxShadow: '0 -6px 16px rgba(0,0,0,0.35)',
            zIndex: 20,
            overflow: 'hidden'
          }}
        >
          <div style={{
            padding: '4px 8px 3px',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border)'
          }}>
            {suggestions[0]?.kind === 'emote' ? 'Emotes' : 'Mention'}
          </div>
          {suggestions.map((s, i) => (
            <div
              key={s.kind === 'chatter' ? `c:${s.chatter.login}` : `e:${s.emote.provider}:${s.emote.id}`}
              onMouseDown={e => { e.preventDefault(); applySuggestion(s) }}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                cursor: 'pointer',
                background: i === selectedIdx ? 'var(--accent-subtle)' : 'transparent',
                borderLeft: i === selectedIdx ? '2px solid var(--accent)' : '2px solid transparent',
                userSelect: 'none'
              }}
            >
              {s.kind === 'chatter' ? (
                <>
                  {/* Initial avatar */}
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: `hsl(${(s.chatter.login.charCodeAt(0) * 37) % 360} 45% 35%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '9px',
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                    textTransform: 'uppercase'
                  }}>
                    {s.chatter.displayName[0]}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.chatter.displayName}
                  </span>
                  {s.chatter.displayName.toLowerCase() !== s.chatter.login.toLowerCase() && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{s.chatter.login}</span>
                  )}
                </>
              ) : (
                <>
                  <img
                    src={s.emote.urls.x1}
                    alt={s.emote.name}
                    loading="lazy"
                    draggable={false}
                    style={{ width: '18px', height: '18px', objectFit: 'contain', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {s.emote.name}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {s.emote.provider}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 6px',
          gap: '4px',
          background: focused ? 'var(--surface-2)' : 'var(--surface-1)',
          transition: 'background 0.1s',
          borderTop: focused ? `1px solid var(--accent)` : '1px solid transparent',
          marginTop: '-1px' // absorbs the outer border-top
        }}
      >
        <input
          ref={inputRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={e => updateSuggestions(text, (e.target as HTMLInputElement).selectionStart ?? text.length)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            setTimeout(() => {
              if (!suggestionsRef.current?.matches(':hover')) {
                setSuggestions([])
                setMentionStart(-1)
              }
            }, 150)
          }}
          disabled={sending}
          placeholder={`Chat in ${channel?.displayName}…`}
          maxLength={CHAR_LIMIT + 10}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            fontSize: '12px',
            padding: '3px 0',
            background: 'transparent',
            border: 'none',
            color: isOverLimit ? 'var(--danger)' : 'var(--text-primary)',
            outline: 'none',
            minWidth: 0,
            userSelect: 'text',
            WebkitUserSelect: 'text'
          } as React.CSSProperties}
        />

        {/* Char counter */}
        {showCharCount && (
          <span style={{
            fontSize: '10px',
            fontVariantNumeric: 'tabular-nums',
            color: isOverLimit ? 'var(--danger)' : charsLeft <= 30 ? 'var(--warning)' : 'var(--text-muted)',
            flexShrink: 0,
            fontWeight: isOverLimit ? 700 : 400
          }}>
            {charsLeft}
          </span>
        )}

        {/* Send button — icon only, appears when there's text */}
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px',
            flexShrink: 0,
            background: canSend ? 'var(--accent)' : 'transparent',
            border: 'none',
            borderRadius: '3px',
            color: canSend ? '#fff' : 'var(--text-muted)',
            cursor: canSend ? 'pointer' : 'default',
            opacity: text.trim() ? 1 : 0.35,
            transition: 'background 0.12s, color 0.12s, opacity 0.12s'
          }}
        >
          <SendHorizonal size={12} />
        </button>
      </div>
    </div>
  )
})

export default ChatInput
