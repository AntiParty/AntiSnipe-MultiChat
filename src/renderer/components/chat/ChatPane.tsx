import { useRef, useState, useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown } from 'lucide-react'
import { useStore } from '../../store'
import { useActiveMessages } from '../../hooks/useChat'
import MessageRow from './MessageRow'
import ChatInput from './ChatInput'

export default function ChatPane() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const messages = useActiveMessages()
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 22,
    overscan: 20,
    measureElement: el => el.getBoundingClientRect().height
  })

  // Auto-scroll to bottom when new messages arrive and we're not scrolled up
  useEffect(() => {
    if (isAtBottom && messages.length > 0) {
      virtualizer.scrollToIndex(messages.length - 1, { align: 'end', behavior: 'auto' })
    }
  }, [messages.length, isAtBottom])

  // Reset scroll state when active channel changes
  useEffect(() => {
    setIsAtBottom(true)
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

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--surface-0)' }}>
      {messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {activeChannelId === 'all'
              ? 'Add a channel in the sidebar to get started.'
              : 'Waiting for messages…'}
          </p>
        </div>
      ) : (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-1"
          style={{ overflowAnchor: 'none' }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative'
            }}
          >
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
                <MessageRow message={messages[virtualRow.index]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scroll-to-bottom button */}
      {!isAtBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-16 right-4 z-10 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs shadow-lg transition-all"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <ArrowDown size={12} />
          New messages
        </button>
      )}

      {canSend && <ChatInput channelId={activeChannelId} />}
    </div>
  )
}
