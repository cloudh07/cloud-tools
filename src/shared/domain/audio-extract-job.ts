export const AudioExtractFormat = {
  M4A: 'm4a',
  MP3: 'mp3',
  WAV: 'wav',
  FLAC: 'flac',
  OPUS: 'opus',
  OGG: 'ogg'
} as const

export type AudioExtractFormat = (typeof AudioExtractFormat)[keyof typeof AudioExtractFormat]

export type AudioTrack = {
  audioOrdinal: number
  streamIndex: number
  codec: string
  sampleRate: number
  channels: number
  bitrate?: number
  durationSec: number | null
  isDefault: boolean
  language?: string
}

export type AudioExtractProbeResult = {
  path: string
  formatDurationSec: number | null
  tracks: AudioTrack[]
}

export type StartAudioExtractJobItem = {
  jobId: string
  inputPath: string
  outputPath: string
  audioOrdinal: number
  format: AudioExtractFormat
  preferCopy: boolean
}

export type StartAudioExtractBatchRequest = {
  items: StartAudioExtractJobItem[]
}

export type AudioExtractJobPhase = 'extract'

export type AudioExtractJobStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AudioExtractJobEvent =
  | { type: 'item_started'; jobId: string; index: number; total: number }
  | { type: 'log'; jobId: string; line: string }
  | {
      type: 'progress'
      jobId: string
      phase: AudioExtractJobPhase
      ratio: number
      currentTimeSec?: number
      totalDurationSec?: number | null
    }
  | { type: 'phase'; jobId: string; phase: AudioExtractJobPhase }
  | { type: 'command'; jobId: string; phase: AudioExtractJobPhase; args: string[] }
  | {
      type: 'completed'
      jobId: string
      inputPath: string
      outputPath: string
      inputBytes: number
      outputBytes: number
      usedCopy: boolean
    }
  | { type: 'failed'; jobId: string; message: string; detail?: string }
  | { type: 'cancelled'; jobId: string }
