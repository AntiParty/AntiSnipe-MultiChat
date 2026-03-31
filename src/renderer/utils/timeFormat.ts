export function formatTimestamp(
  timestamp: number,
  format: '12h' | '24h' = '24h',
  showSeconds = false
): string {
  const date = new Date(timestamp)
  const h24 = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')

  if (format === '12h') {
    const suffix = h24 >= 12 ? 'pm' : 'am'
    const h12 = h24 % 12 || 12
    if (showSeconds) {
      const s = String(date.getSeconds()).padStart(2, '0')
      return `${h12}:${m}:${s}${suffix}`
    }
    return `${h12}:${m}${suffix}`
  }

  if (showSeconds) {
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${h24}:${m}:${s}`
  }
  return `${h24}:${m}`
}
