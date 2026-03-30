interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  label?: string
  formatValue?: (v: number) => string
}

export default function Slider({ value, min, max, step = 1, onChange, label, formatValue }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
          <span className="text-xs text-[var(--text-muted)]">
            {formatValue ? formatValue(value) : value}
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent) ${pct}%, var(--surface-4) ${pct}%)`
        }}
      />
    </div>
  )
}
