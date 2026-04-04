import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../../store'

export default function UpdateBanner() {
  const { downloaded } = useStore(s => s.updateStatus)
  const setUpdateStatus = useStore(s => s.setUpdateStatus)
  const [dismissed, setDismissed] = useState(false)

  if (!downloaded || dismissed) return null

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 10px',
      background: 'var(--accent)',
      color: '#fff',
      fontSize: '11px',
      flexShrink: 0
    }}>
      <Download size={12} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        v{downloaded} is ready to install.
      </span>
      <button
        onClick={() => window.chatBridge.invoke('updater:install')}
        style={{
          background: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.35)',
          color: '#fff',
          borderRadius: '3px',
          padding: '2px 10px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          flexShrink: 0
        }}
      >
        Restart &amp; Install
      </button>
      <button
        onClick={() => { setDismissed(true); setUpdateStatus({ downloaded: null }) }}
        title="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          display: 'flex',
          padding: 2,
          flexShrink: 0
        }}
      >
        <X size={12} />
      </button>
    </div>
  )
}
