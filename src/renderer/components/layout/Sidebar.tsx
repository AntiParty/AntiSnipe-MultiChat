import { useState } from 'react'
import { Plus, Trash2, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { useSettings } from '../../hooks/useSettings'
import Tooltip from '../ui/Tooltip'
import type { ChannelConfig } from '@shared/types/channel'
import type { Platform } from '@shared/types/message'

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: 'var(--twitch)',
  youtube: 'var(--youtube)',
  kick: 'var(--kick)'
}

const PLATFORM_LABELS: Record<Platform, string> = {
  twitch: 'Twitch',
  youtube: 'YouTube',
  kick: 'Kick'
}

function AddChannelForm({ onAdd }: { onAdd: (c: ChannelConfig) => void }) {
  const [slug, setSlug] = useState('')
  const [platform, setPlatform] = useState<Platform>('twitch')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!slug.trim()) return
    const id = `${platform}:${slug.trim().toLowerCase()}`
    onAdd({
      id,
      platform,
      slug: slug.trim().toLowerCase(),
      displayName: slug.trim(),
      enabled: true
    })
    setSlug('')
  }

  return (
    <form onSubmit={handleSubmit} className="p-2 border-t border-[var(--border)]">
      <div className="flex gap-1 mb-1.5">
        {(['twitch', 'youtube', 'kick'] as Platform[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPlatform(p)}
            className="flex-1 text-xs py-1 rounded transition-colors"
            style={{
              background: platform === p ? PLATFORM_COLORS[p] : 'var(--surface-3)',
              color: platform === p ? 'white' : 'var(--text-secondary)',
              opacity: platform === p ? 1 : 0.7
            }}
          >
            {p[0].toUpperCase()}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        <input
          value={slug}
          onChange={e => setSlug(e.target.value)}
          placeholder="channel name..."
          className="flex-1 text-xs px-2 py-1.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={!slug.trim()}
          className="px-2 py-1.5 rounded bg-[var(--accent)] text-white text-xs hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
  const { settings, save } = useSettings()

  const handleAdd = async (channel: ChannelConfig) => {
    addChannel(channel)
    const updatedChannels = [...settings.channels.filter(c => c.id !== channel.id), channel]
    await save({ channels: updatedChannels })
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
      {/* "All" merged view */}
      <button
        onClick={() => setActiveChannel('all')}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors"
        style={{
          background: activeChannelId === 'all' ? 'var(--accent-subtle)' : 'transparent',
          color: activeChannelId === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
          borderBottom: '1px solid var(--border)'
        }}
      >
        <span className="flex-1 text-left">All Channels</span>
      </button>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto">
        {channels.map(channel => {
          const state = connectionStates[channel.id]
          const isActive = activeChannelId === channel.id
          const unread = unreadCounts[channel.id] ?? 0

          return (
            <div
              key={channel.id}
              onClick={() => setActiveChannel(channel.id)}
              className="group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors"
              style={{
                background: isActive ? 'var(--accent-subtle)' : 'transparent',
                borderLeft: isActive ? `2px solid var(--accent)` : '2px solid transparent'
              }}
            >
              {/* Platform dot */}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: PLATFORM_COLORS[channel.platform] }}
                title={PLATFORM_LABELS[channel.platform]}
              />

              {/* Channel name */}
              <span
                className="flex-1 text-xs truncate"
                style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                {channel.displayName}
              </span>

              {/* Status icon */}
              {state?.status === 'connecting' || state?.status === 'reconnecting' ? (
                <Loader2 size={10} className="animate-spin shrink-0 text-[var(--text-muted)]" />
              ) : state?.status === 'connected' ? (
                <Wifi size={10} className="shrink-0" style={{ color: 'var(--success)' }} />
              ) : state?.status === 'error' || state?.status === 'ended' ? (
                <WifiOff size={10} className="shrink-0" style={{ color: 'var(--danger)' }} />
              ) : null}

              {/* Unread badge */}
              {unread > 0 && activeChannelId !== channel.id && (
                <span
                  className="text-xs rounded-full px-1 min-w-[18px] text-center"
                  style={{ background: 'var(--accent)', color: 'white', fontSize: '10px' }}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              )}

              {/* Remove button (visible on hover) */}
              <Tooltip content="Remove channel">
                <button
                  onClick={e => { e.stopPropagation(); handleRemove(channel.id) }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded transition-opacity hover:text-[var(--danger)]"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Remove channel"
                >
                  <Trash2 size={10} />
                </button>
              </Tooltip>
            </div>
          )
        })}
      </div>

      <AddChannelForm onAdd={handleAdd} />
    </aside>
  )
}
