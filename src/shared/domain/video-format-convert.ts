export const VIDEO_FORMAT_TARGETS = [
  'mp4',
  'mov',
  'webm',
  'mkv',
  'avi',
  'gif',
  'webp_anim'
] as const

export type VideoFormatTarget = (typeof VIDEO_FORMAT_TARGETS)[number]

export function videoFormatTargetExtension(target: VideoFormatTarget): string {
  if (target === 'webp_anim') return '.webp'
  return `.${target}`
}

export type VideoFormatConvertProbeResult = {
  path: string
  durationSec: number | null
  width: number | null
  height: number | null
  fps: number | null
  videoCodec: string | null
  audioCodec: string | null
  audioTrackCount: number
  hasVideo: boolean
  hasAudio: boolean
  formatBitRate: number | null
  videoStreamBitRate: number | null
  pixelFormat: string | null
  containerFormat: string | null
  inputHasAlpha: boolean
}

export type VideoFormatConvertJobStatus =
  | 'idle'
  | 'probing'
  | 'ready'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type VideoFormatConvertJobEvent =
  | { type: 'log'; jobId: string; line: string }
  | {
      type: 'progress'
      jobId: string
      ratio: number
      percent: number
      currentTimeSec?: number
      totalDurationSec?: number | null
    }
  | { type: 'command'; jobId: string; args: string[] }
  | { type: 'completed'; jobId: string; outputPath: string }
  | { type: 'failed'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }

export type StartVideoFormatConvertJobRequest = {
  jobId: string
  inputPath: string
  outputPath: string
  target: VideoFormatTarget
}
