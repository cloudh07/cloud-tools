export function formatMediaDurationSeconds(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '-'
  const s = Math.floor(totalSec % 60)
  const mTotal = Math.floor(totalSec / 60)
  const m = mTotal % 60
  const h = Math.floor(mTotal / 60)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
