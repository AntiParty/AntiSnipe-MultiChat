import { useState, useEffect } from 'react'
import { useStore } from '../../store'
import { RENDERER_CHANNELS } from '@shared/types/ipc'

export default function StatusBar() {
  const channels = useStore(s => s.channels)
  const connectionStates = useStore(s => s.connectionStates)
  const [updateVersion, setUpdateVersion] = useState<string | null>(null)
  const [downloaded, setDownloaded] = useState(false)

  const connected = channels.filter(c => connectionStates[c.id]?.status === 'connected').length

  useEffect(() => {
    const unsub1 = window.chatBridge.on(RENDERER_CHANNELS.UPDATE_AVAILABLE, ({ version }) => {
      setUpdateVersion(version)
    })
    const unsub2 = window.chatBridge.on(RENDERER_CHANNELS.UPDATE_DOWNLOADED, ({ version }) => {
      setUpdateVersion(version)
      setDownloaded(true)
    })
    return () => { unsub1(); unsub2() }
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 8px',
        height: '18px',
        flexShrink: 0,
        background: 'var(--titlebar-bg)',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: '10px'
      }}
    >
      <span>
        {connected > 0 ? `${connected}/${channels.length} connected` : channels.length > 0 ? 'Connecting…' : 'No channels'}
      </span>

      {updateVersion && (
        <button
          onClick={() => {
            if (downloaded) console.log('Install update')
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '10px',
            cursor: downloaded ? 'pointer' : 'default',
            color: downloaded ? 'var(--success)' : 'var(--accent)',
            padding: 0
          }}
        >
          {downloaded ? `v${updateVersion} ready — restart to update` : `Downloading v${updateVersion}…`}
        </button>
      )}
    </div>
  )
}
