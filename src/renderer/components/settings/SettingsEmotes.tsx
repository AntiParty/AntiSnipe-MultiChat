import { useSettings } from '../../hooks/useSettings'
import Toggle from '../ui/Toggle'
import Slider from '../ui/Slider'

export default function SettingsEmotes() {
  const { settings, save } = useSettings()
  const { enabledProviders } = settings

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Emote Providers
        </h3>
        <div className="space-y-3">
          <Toggle
            checked={enabledProviders.sevenTv}
            onCheckedChange={v => save({ enabledProviders: { ...enabledProviders, sevenTv: v } })}
            label="7TV"
          />
          <Toggle
            checked={enabledProviders.bttv}
            onCheckedChange={v => save({ enabledProviders: { ...enabledProviders, bttv: v } })}
            label="BetterTTV (BTTV)"
          />
          <Toggle
            checked={enabledProviders.ffz}
            onCheckedChange={v => save({ enabledProviders: { ...enabledProviders, ffz: v } })}
            label="FrankerFaceZ (FFZ)"
          />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Emote Size
        </h3>
        <Slider
          label="Emote scale"
          value={settings.emoteScale}
          min={0.75}
          max={3}
          step={0.25}
          onChange={v => save({ emoteScale: v })}
          formatValue={v => `${v}×`}
        />
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          Emotes are scaled relative to the current font size.
        </p>
      </section>
    </div>
  )
}
