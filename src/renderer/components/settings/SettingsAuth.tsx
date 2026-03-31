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

        <div
          style={{
            padding: '10px 12px',
            marginBottom: '12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            fontSize: '11px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)'
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
            How to set up Twitch auth
          </p>
          <ol style={{ paddingLeft: '16px', margin: 0 }}>
            <li>Go to <span style={{ color: 'var(--accent)' }}>dev.twitch.tv/console</span> and log in</li>
            <li>Click <strong>Register Your Application</strong></li>
            <li>Name: anything (e.g. "MultiChat")</li>
            <li>OAuth Redirect URL: <code style={{ background: 'var(--surface-3)', padding: '1px 4px' }}>http://localhost:47891/auth/twitch</code></li>
            <li>Category: <strong>Chat Bot</strong> — click <strong>Create</strong></li>
            <li>Click <strong>Manage</strong> on your app, then <strong>New Secret</strong></li>
            <li>Copy both the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
          </ol>
        </div>

        <div className="space-y-3">
          <Input
            label="Client ID"
            value={settings.twitchClientId}
            onChange={e => save({ twitchClientId: e.target.value })}
            placeholder="Paste your Client ID here"
          />
          <Input
            label="Client Secret"
            type="password"
            value={settings.twitchClientSecret}
            onChange={e => save({ twitchClientSecret: e.target.value })}
            placeholder="Paste your Client Secret here"
          />

          {auth.twitch.status === 'authenticated' ? (
            <div
              className="flex items-center justify-between"
              style={{ padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--success)' }}>
                Connected as <strong>{auth.twitch.username}</strong>
              </p>
              <Button size="sm" variant="danger" onClick={handleTwitchLogout}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              onClick={handleTwitchLogin}
              disabled={!settings.twitchClientId || !settings.twitchClientSecret}
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

        <div
          style={{
            padding: '10px 12px',
            marginBottom: '12px',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            fontSize: '11px',
            lineHeight: 1.6,
            color: 'var(--text-secondary)'
          }}
        >
          <p style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>
            How to get a Google Client ID
          </p>
          <ol style={{ paddingLeft: '16px', margin: 0 }}>
            <li>Go to <span style={{ color: 'var(--accent)' }}>console.cloud.google.com</span></li>
            <li>Create a project, then go to <strong>APIs & Services → Credentials</strong></li>
            <li>Click <strong>Create Credentials → OAuth client ID</strong></li>
            <li>Application type: <strong>Desktop app</strong></li>
            <li>Under <strong>Authorized redirect URIs</strong> add: <code style={{ background: 'var(--surface-3)', padding: '1px 4px' }}>http://localhost:47891/auth/youtube</code></li>
            <li>Enable <strong>YouTube Data API v3</strong> in the API Library</li>
            <li>Copy both the <strong>Client ID</strong> and <strong>Client Secret</strong></li>
          </ol>
        </div>

        <div className="space-y-3">
          <Input
            label="Google Client ID"
            value={settings.googleClientId}
            onChange={e => save({ googleClientId: e.target.value })}
            placeholder="Paste your Google Client ID here"
          />
          <Input
            label="Google Client Secret"
            type="password"
            value={settings.googleClientSecret}
            onChange={e => save({ googleClientSecret: e.target.value })}
            placeholder="Paste your Client Secret here"
          />
          {!settings.googleClientSecret && settings.googleClientId && (
            <p style={{ fontSize: '11px', color: 'var(--warning, #f59e0b)', margin: '-4px 0 0' }}>
              Client Secret is required — Google will reject the token exchange without it.
            </p>
          )}
          <Input
            label="YouTube API Key (optional — for read-only without OAuth)"
            value={settings.youtubeApiKey}
            onChange={e => save({ youtubeApiKey: e.target.value })}
            placeholder="AIza…"
          />

          {auth.youtube.status === 'authenticated' ? (
            <div
              className="flex items-center justify-between"
              style={{ padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--success)' }}>
                Connected as <strong>{auth.youtube.username}</strong>
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

      {/* Kick */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Kick
        </h3>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Kick chat is read via a public WebSocket — no account or API key required.
          Just add a Kick channel using the <strong>+</strong> button in the tab bar.
        </p>
      </section>

    </div>
  )
}
