import type { ChromaEnhancePreset } from './chroma-enhance'
import type { ChromaKeyingKind } from './chroma-keying-kind'
import type { VideoOutputMode, VideoQualityPreset } from './video-output-mode'

export type VideoJobPhase = 'transcode' | 'enhance' | 'webp'

export type VideoJobStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type VideoProbeResult = {
  path: string
  durationSec: number | null
  width: number | null
  height: number | null
  fps: number | null
  videoCodec: string | null
  audioCodec: string | null
  hasVideo: boolean
  hasAudio: boolean
  formatBitRate: number | null
  videoStreamBitRate: number | null
  pixelFormat: string | null
}

export type StartVideoJobRequest = {
  jobId: string
  inputPath: string
  outputPath: string
  mode: VideoOutputMode
  preset: VideoQualityPreset
  keyingKind: ChromaKeyingKind
  keyColor: string
  similarity: number
  blend: number
  autoEnhanceOutput: boolean
  chromaEnhancePreset: ChromaEnhancePreset
  exportWebp: boolean
  webpOutputPath?: string
}

export type VideoJobEvent =
  | { type: 'log'; jobId: string; line: string }
  | {
      type: 'progress'
      jobId: string
      phase: VideoJobPhase
      ratio: number
      currentTimeSec?: number
      totalDurationSec?: number | null
    }
  | { type: 'phase'; jobId: string; phase: VideoJobPhase }
  | { type: 'command'; jobId: string; phase: VideoJobPhase; args: string[] }
  | {
      type: 'completed'
      jobId: string
      mode: VideoOutputMode
      outputs: { video: string; webp?: string }
    }
  | { type: 'failed'; jobId: string; message: string; detail?: string }
  | { type: 'cancelled'; jobId: string }
  | { type: 'enhance_failed'; jobId: string; message: string }
