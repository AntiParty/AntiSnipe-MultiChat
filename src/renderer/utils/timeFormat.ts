export function formatTimestamp(timestamp: number, showSeconds = false): string {
  const date = new Date(timestamp)
  const h = date.getHours()
  const m = String(date.getMinutes()).padStart(2, '0')
  if (showSeconds) {
    const s = String(date.getSeconds()).padStart(2, '0')
    return `${h}:${m}:${s}`
  }
  return `${h}:${m}`
}
