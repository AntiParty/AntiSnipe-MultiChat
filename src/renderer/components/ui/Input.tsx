import { forwardRef, type InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full rounded-md border px-3 py-1.5 text-sm bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] focus:border-[var(--accent)] transition-colors',
            { 'border-[var(--danger)]': error },
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'
export default Input
