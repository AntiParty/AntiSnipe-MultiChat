import { useState } from 'react'
import { useSettings } from '../../hooks/useSettings'
import { useStore } from '../../store'
import Toggle from '../ui/Toggle'
import Slider from '../ui/Slider'
import type { Theme, MessageSpacing, TimestampFormat, UsernameDisplay, DeletedMessageStyle } from '@shared/types/settings'

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
      {children}
    </h3>
  )
}

function OptionRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{label}</p>
        {description && <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>{description}</p>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  )
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', gap: '2px', background: 'var(--surface-2)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)' }}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          style={{
            padding: '3px 9px',
            fontSize: '11px',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            background: value === opt.value ? 'var(--surface-0)' : 'transparent',
            color: value === opt.value ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: value === opt.value ? 600 : 400,
            transition: 'all 0.1s',
            boxShadow: value === opt.value ? '0 1px 3px rgba(0,0,0,0.3)' : 'none'
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function SettingsGeneral() {
  const { settings, save } = useSettings()
  const updateStatus = useStore(s => s.updateStatus)
  const setUpdateStatus = useStore(s => s.setUpdateStatus)
  const [justChecked, setJustChecked] = useState(false)

  async function handleCheckForUpdates() {
    setJustChecked(false)
    setUpdateStatus({ checking: true, error: null })
    await window.chatBridge.invoke('updater:check')
    setJustChecked(true)
  }

  function handleInstall() {
    window.chatBridge.invoke('updater:install')
  }

  return (
    <div className="space-y-7">

      {/* ── Appearance ── */}
      <section>
        <SectionHeader>Appearance</SectionHeader>
        <div className="space-y-4">
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Theme</p>
            <div className="flex gap-2">
              {(['dark', 'light', 'system'] as Theme[]).map(t => (
                <button
                  key={t}
                  onClick={() => save({ theme: t })}
                  className="flex-1 py-1.5 text-xs rounded-md border transition-colors capitalize"
                  style={{
                    background: settings.theme === t ? 'var(--accent)' : 'var(--surface-2)',
                    color: settings.theme === t ? 'white' : 'var(--text-secondary)',
                    borderColor: settings.theme === t ? 'var(--accent)' : 'var(--border)'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Slider
            label="Font Size"
            value={settings.fontSize}
            min={10}
            max={22}
            step={1}
            onChange={v => save({ fontSize: v })}
            formatValue={v => `${v}px`}
          />

          <OptionRow label="Message spacing">
            <SegmentedControl<MessageSpacing>
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'normal', label: 'Normal' },
                { value: 'comfortable', label: 'Cozy' }
              ]}
              value={settings.messageSpacing}
              onChange={v => save({ messageSpacing: v })}
            />
          </OptionRow>

          <Toggle
            checked={settings.alternatingRows}
            onCheckedChange={v => save({ alternatingRows: v })}
            label="Alternating row colors"
          />
        </div>
      </section>

      {/* ── Chat Display ── */}
      <section>
        <SectionHeader>Chat Display</SectionHeader>
        <div className="space-y-3">
          <OptionRow label="Timestamps">
            <Toggle
              checked={settings.showTimestamps}
              onCheckedChange={v => save({ showTimestamps: v })}
            />
          </OptionRow>

          {settings.showTimestamps && (
            <OptionRow label="Timestamp format">
              <SegmentedControl<TimestampFormat>
                options={[
                  { value: '24h', label: '24h' },
                  { value: '12h', label: '12h' }
                ]}
                value={settings.timestampFormat}
                onChange={v => save({ timestampFormat: v })}
              />
            </OptionRow>
          )}

          <OptionRow label="Badges">
            <Toggle
              checked={settings.showBadges}
              onCheckedChange={v => save({ showBadges: v })}
            />
          </OptionRow>

          <OptionRow label="Platform indicator">
            <Toggle
              checked={settings.showPlatformBadge}
              onCheckedChange={v => save({ showPlatformBadge: v })}
            />
          </OptionRow>

          <OptionRow label="Username display">
            <SegmentedControl<UsernameDisplay>
              options={[
                { value: 'display-name', label: 'Display' },
                { value: 'login', label: 'Login' },
                { value: 'both', label: 'Both' }
              ]}
              value={settings.usernameDisplay}
              onChange={v => save({ usernameDisplay: v })}
            />
          </OptionRow>

          <OptionRow label="Deleted messages">
            <SegmentedControl<DeletedMessageStyle>
              options={[
                { value: 'cross-out', label: 'Strike' },
                { value: 'hide', label: 'Hide' }
              ]}
              value={settings.showDeletedMessages}
              onChange={v => save({ showDeletedMessages: v })}
            />
          </OptionRow>
        </div>
      </section>

      {/* ── Behavior ── */}
      <section>
        <SectionHeader>Behavior</SectionHeader>
        <div className="space-y-3">
          <Toggle
            checked={settings.pauseScrollOnHover}
            onCheckedChange={v => save({ pauseScrollOnHover: v })}
            label="Pause scroll on hover"
          />
          <OptionRow label="Smooth scroll" description="Glide to new messages instead of jumping">
            <Toggle
              checked={settings.smoothScroll}
              onCheckedChange={v => save({ smoothScroll: v })}
            />
          </OptionRow>
          <Toggle
            checked={settings.showReplyContext}
            onCheckedChange={v => save({ showReplyContext: v })}
            label="Show reply context"
          />
          <Toggle
            checked={settings.showConnectionAlerts}
            onCheckedChange={v => save({ showConnectionAlerts: v })}
            label="Show connection status messages"
          />
          <Toggle
            checked={settings.flashOnMention}
            onCheckedChange={v => save({ flashOnMention: v })}
            label="Flash taskbar on mention"
          />
          <OptionRow label="Hide command messages" description="Messages starting with / or !">
            <Toggle
              checked={settings.hideCommands}
              onCheckedChange={v => save({ hideCommands: v })}
            />
          </OptionRow>
        </div>
      </section>

      {/* ── Chat History ── */}
      <section>
        <SectionHeader>Chat History</SectionHeader>
        <div className="space-y-3">
          <OptionRow label="Load recent messages" description="Fetch last 100 messages when joining a channel">
            <Toggle
              checked={settings.loadRecentMessages}
              onCheckedChange={v => save({ loadRecentMessages: v })}
            />
          </OptionRow>
          <OptionRow label="Clickable usernames" description="Click a Twitch username to open their profile">
            <Toggle
              checked={settings.clickableUsernames}
              onCheckedChange={v => save({ clickableUsernames: v })}
            />
          </OptionRow>
          <OptionRow label="Show viewer count" description="Display live viewer count in sidebar and All tab">
            <Toggle
              checked={settings.showViewerCount}
              onCheckedChange={v => save({ showViewerCount: v })}
            />
          </OptionRow>
        </div>
      </section>

      {/* ── Performance ── */}
      <section>
        <SectionHeader>Performance</SectionHeader>
        <Slider
          label="Max messages per channel"
          value={settings.maxMessagesPerChannel}
          min={500}
          max={10000}
          step={500}
          onChange={v => save({ maxMessagesPerChannel: v })}
          formatValue={v => v.toLocaleString()}
        />
      </section>

      {/* ── Updates ── */}
      <section>
        <SectionHeader>Updates</SectionHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={updateStatus.downloaded ? handleInstall : handleCheckForUpdates}
              disabled={updateStatus.checking}
              style={{
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                cursor: updateStatus.checking ? 'default' : 'pointer',
                background: updateStatus.downloaded ? 'var(--accent)' : 'var(--surface-3)',
                color: updateStatus.downloaded ? '#fff' : 'var(--text-primary)',
                opacity: updateStatus.checking ? 0.6 : 1,
                transition: 'background 0.1s, opacity 0.1s'
              }}
            >
              {updateStatus.checking
                ? 'Checking…'
                : updateStatus.downloaded
                  ? 'Restart & Install'
                  : 'Check for Updates'}
            </button>

            {/* Status text */}
            {updateStatus.error && (
              <span style={{ fontSize: '11px', color: 'var(--danger)' }}>
                Error: {updateStatus.error.slice(0, 60)}
              </span>
            )}
            {!updateStatus.error && updateStatus.downloaded && (
              <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                v{updateStatus.downloaded} ready to install
              </span>
            )}
            {!updateStatus.error && !updateStatus.downloaded && updateStatus.available && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                v{updateStatus.available} downloading…
              </span>
            )}
            {!updateStatus.error && !updateStatus.downloaded && !updateStatus.available && justChecked && (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                You're up to date
              </span>
            )}
          </div>
        </div>
      </section>

    </div>
  )
}
