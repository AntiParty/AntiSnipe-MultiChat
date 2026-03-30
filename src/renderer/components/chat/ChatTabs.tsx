import { useStore } from '../../store'
import type { Platform } from '@shared/types/message'

const PLATFORM_COLORS: Record<Platform, string> = {
  twitch: 'var(--twitch)',
  youtube: 'var(--youtube)',
  kick: 'var(--kick)'
}

export default function ChatTabs() {
  const channels = useStore(s => s.channels)
  const activeChannelId = useStore(s => s.activeChannelId)
  const setActiveChannel = useStore(s => s.setActiveChannel)
  const unreadCounts = useStore(s => s.unreadCounts)

  if (channels.length === 0) return null

  return (
    <div
      className="flex items-center overflow-x-auto shrink-0"
      style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-1)' }}
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
          unread={unreadCounts[channel.id] ?? 0}
        />
      ))}
    </div>
  )
}

interface TabProps {
  label: string
  isActive: boolean
  onClick: () => void
  platformColor?: string
  unread?: number
}

function Tab({ label, isActive, onClick, platformColor, unread }: TabProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-colors relative shrink-0"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
        borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
        background: isActive ? 'var(--surface-2)' : 'transparent'
      }}
    >
      {platformColor && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: platformColor }}
        />
      )}
      <span>{label}</span>
      {unread != null && unread > 0 && !isActive && (
        <span
          className="rounded-full min-w-[16px] px-1 text-center"
          style={{ background: 'var(--accent)', color: 'white', fontSize: '10px' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  )
}
