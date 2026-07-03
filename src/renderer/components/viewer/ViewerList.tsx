import { useState } from 'react'
import { useStore } from '../../store'
import ViewerListEntry from './ViewerListEntry'
import type { ViewerEntry, ViewerRole } from '@shared/types/viewer'

const VIEWER_CAP = 200

// Stable fallback — returning a fresh [] from the selector makes Zustand
// see a new snapshot every render and loops React ("Maximum update depth")
const NO_VIEWERS: ViewerEntry[] = []

const ROLE_ORDER: ViewerRole[] = ['broadcaster', 'mod', 'vip', 'sub', 'viewer']
const ROLE_LABELS: Record<ViewerRole, string> = {
  broadcaster: 'Broadcaster',
  mod:         'Moderators',
  vip:         'VIPs',
  sub:         'Subscribers',
  viewer:      'Viewers',
}

interface GroupProps {
  label: string
  entries: ViewerEntry[]
  channelId: string
  cap?: number
}

function ViewerGroup({ label, entries, channelId, cap }: GroupProps) {
  const [open, setOpen] = useState(true)
  if (entries.length === 0) return null

  const sorted = [...entries].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' })
  )
  const shown = cap ? sorted.slice(0, cap) : sorted
  const overflow = entries.length - shown.length

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '4px 8px 2px',
          marginTop: '4px',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '11px',
          fontWeight: 700,
          textAlign: 'left',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
      >
        {label}
        <span style={{ fontWeight: 400, marginLeft: 3 }}>({entries.length})</span>
      </button>
      {open && (
        <>
          {shown.map(e => (
            <ViewerListEntry key={`${e.platform}:${e.login}`} entry={e} channelId={channelId} />
          ))}
          {overflow > 0 && (
            <div style={{ padding: '1px 8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              +{overflow} more
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface Props {
  channelId: string
}

export default function ViewerList({ channelId }: Props) {
  const viewers = useStore(s => s.viewersByChannel[channelId] ?? NO_VIEWERS)
  const total   = useStore(s => s.viewerTotalByChannel[channelId])
  const isApi   = useStore(s => s.viewerIsApiByChannel[channelId] ?? false)
  const channel = useStore(s => s.channels.find(c => c.id === channelId))

  const grouped: Record<ViewerRole, ViewerEntry[]> = {
    broadcaster: [], mod: [], vip: [], sub: [], viewer: []
  }
  for (const v of viewers) {
    const bucket = grouped[v.role] ?? grouped.viewer
    bucket.push(v)
  }

  const displayTotal = (isApi && total != null) ? total : viewers.length
  const isTwitch = channel?.platform === 'twitch'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header — matches Chatterino "N chatters" style */}
      <div style={{
        padding: '3px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        fontSize: '11px',
        color: 'var(--text-muted)',
        fontWeight: 600,
        userSelect: 'none'
      }}>
        {displayTotal.toLocaleString()} chatters
      </div>

      {/* Grouped list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {ROLE_ORDER.map(role => (
          <ViewerGroup
            key={role}
            label={ROLE_LABELS[role]}
            entries={grouped[role]}
            channelId={channelId}
            cap={role === 'viewer' ? VIEWER_CAP : undefined}
          />
        ))}
        {viewers.length === 0 && (
          <div style={{ padding: '12px 8px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
            No chatters yet
          </div>
        )}
      </div>

      {/* Footer hint — only for Twitch without mod API access */}
      {isTwitch && !isApi && (
        <div style={{
          padding: '3px 8px',
          borderTop: '1px solid var(--border)',
          fontSize: '10px',
          color: 'var(--text-muted)',
          flexShrink: 0,
          fontStyle: 'italic'
        }}>
          Mod access needed for full list
        </div>
      )}
    </div>
  )
}
