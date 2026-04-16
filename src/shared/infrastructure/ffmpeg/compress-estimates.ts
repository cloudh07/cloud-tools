import type { VideoProbeResult } from '@shared/domain/video-job'
import { heuristicSourceVideoBitrateKbps } from './compress-probe-helpers'
import type { CompressEncodingPlan } from './video-compress-plan'

const MUX_OVERHEAD = 1.06

export function estimateOutputBytes(
  plan: CompressEncodingPlan,
  durationSec: number | null
): number | null {
  if (plan.outputKind === 'animated_webp' || durationSec == null || !Number.isFinite(durationSec)) {
    return null
  }
  const kbps = plan.estimatedVideoBitrateKbps + plan.estimatedAudioBitrateKbps
  return Math.round(((kbps * 1000) / 8) * durationSec * MUX_OVERHEAD)
}

export function estimateBitrateDeltaPercent(
  probe: VideoProbeResult,
  plan: CompressEncodingPlan
): number | null {
  const src = heuristicSourceVideoBitrateKbps(probe)
  if (src == null || src <= 0 || plan.estimatedVideoBitrateKbps <= 0) return null
  return Math.round((1 - plan.estimatedVideoBitrateKbps / src) * 100)
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '-'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}
