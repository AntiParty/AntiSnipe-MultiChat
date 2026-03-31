import { useState, useRef, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import { useSettings } from '../../hooks/useSettings'
import { TwitchLogo, YouTubeLogo, KickLogo } from '../ui/PlatformLogos'
import type { Platform } from '@shared/types/message'
import type { ChannelConfig } from '@shared/types/channel'

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: '#9147ff',
  youtube: '#cc0000',
  kick: '#53fc18'
}

const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick'
}

const PLATFORM_PREFIXES: Record<Platform, string> = {
  twitch: 'twitch.tv/',
  youtube: 'youtube.com/',
  kick: 'kick.com/'
}

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  twitch: <TwitchLogo size={12} />,
  youtube: <YouTubeLogo size={12} />,
  kick: <KickLogo size={12} />
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
  const [connecting, setConnecting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showAdd) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showAdd])

  useEffect(() => {
    if (!showAdd) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowAdd(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAdd])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = slug.trim().toLowerCase().replace(/^@/, '')
    if (!trimmed || connecting) return

    const id = `${platform}:${trimmed}`
    if (channels.some(c => c.id === id)) {
      setShowAdd(false)
      setActiveChannel(id)
      return
    }

    const channel: ChannelConfig = {
      id,
      platform,
      slug: trimmed,
      displayName: slug.trim().replace(/^@/, ''),
      enabled: true
    }

    setConnecting(true)
    addChannel(channel)
    await save({ channels: [...settings.channels.filter(c => c.id !== id), channel] })
    await window.chatBridge.invoke('channel:connect', { channelId: id, platform, slug: trimmed })
    setSlug('')
    setShowAdd(false)
    setConnecting(false)
    setActiveChannel(id)
  }

  const handleRemove = async (channelId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await window.chatBridge.invoke('channel:disconnect', { channelId })
    removeChannel(channelId)
    await save({ channels: settings.channels.filter(c => c.id !== channelId) })
  }

  return (
    <div style={{ flexShrink: 0, position: 'relative' }} ref={panelRef}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '26px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none'
      }}>
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
            unread={unreadCounts[channel.id] ?? 0}
            onRemove={e => handleRemove(channel.id, e)}
          />
        ))}
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
            cursor: 'pointer',
            transition: 'color 0.1s'
          }}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Add channel panel */}
      {showAdd && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          zIndex: 50,
          width: '268px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderTop: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            padding: '9px 12px 8px',
            borderBottom: '1px solid var(--border)',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.07em',
            textTransform: 'uppercase'
          }}>
            Add Channel
          </div>

          <form onSubmit={handleAdd} style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {/* Platform selector */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {(['twitch', 'youtube', 'kick'] as Platform[]).map(p => {
                const active = platform === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlatform(p)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      padding: '6px 2px',
                      border: active ? `1px solid ${PLATFORM_COLORS[p]}55` : '1px solid var(--border)',
                      background: active ? `${PLATFORM_COLORS[p]}18` : 'var(--surface-2)',
                      color: active ? PLATFORM_COLORS[p] : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: active ? 600 : 400,
                      borderRadius: '3px',
                      transition: 'all 0.1s'
                    }}
                  >
                    {PLATFORM_ICONS[p]}
                    <span>{PLATFORM_LABELS[p]}</span>
                  </button>
                )
              })}
            </div>

            {/* URL-prefix input */}
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'stretch',
                background: 'var(--surface-0)',
                border: '1px solid var(--border)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <span style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 7px',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  background: 'var(--surface-2)',
                  borderRight: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  userSelect: 'none'
                }}>
                  {PLATFORM_PREFIXES[platform]}
                </span>
                <input
                  ref={inputRef}
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="channel name"
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    flex: 1,
                    fontSize: '12px',
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    minWidth: 0
                  }}
                />
              </div>
              {slug.trim() && (
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', paddingLeft: '1px' }}>
                  → <span style={{ color: 'var(--text-secondary)' }}>
                    {PLATFORM_PREFIXES[platform]}{slug.trim().toLowerCase().replace(/^@/, '')}
                  </span>
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!slug.trim() || connecting}
              style={{
                padding: '7px',
                fontSize: '12px',
                fontWeight: 600,
                background: slug.trim() && !connecting ? PLATFORM_COLORS[platform] : 'var(--surface-3)',
                border: 'none',
                color: slug.trim() && !connecting ? '#fff' : 'var(--text-muted)',
                cursor: slug.trim() && !connecting ? 'pointer' : 'default',
                borderRadius: '3px',
                transition: 'background 0.15s',
                opacity: connecting ? 0.65 : 1
              }}
            >
              {connecting ? 'Connecting…' : `Add ${PLATFORM_LABELS[platform]} Channel`}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

interface TabProps {
  label: string
  isActive: boolean
  onClick: () => void
  platformColor?: string
  unread?: number
  onRemove?: (e: React.MouseEvent) => void
}

function Tab({ label, isActive, onClick, platformColor, unread, onRemove }: TabProps) {
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
        borderBottom: isActive
          ? `2px solid ${platformColor ?? 'var(--accent)'}`
          : '2px solid transparent',
        background: isActive || hovered ? 'var(--surface-2)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        transition: 'background 0.1s'
      }}
    >
      {platformColor && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: platformColor,
          flexShrink: 0,
          opacity: isActive ? 1 : 0.7
        }} />
      )}
      <span>{label}</span>
      {unread != null && unread > 0 && !isActive && (
        <span style={{
          fontSize: '9px',
          padding: '0 4px',
          background: 'var(--accent)',
          color: '#fff',
          minWidth: '15px',
          textAlign: 'center',
          borderRadius: '8px',
          flexShrink: 0
        }}>
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      {hovered && onRemove && (
        <button
          onClick={onRemove}
          title="Remove channel"
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
            lineHeight: 1,
            transition: 'color 0.1s'
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
        >
          <X size={9} />
        </button>
      )}
    </div>
  )
}
