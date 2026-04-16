export const CompressQualityPreset = {
  MAX_QUALITY: 'max_quality',
  BALANCED: 'balanced',
  SMALL_SIZE: 'small_size',
  ULTRA_COMPRESSED: 'ultra_compressed'
} as const

export type CompressQualityPreset =
  (typeof CompressQualityPreset)[keyof typeof CompressQualityPreset]

export const CompressUseCaseProfile = {
  GENERIC: 'generic',
  WEB_UPLOAD: 'web_upload',
  DISCORD: 'discord',
  SOCIAL: 'social',
  TRANSPARENT_MOV: 'transparent_mov',
  TRANSPARENT_WEBM: 'transparent_webm',
  ANIMATED_WEBP: 'animated_webp',
  GREEN_SCREEN: 'green_screen',
  ARCHIVE: 'archive',
  STORAGE: 'storage'
} as const

export type CompressUseCaseProfile =
  (typeof CompressUseCaseProfile)[keyof typeof CompressUseCaseProfile]

export const CompressVideoCodec = {
  H264: 'h264',
  H265: 'hevc',
  VP9: 'vp9',
  AV1: 'av1'
} as const

export type CompressVideoCodec = (typeof CompressVideoCodec)[keyof typeof CompressVideoCodec]

export type CompressRateMode = 'crf' | 'bitrate'

export type CompressEncodingOverrides = {
  rateMode: CompressRateMode | null
  targetVideoBitrateKbps: number | null
  crf: number | null
  scale: number | null
  fps: number | null
  codec: CompressVideoCodec | null
  audioBitrateKbps: number | null
}

export const defaultCompressOverrides = (): CompressEncodingOverrides => ({
  rateMode: null,
  targetVideoBitrateKbps: null,
  crf: null,
  scale: null,
  fps: null,
  codec: null,
  audioBitrateKbps: null
})

export type CompressJobPhase = 'encode'

export type CompressJobStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type StartCompressJobItem = {
  jobId: string
  inputPath: string
  outputPath: string
  quality: CompressQualityPreset
  profile: CompressUseCaseProfile
  overrides: CompressEncodingOverrides
}

export type StartCompressBatchRequest = {
  items: StartCompressJobItem[]
}

export type CompressHwAccel = 'none'

export type CompressJobEvent =
  | { type: 'item_started'; jobId: string; index: number; total: number }
  | { type: 'log'; jobId: string; line: string }
  | {
      type: 'progress'
      jobId: string
      phase: CompressJobPhase
      ratio: number
      currentTimeSec?: number
      totalDurationSec?: number | null
    }
  | { type: 'phase'; jobId: string; phase: CompressJobPhase }
  | { type: 'command'; jobId: string; phase: CompressJobPhase; args: string[] }
  | {
      type: 'completed'
      jobId: string
      inputPath: string
      outputPath: string
      inputBytes: number
      outputBytes: number
    }
  | { type: 'failed'; jobId: string; message: string; detail?: string }
  | { type: 'cancelled'; jobId: string }
