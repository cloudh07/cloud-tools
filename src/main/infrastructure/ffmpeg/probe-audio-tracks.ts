import { runFfprobeCapture } from '@main/infrastructure/ffmpeg/ffprobe-runner'

import type { AudioExtractProbeResult, AudioTrack } from '@shared/domain/audio-extract-job'

type FfprobeJson = {
  format?: { duration?: string }
  streams?: Array<{
    index?: number
    codec_type?: string
    codec_name?: string
    sample_rate?: string
    channels?: number
    bit_rate?: string
    duration?: string
    tags?: { language?: string; LANGUAGE?: string }
    disposition?: { default?: number }
  }>
}

function parseNumber(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function parseBitRate(raw?: string): number | undefined {
  const n = parseNumber(raw)
  return n != null && n > 0 ? n : undefined
}

function runFfprobe(ffprobePath: string, inputPath: string): Promise<string> {
  return runFfprobeCapture(
    ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format'],
    inputPath
  )
}

export async function probeAudioTracks(
  ffprobePath: string,
  inputPath: string
): Promise<AudioExtractProbeResult> {
  const jsonText = await runFfprobe(ffprobePath, inputPath)
  const parsed = JSON.parse(jsonText) as FfprobeJson
  const formatDurationSec = parseNumber(parsed.format?.duration)

  const audioStreams = (parsed.streams ?? []).filter((s) => s.codec_type === 'audio')
  audioStreams.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))

  const tracks: AudioTrack[] = audioStreams.map((s, audioOrdinal) => {
    const streamIndex = typeof s.index === 'number' ? s.index : audioOrdinal
    const codec = (s.codec_name ?? 'unknown').trim()
    const sampleRate = parseNumber(s.sample_rate ?? '') ?? 0
    const channels = typeof s.channels === 'number' && s.channels > 0 ? s.channels : 0
    const durationSec = parseNumber(s.duration) ?? formatDurationSec
    const isDefault = s.disposition?.default === 1
    const lang = s.tags?.language ?? s.tags?.LANGUAGE
    return {
      audioOrdinal,
      streamIndex,
      codec,
      sampleRate,
      channels,
      bitrate: parseBitRate(s.bit_rate),
      durationSec,
      isDefault,
      language: typeof lang === 'string' && lang.trim() ? lang.trim() : undefined
    }
  })

  return {
    path: inputPath,
    formatDurationSec,
    tracks
  }
}
