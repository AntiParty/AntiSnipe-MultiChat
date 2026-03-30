import { useState, useRef } from 'react'
import { Send } from 'lucide-react'
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
    ? `Login required to chat in ${channel?.displayName}`
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
      className="flex items-center gap-2 px-3 py-2 shrink-0"
      style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-1)' }}
    >
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isAuthRequired || sending}
        placeholder={placeholder}
        maxLength={500}
        className="flex-1 text-sm px-3 py-1.5 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 transition-colors"
        style={{ userSelect: 'text', WebkitUserSelect: 'text' } as React.CSSProperties}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || isAuthRequired || sending}
        className="flex items-center justify-center w-8 h-8 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: text.trim() && !isAuthRequired ? 'var(--accent)' : 'var(--surface-3)', color: 'white' }}
        aria-label="Send"
      >
        <Send size={14} />
      </button>
    </div>
  )
}
