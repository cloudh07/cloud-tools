const TIME_RE = /time=(\d+):(\d+):(\d+\.\d+)/

export function parseFfmpegTimeSeconds(line: string): number | null {
  const m = line.match(TIME_RE)
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  const ss = Number(m[3])
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return null
  return hh * 3600 + mm * 60 + ss
}

export function computeProgressRatio(
  currentSec: number,
  totalSec: number | null | undefined
): number {
  if (!totalSec || totalSec <= 0) {
    return Math.min(0.99, currentSec / Math.max(currentSec, 1))
  }
  return Math.max(0, Math.min(1, currentSec / totalSec))
}
