import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import { useSettings } from '../../hooks/useSettings'
import type { Platform } from '@shared/types/message'
import type { ChannelConfig } from '@shared/types/channel'

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: '#9147ff',
  youtube: '#cc0000',
  kick: '#53fc18'
}
const PLATFORM_INITIALS: Record<Platform, string> = {
  twitch: 'T',
  youtube: 'Y',
  kick: 'K'
}

export default function ChatTabs() {
  const channels = useStore(s => s.channels)
  const activeChannelId = useStore(s => s.activeChannelId)
  const setActiveChannel = useStore(s => s.setActiveChannel)
  const addChannel = useStore(s => s.addChannel)
  const removeChannel = useStore(s => s.removeChannel)
  const unreadCounts = useStore(s => s.unreadCounts)
  const { settings, save } = useSettings()

  const [showAdd, setShowAdd] = useState(false)
  const [slug, setSlug] = useState('')
  const [platform, setPlatform] = useState<Platform>('twitch')
  const inputRef = useRef<HTMLInputElement>(null)
  const addPanelRef = useRef<HTMLDivElement>(null)

  // Focus input when panel opens
  useEffect(() => {
    if (showAdd) inputRef.current?.focus()
  }, [showAdd])

  // Close panel on outside click
  useEffect(() => {
    if (!showAdd) return
    const handler = (e: MouseEvent) => {
      if (addPanelRef.current && !addPanelRef.current.contains(e.target as Node)) {
        setShowAdd(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAdd])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = slug.trim().toLowerCase()
    if (!trimmed) return
    const id = `${platform}:${trimmed}`
    const channel: ChannelConfig = {
      id,
      platform,
      slug: trimmed,
      displayName: slug.trim(),
      enabled: true
    }
    addChannel(channel)
    await save({ channels: [...settings.channels.filter(c => c.id !== id), channel] })
    await window.chatBridge.invoke('channel:connect', {
      channelId: id,
      platform,
      slug: trimmed
    })
    setSlug('')
    setShowAdd(false)
    setActiveChannel(id)
  }

  const handleRemove = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.chatBridge.invoke('channel:disconnect', { channelId })
    removeChannel(channelId)
    await save({ channels: settings.channels.filter(c => c.id !== channelId) })
  }

  return (
    <div style={{ flexShrink: 0, position: 'relative' }} ref={addPanelRef}>
      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          height: '26px',
          background: 'var(--surface-1)',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto',
          overflowY: 'hidden'
        }}
      >
        {/* All tab */}
        <Tab
          label="All"
          isActive={activeChannelId === 'all'}
          onClick={() => setActiveChannel('all')}
        />

        {channels.map(channel => (
          <Tab
            key={channel.id}
            label={channel.displayName}
            isActive={activeChannelId === channel.id}
            onClick={() => setActiveChannel(channel.id)}
            platformColor={PLATFORM_COLORS[channel.platform]}
            platformInitial={PLATFORM_INITIALS[channel.platform]}
            unread={unreadCounts[channel.id] ?? 0}
            onRemove={e => handleRemove(channel.id, e)}
          />
        ))}

        {/* Add button */}
        <button
          onClick={() => setShowAdd(v => !v)}
          title="Add channel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            flexShrink: 0,
            border: 'none',
            borderBottom: showAdd ? '2px solid var(--accent)' : '2px solid transparent',
            background: showAdd ? 'var(--surface-2)' : 'transparent',
            color: showAdd ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Add channel panel — drops down below tab bar */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '6px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderTop: 'none',
            width: '200px'
          }}
        >
          {/* Platform selector */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {(['twitch', 'youtube', 'kick'] as Platform[]).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                style={{
                  flex: 1,
                  fontSize: '10px',
                  padding: '2px 0',
                  border: 'none',
                  cursor: 'pointer',
                  background: platform === p ? PLATFORM_COLORS[p] : 'var(--surface-3)',
                  color: platform === p ? '#fff' : 'var(--text-muted)'
                }}
              >
                {PLATFORM_INITIALS[p]}
              </button>
            ))}
          </div>

          {/* Input + submit */}
          <div style={{ display: 'flex', gap: '3px' }}>
            <input
              ref={inputRef}
              value={slug}
              onChange={e => setSlug(e.target.value)}
              placeholder="channel name…"
              style={{
                flex: 1,
                fontSize: '11px',
                padding: '3px 6px',
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                outline: 'none',
                minWidth: 0
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            />
            <button
              type="submit"
              disabled={!slug.trim()}
              style={{
                padding: '3px 7px',
                fontSize: '11px',
                background: 'var(--surface-3)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                opacity: slug.trim() ? 1 : 0.4,
                flexShrink: 0
              }}
            >
              Add
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

interface TabProps {
  label: string
  isActive: boolean
  onClick: () => void
  platformColor?: string
  platformInitial?: string
  unread?: number
  onRemove?: (e: React.MouseEvent) => void
}

function Tab({ label, isActive, onClick, platformColor, platformInitial, unread, onRemove }: TabProps) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0 8px',
        fontSize: '11px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        height: '100%',
        cursor: 'pointer',
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        background: isActive ? 'var(--surface-2)' : hovered ? 'var(--surface-2)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
      }}
    >
      {platformColor && platformInitial && (
        <span style={{ fontSize: '9px', fontWeight: 700, color: platformColor }}>
          {platformInitial}
        </span>
      )}
      <span>{label}</span>
      {unread != null && unread > 0 && !isActive && (
        <span
          style={{
            fontSize: '9px',
            padding: '0 3px',
            background: 'var(--accent)',
            color: '#fff',
            minWidth: '14px',
            textAlign: 'center',
            flexShrink: 0
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      {hovered && onRemove && (
        <button
          onClick={onRemove}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: 'none',
            padding: '1px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
            lineHeight: 1
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          <X size={9} />
        </button>
      )}
    </div>
  )
}
