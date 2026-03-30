import * as Switch from '@radix-ui/react-switch'
import { clsx } from 'clsx'

interface ToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  className?: string
}

export default function Toggle({ checked, onCheckedChange, label, disabled, className }: ToggleProps) {
  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className={clsx(
          'relative h-5 w-9 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-1',
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--surface-4)]',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Switch.Thumb
          className={clsx(
            'block h-4 w-4 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          )}
        />
      </Switch.Root>
      {label && (
        <span className="text-sm text-[var(--text-primary)]">{label}</span>
      )}
    </div>
  )
}
