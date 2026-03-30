import Tooltip from '../ui/Tooltip'
import type { Platform } from '@shared/types/message'

const PLATFORM_CONFIG: Record<Platform, { color: string; label: string }> = {
  twitch: { color: 'var(--twitch)', label: 'Twitch' },
  youtube: { color: 'var(--youtube)', label: 'YouTube' },
  kick: { color: 'var(--kick)', label: 'Kick' }
}

export default function PlatformBadge({ platform }: { platform: Platform }) {
  const { color, label } = PLATFORM_CONFIG[platform]
  return (
    <Tooltip content={label} side="right">
      <span
        className="inline-block w-2 h-2 rounded-full shrink-0 mt-1.5"
        style={{ background: color }}
        aria-label={label}
      />
    </Tooltip>
  )
}
