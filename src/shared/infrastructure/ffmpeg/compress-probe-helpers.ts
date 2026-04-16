import type { VideoProbeResult } from '@shared/domain/video-job'

export function videoPixelFormatHasAlpha(pixelFormat: string | null): boolean {
  if (!pixelFormat) return false
  return pixelFormat.includes('a') && pixelFormat !== 'pal8'
}

export function heuristicSourceVideoBitrateKbps(probe: VideoProbeResult): number | null {
  if (probe.videoStreamBitRate != null && probe.videoStreamBitRate > 0) {
    return probe.videoStreamBitRate / 1000
  }
  if (probe.formatBitRate != null && probe.formatBitRate > 0) {
    return (probe.formatBitRate / 1000) * 0.85
  }
  return null
}
