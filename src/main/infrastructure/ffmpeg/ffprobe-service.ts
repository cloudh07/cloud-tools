import { runFfprobeCapture } from '@main/infrastructure/ffmpeg/ffprobe-runner'
import type { VideoProbeResult } from '@shared/domain/video-job'

type FfprobeJson = {
  format?: { duration?: string; bit_rate?: string }
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    width?: number
    height?: number
    r_frame_rate?: string
    avg_frame_rate?: string
    bit_rate?: string
    pix_fmt?: string
  }>
}

function parseBitRate(raw?: string): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseFps(rate?: string): number | null {
  if (!rate || rate === '0/0') return null
  const parts = rate.split('/')
  if (parts.length !== 2) return null
  const a = Number(parts[0])
  const b = Number(parts[1])
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null
  const v = a / b
  return Number.isFinite(v) ? v : null
}

const FFPROBE_SHOW_ENTRIES =
  'format=duration,bit_rate:stream=codec_type,codec_name,width,height,r_frame_rate,avg_frame_rate,bit_rate,pix_fmt'

function runFfprobe(ffprobePath: string, inputPath: string): Promise<string> {
  return runFfprobeCapture(
    ffprobePath,
    ['-hide_banner', '-v', 'error', '-print_format', 'json', '-show_entries', FFPROBE_SHOW_ENTRIES],
    inputPath
  )
}

export async function probeVideoFile(
  ffprobePath: string,
  inputPath: string
): Promise<VideoProbeResult> {
  const jsonText = await runFfprobe(ffprobePath, inputPath)
  const parsed = JSON.parse(jsonText) as FfprobeJson
  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video')
  const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio')

  const durationRaw = parsed.format?.duration
  const durationSec =
    durationRaw != null && Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : null

  const fps = parseFps(videoStream?.r_frame_rate) ?? parseFps(videoStream?.avg_frame_rate) ?? null

  const formatBitRate = parseBitRate(parsed.format?.bit_rate)
  const videoStreamBitRate = parseBitRate(videoStream?.bit_rate)

  return {
    path: inputPath,
    durationSec,
    width: videoStream?.width ?? null,
    height: videoStream?.height ?? null,
    fps,
    videoCodec: videoStream?.codec_name ?? null,
    audioCodec: audioStream?.codec_name ?? null,
    hasVideo: Boolean(videoStream),
    hasAudio: Boolean(audioStream),
    formatBitRate,
    videoStreamBitRate,
    pixelFormat: videoStream?.pix_fmt ?? null
  }
}

export function toFileUrlForMedia(absPath: string): string {
  const hex = Buffer.from(absPath, 'utf8').toString('hex')
  return `local-media://127.0.0.1/p/${hex}`
}
