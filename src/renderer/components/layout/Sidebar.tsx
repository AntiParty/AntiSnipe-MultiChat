import { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { useSettings } from '../../hooks/useSettings'
import type { ChannelConfig } from '@shared/types/channel'
import type { Platform } from '@shared/types/message'

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: '#9147ff',
  youtube: '#cc0000',
  kick: '#53fc18',
  tiktok: '#ff0050'
}
const PLATFORM_INITIALS: Record<Platform, string> = {
  twitch: 'T',
  youtube: 'Y',
  kick: 'K',
  tiktok: 'TT'
}

function AddChannelForm({ onAdd }: { onAdd: (c: ChannelConfig) => void }) {
  const [slug, setSlug] = useState('')
  const [platform, setPlatform] = useState<Platform>('twitch')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!slug.trim()) return
    const id = `${platform}:${slug.trim().toLowerCase()}`
    onAdd({ id, platform, slug: slug.trim().toLowerCase(), displayName: slug.trim(), enabled: true })
    setSlug('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ borderTop: '1px solid var(--border)', padding: '6px' }}
    >
      {/* Platform selector */}
      <div className="flex mb-1" style={{ gap: '2px' }}>
        {(['twitch', 'youtube', 'kick'] as Platform[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className="flex-1 text-center"
            style={{
              fontSize: '10px',
              padding: '2px 0',
              background: platform === p ? PLATFORM_COLORS[p] : 'var(--surface-3)',
              color: platform === p ? '#fff' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {PLATFORM_INITIALS[p]}
          </button>
        ))}
      </div>

      <div className="flex" style={{ gap: '4px' }}>
        <input
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="channel…"
          style={{
            flex: 1,
            fontSize: '11px',
            padding: '3px 6px',
            background: 'var(--surface-2)',
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
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '12px',
            opacity: slug.trim() ? 1 : 0.4
          }}
          onMouseEnter={e => { if (slug.trim()) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-4)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-3)' }}
        >
          <Plus size={12} />
        </button>
      </div>
    </form>
  )
}

export default function Sidebar() {
  const channels = useStore(s => s.channels)
  const connectionStates = useStore(s => s.connectionStates)
  const activeChannelId = useStore(s => s.activeChannelId)
  const setActiveChannel = useStore(s => s.setActiveChannel)
  const addChannel = useStore(s => s.addChannel)
  const removeChannel = useStore(s => s.removeChannel)
  const unreadCounts = useStore(s => s.unreadCounts)
  const viewerCounts = useStore(s => s.viewerCountsByChannel)
  const showViewerCount = useStore(s => s.settings.showViewerCount)
  const { settings, save } = useSettings()

  const handleAdd = async (channel: ChannelConfig) => {
    addChannel(channel)
    await save({ channels: [...settings.channels.filter(c => c.id !== channel.id), channel] })
    await window.chatBridge.invoke('channel:connect', {
      channelId: channel.id,
      platform: channel.platform,
      slug: channel.slug
    })
  }

  const handleRemove = async (channelId: string) => {
    await window.chatBridge.invoke('channel:disconnect', { channelId })
    removeChannel(channelId)
    await save({ channels: settings.channels.filter(c => c.id !== channelId) })
  }

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)'
      }}
    >
      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {/* All tab */}
        <ChannelEntry
          label="All"
          isActive={activeChannelId === 'all'}
          onClick={() => setActiveChannel('all')}
          platformColor={undefined}
          platformLabel="ALL"
          unread={Object.values(unreadCounts).reduce((s, n) => s + n, 0)}
          viewerCount={showViewerCount ? Object.values(viewerCounts).reduce((s, n) => s + n, 0) : undefined}
        />

        {channels.map(channel => {
          const state = connectionStates[channel.id]
          const status = state?.status
          return (
            <ChannelEntry
              key={channel.id}
              label={channel.displayName}
              isActive={activeChannelId === channel.id}
              onClick={() => setActiveChannel(channel.id)}
              onRemove={() => handleRemove(channel.id)}
              platformColor={PLATFORM_COLORS[channel.platform]}
              platformLabel={PLATFORM_INITIALS[channel.platform]}
              unread={unreadCounts[channel.id] ?? 0}
              status={status}
              statusError={state?.error}
              viewerCount={showViewerCount ? viewerCounts[channel.id] : undefined}
            />
          )
        })}
      </div>

      <AddChannelForm onAdd={handleAdd} />
    </aside>
  )
}

interface ChannelEntryProps {
  label: string
  isActive: boolean
  onClick: () => void
  onRemove?: () => void
  platformColor?: string
  platformLabel?: string
  unread: number
  status?: string
  statusError?: string
  viewerCount?: number
}

function ChannelEntry({
  label, isActive, onClick, onRemove, platformColor, platformLabel, unread, status, statusError, viewerCount
}: ChannelEntryProps) {
  const [hovered, setHovered] = useState(false)

  const isLoading = status === 'connecting' || status === 'reconnecting'
  const isError = status === 'error' || status === 'ended'
  const isOffline = status === 'offline'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '7px 10px',
        cursor: 'pointer',
        background: isActive ? 'var(--surface-2)' : hovered ? 'var(--surface-1)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
        minHeight: '34px'
      }}
    >
      {/* Platform initial badge */}
      <span
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: platformColor ?? 'var(--text-muted)',
          flexShrink: 0,
          width: '16px',
          textAlign: 'center'
        }}
      >
        {platformLabel}
      </span>

      {/* Channel name + viewer count */}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: '12px',
            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {label}
        </span>
        {viewerCount != null && viewerCount > 0 && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
            👁 {viewerCount.toLocaleString()}
          </span>
        )}
      </span>

      {/* Status / unread / remove */}
      {isLoading && (
        <Loader2 size={10} className="animate-spin" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      )}
      {isError && (
        <span
          title={statusError ?? 'Connection error'}
          style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--danger)', flexShrink: 0, cursor: 'help' }}
        />
      )}
      {isOffline && (
        <span
          title={statusError ?? 'Not live'}
          style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--text-muted)', flexShrink: 0, cursor: 'help' }}
        />
      )}
      {unread > 0 && !isActive && (
        <span
          style={{
            fontSize: '9px',
            padding: '1px 4px',
            borderRadius: '8px',
            background: 'var(--accent)',
            color: '#fff',
            flexShrink: 0,
            minWidth: '16px',
            textAlign: 'center'
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
      {hovered && onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove() }}
          aria-label="Remove"
          style={{
            flexShrink: 0,
            background: 'none',
            border: 'none',
            padding: '2px',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            lineHeight: 1
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)' }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}
