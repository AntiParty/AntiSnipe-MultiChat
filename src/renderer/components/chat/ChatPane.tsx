import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown } from 'lucide-react'
import { useStore } from '../../store'
import { useActiveMessages } from '../../hooks/useChat'
import MessageRow from './MessageRow'
import ChatInput from './ChatInput'
import styles from '../../styles/chat.module.css'

export default function ChatPane() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const hoveredRef = useRef(false)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const messages = useActiveMessages()
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)
  const pauseScrollOnHover = useStore(s => s.settings.pauseScrollOnHover)
  const messageSpacing = useStore(s => s.settings.messageSpacing)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 22,
    overscan: 20,
    measureElement: el => el.getBoundingClientRect().height
  })

  useEffect(() => {
    if (isAtBottom && messages.length > 0 && !hoveredRef.current) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' })
    }
  }, [messages.length, isAtBottom])

  useEffect(() => {
    setIsAtBottom(true)
    hoveredRef.current = false
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' })
    }
  }, [activeChannelId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsAtBottom(bottom < 60)
  }, [])

  const scrollToBottom = () => {
    if (messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'smooth' })
      setIsAtBottom(true)
    }
  }

  const activeChannel = channels.find(c => c.id === activeChannelId)
  const canSend = activeChannelId !== 'all' && !!activeChannel

  // Map messageSpacing to a CSS padding value applied to each row
  const rowPaddingY = messageSpacing === 'compact' ? '0px' : messageSpacing === 'comfortable' ? '3px' : '1px'

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ background: 'var(--surface-0)', '--row-padding-y': rowPaddingY } as React.CSSProperties}
    >
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
          className="flex-1 overflow-y-auto py-1"
          style={{ overflowAnchor: 'none' }}
        >
          <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => (
              <div
                key={messages[virtualRow.index].id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <MessageRow message={messages[virtualRow.index]} index={virtualRow.index} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAtBottom && (
        <button onClick={scrollToBottom} className={styles.scrollToBottom}>
          <ArrowDown size={11} />
          More messages below
        </button>
      )}

      {canSend && <ChatInput channelId={activeChannelId} />}
    </div>
  )
}
