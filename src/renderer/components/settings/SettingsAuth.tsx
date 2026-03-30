import { useStore } from '../../store'
import { useSettings } from '../../hooks/useSettings'
import Button from '../ui/Button'
import Input from '../ui/Input'

export default function SettingsAuth() {
  const auth = useStore(s => s.auth)
  const { settings, save } = useSettings()

  const handleTwitchLogin = () => window.chatBridge.invoke('auth:twitch:start')
  const handleYouTubeLogin = () => window.chatBridge.invoke('auth:youtube:start')
  const handleTwitchLogout = () => window.chatBridge.invoke('auth:logout', { platform: 'twitch' })
  const handleYouTubeLogout = () => window.chatBridge.invoke('auth:logout', { platform: 'youtube' })

  return (
    <div className="space-y-6">
      {/* Twitch */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Twitch
        </h3>
        <div className="space-y-3">
          <Input
            label="Client ID"
            value={settings.twitchClientId}
            onChange={e => save({ twitchClientId: e.target.value })}
            placeholder="From dev.twitch.tv/console"
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Create a free application at dev.twitch.tv/console. Set the OAuth redirect URL to{' '}
            <code className="px-1 rounded" style={{ background: 'var(--surface-3)' }}>
              antisinemultichat://auth/twitch
            </code>
          </p>

          {auth.twitch.status === 'authenticated' ? (
            <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                  Connected as {auth.twitch.username}
                </p>
              </div>
              <Button size="sm" variant="danger" onClick={handleTwitchLogout}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleTwitchLogin}
              disabled={!settings.twitchClientId}
              style={{ background: 'var(--twitch)' }}
            >
              Connect with Twitch
            </Button>
          )}
        </div>
      </section>

      {/* YouTube */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          YouTube
        </h3>
        <div className="space-y-3">
          <Input
            label="Google Client ID (for OAuth)"
            value={settings.googleClientId}
            onChange={e => save({ googleClientId: e.target.value })}
            placeholder="From console.cloud.google.com"
          />
          <Input
            label="API Key (read-only fallback)"
            value={settings.youtubeApiKey}
            onChange={e => save({ youtubeApiKey: e.target.value })}
            placeholder="AIza…"
          />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Enable the YouTube Data API v3 in Google Cloud Console. Set redirect URI to{' '}
            <code className="px-1 rounded" style={{ background: 'var(--surface-3)' }}>
              antisinemultichat://auth/youtube
            </code>
          </p>

          {auth.youtube.status === 'authenticated' ? (
            <div className="flex items-center justify-between p-3 rounded-md" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                Connected as {auth.youtube.username}
              </p>
              <Button size="sm" variant="danger" onClick={handleYouTubeLogout}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleYouTubeLogin}
              disabled={!settings.googleClientId}
              style={{ background: '#cc0000' }}
            >
              Connect with YouTube
            </Button>
          )}
        </div>
      </section>

      {/* Kick note */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Kick
        </h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Kick chat is read via a public WebSocket — no authentication required.
          Sending messages on Kick requires a session cookie and is limited.
        </p>
      </section>
    </div>
  )
}
