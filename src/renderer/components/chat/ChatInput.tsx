import { useState, useRef } from 'react'
import { useStore } from '../../store'

interface ChatInputProps {
  channelId: string
}

export default function ChatInput({ channelId }: ChatInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const channels = useStore(s => s.channels)
  const auth = useStore(s => s.auth)

  const channel = channels.find(c => c.id === channelId)
  const isAuthRequired =
    channel?.platform === 'twitch'
      ? auth.twitch.status !== 'authenticated'
      : channel?.platform === 'youtube'
        ? auth.youtube.status !== 'authenticated'
        : false

  const placeholder = isAuthRequired
    ? `Login to chat in ${channel?.displayName}`
    : `Message ${channel?.displayName}…`

  const handleSend = async () => {
    const msg = text.trim()
    if (!msg || sending || isAuthRequired) return
    setSending(true)
    try {
      await window.chatBridge.invoke('chat:send', { channelId, message: msg })
      setText('')
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 6px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface-1)',
        flexShrink: 0
      }}
    >
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isAuthRequired || sending}
        placeholder={placeholder}
        maxLength={500}
        style={{
          flex: 1,
          fontSize: '12px',
          padding: '4px 7px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          outline: 'none',
          opacity: isAuthRequired ? 0.5 : 1,
          userSelect: 'text',
          WebkitUserSelect: 'text'
        } as React.CSSProperties}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || isAuthRequired || sending}
        aria-label="Send"
        style={{
          padding: '4px 10px',
          fontSize: '11px',
          background: text.trim() && !isAuthRequired ? 'var(--accent)' : 'var(--surface-3)',
          border: '1px solid var(--border)',
          color: text.trim() && !isAuthRequired ? '#fff' : 'var(--text-muted)',
          cursor: text.trim() && !isAuthRequired ? 'pointer' : 'default',
          opacity: !text.trim() || isAuthRequired || sending ? 0.5 : 1,
          flexShrink: 0
        }}
      >
        Send
      </button>
    </div>
  )
}
