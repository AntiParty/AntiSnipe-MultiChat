import { useStore } from '../../store'

export default function ChannelHeader() {
  const activeChannelId = useStore(s => s.activeChannelId)
  const channels = useStore(s => s.channels)
  const viewerCounts = useStore(s => s.viewerCountsByChannel)
  const connectionStates = useStore(s => s.connectionStates)

  if (activeChannelId === 'all') {
    const total = Object.values(viewerCounts).reduce((s, n) => s + n, 0)
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 10px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        minHeight: '22px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>All Channels</span>
        {total > 0 && (
          <span style={{ marginLeft: 8, fontSize: '10px', color: 'var(--text-muted)' }}>
            {total.toLocaleString()} viewers
          </span>
        )}
      </div>
    )
  }

  const channel = channels.find(c => c.id === activeChannelId)
  if (!channel) return null

  const viewers = viewerCounts[activeChannelId]
  const state = connectionStates[activeChannelId]
  const isLive = state?.status === 'connected' && viewers != null && viewers > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '3px 10px',
      background: 'var(--surface-1)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
      minHeight: '22px',
      gap: '6px'
    }}>
      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
        {channel.displayName}
      </span>
      {isLive && (
        <>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e91916', flexShrink: 0 }} />
          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {viewers!.toLocaleString()} viewers
          </span>
        </>
      )}
    </div>
  )
}
