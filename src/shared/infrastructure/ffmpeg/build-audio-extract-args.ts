import type { AudioExtractFormat } from '@shared/domain/audio-extract-job'

export type AudioExtractEncodePlan = {
  useCopy: boolean
  argsAfterMap: string[]
}

function normCodec(codec: string): string {
  return codec.trim().toLowerCase()
}

export function canStreamCopyToFormat(codec: string, format: AudioExtractFormat): boolean {
  const c = normCodec(codec)
  switch (format) {
    case 'm4a':
      return c === 'aac'
    case 'mp3':
      return c === 'mp3'
    case 'wav':
      return c.startsWith('pcm_') || c === 'pcm_s16be' || c === 'pcm_s24be'
    case 'flac':
      return c === 'flac'
    case 'opus':
      return c === 'opus'
    case 'ogg':
      return c === 'vorbis' || c === 'opus'
    default:
      return false
  }
}

export function planAudioExtractEncoding(input: {
  sourceCodec: string
  format: AudioExtractFormat
  preferCopy: boolean
}): AudioExtractEncodePlan {
  const { sourceCodec, format, preferCopy } = input
  const copyOk = preferCopy && canStreamCopyToFormat(sourceCodec, format)
  if (copyOk) {
    return { useCopy: true, argsAfterMap: ['-c', 'copy'] }
  }
  switch (format) {
    case 'm4a':
      return { useCopy: false, argsAfterMap: ['-c:a', 'aac', '-b:a', '192k'] }
    case 'mp3':
      return { useCopy: false, argsAfterMap: ['-c:a', 'libmp3lame', '-b:a', '192k'] }
    case 'wav':
      return { useCopy: false, argsAfterMap: ['-c:a', 'pcm_s16le'] }
    case 'flac':
      return { useCopy: false, argsAfterMap: ['-c:a', 'flac'] }
    case 'opus':
      return { useCopy: false, argsAfterMap: ['-c:a', 'libopus', '-b:a', '128k'] }
    case 'ogg':
      return { useCopy: false, argsAfterMap: ['-c:a', 'libvorbis', '-b:a', '192k'] }
    default:
      return { useCopy: false, argsAfterMap: ['-c:a', 'aac', '-b:a', '192k'] }
  }
}

export function buildAudioExtractFfmpegArgs(input: {
  inputPath: string
  outputPath: string
  audioOrdinal: number
  sourceCodec: string
  format: AudioExtractFormat
  preferCopy: boolean
}): { args: string[]; usedCopy: boolean } {
  const plan = planAudioExtractEncoding({
    sourceCodec: input.sourceCodec,
    format: input.format,
    preferCopy: input.preferCopy
  })
  const args: string[] = [
    '-hide_banner',
    '-nostdin',
    '-i',
    input.inputPath,
    '-map',
    `0:a:${input.audioOrdinal}`,
    ...plan.argsAfterMap,
    '-y',
    input.outputPath
  ]
  return { args, usedCopy: plan.useCopy }
}
