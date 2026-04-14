import { useState } from 'react'
import type { ViewerEntry, ViewerRole } from '@shared/types/viewer'

// Role colors matching Chatterino conventions
const ROLE_COLORS: Record<ViewerRole, string | null> = {
  broadcaster: '#e91916',
  mod:         '#00ad03',
  vip:         '#e005b9',
  sub:         null,        // default text color
  viewer:      null,
}

interface Props {
  entry: ViewerEntry
  channelId: string
}

export default function ViewerListEntry({ entry, channelId }: Props) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const color = ROLE_COLORS[entry.role] ?? 'var(--text-primary)'

  const handleClick = () => {
    if (entry.platform === 'twitch' && entry.userId) {
      window.chatBridge.invoke('usercard:openWindow', {
        userId: entry.userId,
        login: entry.login,
        channelId
      })
    } else {
      setPopoverOpen(v => !v)
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        onClick={handleClick}
        style={{
          padding: '1px 8px',
          cursor: 'pointer',
          fontSize: '12px',
          color,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          userSelect: 'none'
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        title={entry.login !== entry.displayName ? `${entry.displayName} (${entry.login})` : undefined}
      >
        {entry.displayName}
      </div>

      {popoverOpen && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '100%',
            zIndex: 50,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '5px',
            padding: '8px 10px',
            minWidth: '140px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            fontSize: '11px'
          }}
          onMouseLeave={() => setPopoverOpen(false)}
        >
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {entry.displayName}
          </div>
          {entry.login !== entry.displayName && (
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{entry.login}</div>
          )}
          {entry.messageCount > 0 && (
            <div style={{ color: 'var(--text-muted)' }}>{entry.messageCount} messages</div>
          )}
        </div>
      )}
    </div>
  )
}
