import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { ArrowDown, ChevronDown, Pin, Search, X as XIcon } from 'lucide-react'
import { MAIN_CHANNELS } from '@shared/types/ipc'
import { useStore } from '../../store'
import { useActiveMessages } from '../../hooks/useChat'
import MessageRow from './MessageRow'
import ChatInput, { type ChatInputHandle } from './ChatInput'
import styles from '../../styles/chat.module.css'

// Maximum number of messages rendered in the DOM at once.
// Older messages are trimmed from the top of the render window.
const RENDER_LIMIT = 200

export default function ChatPane() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<ChatInputHandle>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const atBottomRef = useRef(true)
  const hoveredRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [pinExpanded, setPinExpanded] = useState(false)

  const messages = useActiveMessages()
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)
  const pinned = useStore(s => s.pinnedByChannel[s.activeChannelId] ?? null)
  const setPinnedMessage = useStore(s => s.setPinnedMessage)
  const isModHere = useStore(s => s.selfModByChannel[s.activeChannelId] ?? false)
  const pauseScrollOnHover = useStore(s => s.settings.pauseScrollOnHover)
  const smoothScroll = useStore(s => s.settings.smoothScroll)
  const messageSpacing = useStore(s => s.settings.messageSpacing)

  // Ctrl+F opens search; Escape closes it
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 30)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchQuery('')
        setSearchOpen(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [searchOpen])

  const closeSearch = useCallback(() => {
    setSearchQuery('')
    setSearchOpen(false)
  }, [])

  // Poll the pinned message for the active Twitch channel (mods only — the
  // Helix pins endpoint 403s for non-moderators)
  const activeChannel0 = channels.find(c => c.id === activeChannelId)
  const canSeePins = isModHere && activeChannel0?.platform === 'twitch'
  useEffect(() => {
    if (!canSeePins) return
    const channelId = activeChannelId
    const fetchPinned = () => {
      window.chatBridge.invoke(MAIN_CHANNELS.GET_PINNED_MESSAGE, { channelId })
        .then(pin => setPinnedMessage(channelId, pin))
        .catch(() => {})
    }
    fetchPinned()
    const t = setInterval(fetchPinned, 60_000)
    return () => clearInterval(t)
  }, [activeChannelId, canSeePins, setPinnedMessage])

  const handleUnpin = useCallback(() => {
    if (!pinned) return
    const channelId = activeChannelId
    window.chatBridge.invoke(MAIN_CHANNELS.UNPIN_MESSAGE, { channelId, messageId: pinned.messageId })
      .then(() => setPinnedMessage(channelId, null))
      .catch(err => console.error('Unpin failed:', err))
  }, [pinned, activeChannelId, setPinnedMessage])

  const handlePinDuration = useCallback((durationSeconds?: number) => {
    if (!pinned) return
    const channelId = activeChannelId
    window.chatBridge.invoke(MAIN_CHANNELS.UPDATE_PIN, {
      channelId,
      messageId: pinned.messageId,
      durationSeconds
    })
      .then(() => window.chatBridge.invoke(MAIN_CHANNELS.GET_PINNED_MESSAGE, { channelId }))
      .then(pin => setPinnedMessage(channelId, pin))
      .catch(err => console.error('Update pin failed:', err))
  }, [pinned, activeChannelId, setPinnedMessage])

  // Hide the banner client-side once a timed pin expires
  const pinExpired = !!pinned?.endsAt && Date.parse(pinned.endsAt) < Date.now()

  // Search the FULL message buffer (not just the rendered window), then cap
  // what's actually mounted in the DOM to the most recent RENDER_LIMIT rows.
  const query = searchQuery.trim().toLowerCase()
  const filtered = query
    ? messages.filter(m => m.raw?.toLowerCase().includes(query) ||
        m.authorName?.toLowerCase().includes(query) ||
        m.authorDisplayName?.toLowerCase().includes(query))
    : messages

  const visibleMessages = filtered.length > RENDER_LIMIT
    ? filtered.slice(filtered.length - RENDER_LIMIT)
    : filtered

  // Chatterino-style scrollbar minimap: a colored tick per notable message,
  // positioned by its place in the rendered window.
  const marks = visibleMessages.reduce<Array<{ pos: number; color: string }>>((acc, m, i) => {
    let color: string | null = null
    if (m.isMention) color = 'var(--accent)'
    else if (m.messageType === 'redeem') color = '#a970ff'
    else if (m.isHighlighted) color = '#f5c518'
    if (color) acc.push({ pos: (i + 0.5) / visibleMessages.length, color })
    return acc
  }, [])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // On channel switch (remount via key): reset state and jump to bottom
  useLayoutEffect(() => {
    atBottomRef.current = true
    hoveredRef.current = false
    setIsAtBottom(true)
    // Synchronously zero scroll before paint to prevent bleed from previous channel
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [])

  // Keep scroll pinned to bottom as new messages arrive
  useEffect(() => {
    if (atBottomRef.current && !hoveredRef.current) {
      scrollToBottom(smoothScroll ? 'smooth' : 'auto')
    }
  }, [messages.length, scrollToBottom, smoothScroll])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight
    atBottomRef.current = bottom < 60
    setIsAtBottom(atBottomRef.current)
  }, [])

  const handleScrollToBottom = () => {
    atBottomRef.current = true
    setIsAtBottom(true)
    scrollToBottom('smooth')
  }

  const activeChannel = channels.find(c => c.id === activeChannelId)
  const canSend = activeChannelId !== 'all' && !!activeChannel

  const rowPaddingY = messageSpacing === 'compact' ? '0px' : messageSpacing === 'comfortable' ? '3px' : '1px'

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: 'var(--surface-0)', '--row-padding-y': rowPaddingY } as React.CSSProperties}
    >
      {/* Search bar */}
      {searchOpen && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}>
          <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '12px',
              color: 'var(--text-primary)',
              padding: '2px 0'
            }}
          />
          {searchQuery && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={closeSearch}
            title="Close search (Esc)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '2px', flexShrink: 0
            }}
          >
            <XIcon size={12} />
          </button>
        </div>
      )}

      {/* Pinned message card (Twitch-style: collapsed one-liner, expandable) */}
      {pinned && !pinExpired && (
        <div
          onClick={() => setPinExpanded(v => !v)}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
            padding: '6px 10px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Line 1: Pinned by X */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginBottom: '2px'
            }}>
              <Pin size={10} style={{ flexShrink: 0 }} />
              <span>Pinned by <span style={{ fontWeight: 600 }}>{pinned.pinnedByName}</span></span>
            </div>
            {/* Line 2: the message */}
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.4,
              ...(pinExpanded
                ? { wordBreak: 'break-word' as const }
                : {
                    whiteSpace: 'nowrap' as const,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  })
            }}>
              {pinned.text}
            </div>
            {pinExpanded && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                marginTop: '4px',
                fontSize: '10px',
                color: 'var(--text-muted)',
                flexWrap: 'wrap'
              }}>
                <span>Sent by {pinned.senderName}</span>
                {isModHere && (
                  <>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Pin for:
                      {[
                        { label: '1m', seconds: 60 },
                        { label: '5m', seconds: 300 },
                        { label: '30m', seconds: 1800 },
                        { label: '∞', seconds: undefined as number | undefined }
                      ].map(d => (
                        <button
                          key={d.label}
                          onClick={e => { e.stopPropagation(); handlePinDuration(d.seconds) }}
                          title={d.seconds ? `Pin for ${d.label} from now` : 'Pin until the stream ends'}
                          style={{
                            background: 'var(--surface-3)', border: '1px solid var(--border)',
                            borderRadius: '3px', cursor: 'pointer', color: 'var(--text-secondary)',
                            fontSize: '10px', fontWeight: 600, padding: '1px 6px'
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); handleUnpin() }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--danger)', fontSize: '10px', fontWeight: 600, padding: 0
                      }}
                    >
                      Unpin
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <ChevronDown
            size={14}
            style={{
              color: 'var(--text-muted)',
              flexShrink: 0,
              marginTop: '8px',
              transform: pinExpanded ? 'rotate(180deg)' : undefined,
              transition: 'transform 0.12s'
            }}
          />
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {activeChannelId === 'all'
              ? 'Add a channel using the + button above.'
              : 'Waiting for messages…'}
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            onMouseEnter={() => { if (pauseScrollOnHover) hoveredRef.current = true }}
            onMouseLeave={() => { hoveredRef.current = false }}
            onMouseUp={e => {
              const target = e.target as Element
              if (target.closest('button, a, input, textarea, select')) return
              const selection = window.getSelection()
              if (!selection || selection.isCollapsed) {
                chatInputRef.current?.focus()
              }
            }}
            className="h-full overflow-y-auto py-1"
            style={{ overflowAnchor: 'none' }}
          >
            {visibleMessages.map((msg, index) => (
              <MessageRow key={msg.id} message={msg} index={index} />
            ))}
          </div>

          {/* Scrollbar highlight minimap */}
          {marks.length > 0 && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '3px',
                pointerEvents: 'none',
                zIndex: 5
              }}
            >
              {marks.map((mark, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${mark.pos * 100}%`,
                    right: 0,
                    width: '100%',
                    height: '2px',
                    background: mark.color,
                    borderRadius: '1px'
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isAtBottom && (
        <button onClick={handleScrollToBottom} className={styles.scrollToBottom}>
          <ArrowDown size={11} />
          More messages below
        </button>
      )}

      {canSend && <ChatInput ref={chatInputRef} channelId={activeChannelId} />}
    </div>
  )
}
