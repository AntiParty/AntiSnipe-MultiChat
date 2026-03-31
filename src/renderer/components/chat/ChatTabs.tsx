import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X } from 'lucide-react'
import { useStore } from '../../store'
import { useSettings } from '../../hooks/useSettings'
import { TwitchLogo, YouTubeLogo, KickLogo, TikTokLogo } from '../ui/PlatformLogos'
import type { Platform } from '@shared/types/message'
import type { ChannelConfig } from '@shared/types/channel'

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: '#9147ff',
  youtube: '#cc0000',
  kick: '#53fc18',
  tiktok: '#ff0050'
}

const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick',
  tiktok: 'TikTok'
}

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
  twitch: <TwitchLogo size={14} />,
  youtube: <YouTubeLogo size={14} />,
  kick: <KickLogo size={14} />,
  tiktok: <TikTokLogo size={14} />
}

const PLATFORM_HINTS: Record<Platform, React.ReactNode> = {
  twitch: <>Enter your channel name (e.g. <code style={{ background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 2 }}>xqc</code>)</>,
  youtube: <>Paste your stream's video ID or URL. Start your stream first, then grab the ID from the URL — e.g. <code style={{ background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 2 }}>TlbHFJewzm4</code></>,
  kick: <>Enter your channel name (e.g. <code style={{ background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 2 }}>xqc</code>)</>,
  tiktok: <>Enter the TikTok username without @ (e.g. <code style={{ background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 2 }}>username</code>). Must be live.</>
}

const PLATFORM_PLACEHOLDERS: Record<Platform, string> = {
  twitch: 'channel name',
  youtube: 'video ID or URL',
  kick: 'channel name',
  tiktok: 'username'
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

  useEffect(() => {
    if (showAdd) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showAdd])

  useEffect(() => {
    if (!showAdd) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowAdd(false); setSlug('') }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showAdd])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const raw = slug.trim().replace(/^@/, '')
    const trimmed = platform === 'youtube' ? raw : raw.toLowerCase()
    if (!trimmed || connecting) return

    const id = `${platform}:${trimmed}`
    if (channels.some(c => c.id === id)) {
      setShowAdd(false)
      setSlug('')
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

  const handleRename = async (channelId: string, newName: string) => {
    const updated = settings.channels.map(c =>
      c.id === channelId ? { ...c, displayName: newName } : c
    )
    await save({ channels: updated })
    addChannel({ ...settings.channels.find(c => c.id === channelId)!, displayName: newName })
  }

  return (
    <>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        height: '26px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollbarWidth: 'none',
        flexShrink: 0
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
            onRename={newName => handleRename(channel.id, newName)}
          />
        ))}
        <button
          onClick={() => setShowAdd(true)}
          title="Add channel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            flexShrink: 0,
            border: 'none',
            borderBottom: '2px solid transparent',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'color 0.1s'
          }}
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Centered modal overlay */}
      {showAdd && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setShowAdd(false); setSlug('') } }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(2px)'
          }}
        >
          <div style={{
            width: '320px',
            background: 'var(--surface-1)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 12px',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Add Channel
              </span>
              <button
                onClick={() => { setShowAdd(false); setSlug('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleAdd} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Platform selector */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['twitch', 'youtube', 'kick', 'tiktok'] as Platform[]).map(p => {
                  const active = platform === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setPlatform(p); setSlug('') }}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                        padding: '8px 4px',
                        border: active ? `1px solid ${PLATFORM_COLORS[p]}66` : '1px solid var(--border)',
                        background: active ? `${PLATFORM_COLORS[p]}1a` : 'var(--surface-2)',
                        color: active ? PLATFORM_COLORS[p] : 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: active ? 700 : 400,
                        borderRadius: '5px',
                        transition: 'all 0.1s'
                      }}
                    >
                      {PLATFORM_ICONS[p]}
                      <span>{PLATFORM_LABELS[p]}</span>
                    </button>
                  )
                })}
              </div>

              {/* Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  ref={inputRef}
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder={PLATFORM_PLACEHOLDERS[platform]}
                  autoComplete="off"
                  spellCheck={false}
                  style={{
                    fontSize: '13px',
                    padding: '8px 10px',
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border)',
                    borderRadius: '5px',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = PLATFORM_COLORS[platform] }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                />
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {PLATFORM_HINTS[platform]}
                </p>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!slug.trim() || connecting}
                style={{
                  padding: '9px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: slug.trim() && !connecting ? PLATFORM_COLORS[platform] : 'var(--surface-3)',
                  border: 'none',
                  color: slug.trim() && !connecting ? '#fff' : 'var(--text-muted)',
                  cursor: slug.trim() && !connecting ? 'pointer' : 'default',
                  borderRadius: '5px',
                  transition: 'background 0.15s',
                  opacity: connecting ? 0.7 : 1
                }}
              >
                {connecting ? 'Connecting…' : `Add ${PLATFORM_LABELS[platform]} Channel`}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

interface TabProps {
  label: string
  isActive: boolean
  onClick: () => void
  platformColor?: string
  unread?: number
  onRemove?: (e: React.MouseEvent) => void
  onRename?: (newName: string) => void
}

function Tab({ label, isActive, onClick, platformColor, unread, onRemove, onRename }: TabProps) {
  const [hovered, setHovered] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(label)
  const renameRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (renaming) setTimeout(() => { renameRef.current?.select() }, 20)
  }, [renaming])

  useEffect(() => {
    if (!menu) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY })
  }

  const startRename = () => {
    setRenameValue(label)
    setMenu(null)
    setRenaming(true)
  }

  const commitRename = () => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== label) onRename?.(trimmed)
    setRenaming(false)
  }

  return (
    <>
      <div
        onClick={onClick}
        onContextMenu={handleContextMenu}
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
        {renaming ? (
          <input
            ref={renameRef}
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
              e.stopPropagation()
            }}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '11px',
              background: 'var(--surface-0)',
              border: '1px solid var(--accent)',
              borderRadius: '2px',
              color: 'var(--text-primary)',
              outline: 'none',
              padding: '0 3px',
              width: `${Math.max(60, renameValue.length * 7)}px`
            }}
          />
        ) : (
          <span>{label}</span>
        )}
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
        {hovered && !renaming && onRemove && (
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

      {/* Context menu */}
      {menu && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menu.y,
            left: menu.x,
            zIndex: 200,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            minWidth: '130px'
          }}
        >
          <button
            onClick={startRename}
            style={{
              display: 'block',
              width: '100%',
              padding: '7px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              fontSize: '12px',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            Rename
          </button>
          {onRemove && (
            <button
              onClick={e => { setMenu(null); onRemove(e) }}
              style={{
                display: 'block',
                width: '100%',
                padding: '7px 12px',
                background: 'none',
                border: 'none',
                borderTop: '1px solid var(--border)',
                textAlign: 'left',
                fontSize: '12px',
                color: 'var(--danger)',
                cursor: 'pointer'
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </>
  )
}
