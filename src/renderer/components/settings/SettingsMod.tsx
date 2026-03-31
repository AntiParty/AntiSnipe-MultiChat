import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useSettings } from '../../hooks/useSettings'
import Toggle from '../ui/Toggle'

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

function formatDuration(secs: number): string {
  if (secs < 60) return `${secs} second${secs !== 1 ? 's' : ''}`
  if (secs < 3600) return `${secs / 60} minute${secs / 60 !== 1 ? 's' : ''}`
  if (secs < 86400) return `${secs / 3600} hour${secs / 3600 !== 1 ? 's' : ''}`
  return `${secs / 86400} day${secs / 86400 !== 1 ? 's' : ''}`
}

function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)?$/)
  if (!match) return null
  const val = parseFloat(match[1])
  const unit = match[2] ?? 's'
  if (unit.startsWith('s')) return Math.round(val)
  if (unit.startsWith('m')) return Math.round(val * 60)
  if (unit.startsWith('h')) return Math.round(val * 3600)
  if (unit.startsWith('d')) return Math.round(val * 86400)
  return Math.round(val)
}

export default function SettingsMod() {
  const { settings, save } = useSettings()
  const { modButtons } = settings
  const [presetInput, setPresetInput] = useState('')
  const [presetError, setPresetError] = useState('')

  const addPreset = () => {
    const secs = parseDuration(presetInput)
    if (!secs || secs <= 0 || secs > 1_209_600) {
      setPresetError('Enter a valid duration (e.g. 1m, 10m, 1h, 7d — max 14 days)')
      return
    }
    if (modButtons.timeoutPresets.includes(secs)) {
      setPresetError('That duration is already in your list')
      return
    }
    const sorted = [...modButtons.timeoutPresets, secs].sort((a, b) => a - b)
    save({ modButtons: { ...modButtons, timeoutPresets: sorted } })
    setPresetInput('')
    setPresetError('')
  }

  const removePreset = (secs: number) => {
    save({ modButtons: { ...modButtons, timeoutPresets: modButtons.timeoutPresets.filter(p => p !== secs) } })
  }

  return (
    <div className="space-y-7">

      <section>
        <SectionHeader>Mod Buttons</SectionHeader>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          These buttons appear on hover when you are a moderator or broadcaster in a Twitch channel.
          Re-authenticate if you recently became a mod and the buttons aren't showing.
        </p>
        <div className="space-y-3">
          <OptionRow label="Delete message" description="Remove a single message">
            <Toggle
              checked={modButtons.showDelete}
              onCheckedChange={v => save({ modButtons: { ...modButtons, showDelete: v } })}
            />
          </OptionRow>
          <OptionRow label="Timeout user" description="Temporarily ban with a duration picker">
            <Toggle
              checked={modButtons.showTimeout}
              onCheckedChange={v => save({ modButtons: { ...modButtons, showTimeout: v } })}
            />
          </OptionRow>
          <OptionRow label="Ban user" description="Permanently ban from the channel">
            <Toggle
              checked={modButtons.showBan}
              onCheckedChange={v => save({ modButtons: { ...modButtons, showBan: v } })}
            />
          </OptionRow>
        </div>
      </section>

      <section>
        <SectionHeader>Timeout Presets</SectionHeader>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Durations shown in the timeout dropdown. Accepts seconds, minutes (m), hours (h), or days (d). Max 14 days.
        </p>

        {/* Existing presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
          {modButtons.timeoutPresets.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No presets — add one below.</p>
          )}
          {modButtons.timeoutPresets.map(secs => (
            <span
              key={secs}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '4px',
                fontSize: '11px',
                color: 'var(--text-secondary)'
              }}
            >
              {formatDuration(secs)}
              <button
                onClick={() => removePreset(secs)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'none',
                  border: 'none',
                  padding: '0',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  lineHeight: 1
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)' }}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>

        {/* Add preset */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input
            value={presetInput}
            onChange={e => { setPresetInput(e.target.value); setPresetError('') }}
            onKeyDown={e => { if (e.key === 'Enter') addPreset() }}
            placeholder="e.g. 10m, 1h, 7d"
            style={{
              flex: 1,
              fontSize: '12px',
              padding: '5px 8px',
              background: 'var(--surface-0)',
              border: `1px solid ${presetError ? 'var(--danger)' : 'var(--border)'}`,
              borderRadius: '3px',
              color: 'var(--text-primary)',
              outline: 'none'
            }}
          />
          <button
            onClick={addPreset}
            disabled={!presetInput.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '5px 10px',
              fontSize: '11px',
              fontWeight: 600,
              background: presetInput.trim() ? 'var(--accent)' : 'var(--surface-3)',
              border: 'none',
              borderRadius: '3px',
              color: presetInput.trim() ? '#fff' : 'var(--text-muted)',
              cursor: presetInput.trim() ? 'pointer' : 'default',
              flexShrink: 0
            }}
          >
            <Plus size={11} />
            Add
          </button>
        </div>
        {presetError && (
          <p style={{ fontSize: '10px', color: 'var(--danger)', marginTop: '4px' }}>{presetError}</p>
        )}
      </section>

      <section>
        <SectionHeader>Note on Permissions</SectionHeader>
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Mod actions use the Twitch Helix API and require the{' '}
          <code style={{ fontSize: '10px', background: 'var(--surface-3)', padding: '1px 4px', borderRadius: '2px' }}>
            moderator:manage:banned_users
          </code>{' '}
          and{' '}
          <code style={{ fontSize: '10px', background: 'var(--surface-3)', padding: '1px 4px', borderRadius: '2px' }}>
            moderator:manage:chat_messages
          </code>{' '}
          scopes. If you authenticated before these were added, disconnect and reconnect your Twitch account to grant the new permissions.
        </p>
      </section>

    </div>
  )
}
