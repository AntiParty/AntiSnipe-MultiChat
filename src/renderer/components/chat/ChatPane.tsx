import { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { ArrowDown, Search, X as XIcon } from 'lucide-react'
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

  const messages = useActiveMessages()
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)
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

  // Only render the last RENDER_LIMIT messages to keep the DOM lean,
  // then filter by search query if one is active.
  const trimmed = messages.length > RENDER_LIMIT
    ? messages.slice(messages.length - RENDER_LIMIT)
    : messages

  const visibleMessages = searchQuery.trim()
    ? trimmed.filter(m => m.raw?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.authorDisplayName?.toLowerCase().includes(searchQuery.toLowerCase()))
    : trimmed

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
      className="chatPaneRoot"
      style={{ background: 'var(--surface-0)', '--row-padding-y': rowPaddingY } as React.CSSProperties}
    >
      {/* Search bar */}
      {searchOpen && (
        <div className="chatPaneSearch">
          <Search size={12} className="chatPaneSearchIcon" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            spellCheck={false}
            className="chatPaneSearchInput"
          />
          {searchQuery && (
            <span className="chatPaneSearchCount">
              {visibleMessages.length} result{visibleMessages.length !== 1 ? 's' : ''}
            </span>
          )}
          <button
            onClick={closeSearch}
            title="Close search (Esc)"
            className="chatPaneSearchClose"
          >
            <XIcon size={12} />
          </button>
        </div>
      )}

      {messages.length === 0 ? (
        <div className="chatPaneEmpty">
          <p>
            {activeChannelId === 'all'
              ? 'Add a channel using the + button above.'
              : 'Waiting for messages…'}
          </p>
        </div>
      ) : (
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
          className="chatPaneScroller"
          style={{ overflowAnchor: 'none' }}
        >
          {visibleMessages.map((msg, index) => (
            <MessageRow key={msg.id} message={msg} index={index} />
          ))}
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
