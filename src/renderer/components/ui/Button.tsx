import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
          {
            'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] focus:ring-[var(--accent)]':
              variant === 'primary',
            'bg-[var(--surface-3)] text-[var(--text-primary)] hover:bg-[var(--surface-4)] border border-[var(--border)] focus:ring-[var(--accent)]':
              variant === 'secondary',
            'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] focus:ring-[var(--accent)]':
              variant === 'ghost',
            'bg-[var(--danger)] text-white hover:opacity-90 focus:ring-[var(--danger)]':
              variant === 'danger',
            'text-xs px-2 py-1': size === 'sm',
            'text-sm px-3 py-1.5': size === 'md',
            'text-base px-4 py-2': size === 'lg'
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
export default Button
