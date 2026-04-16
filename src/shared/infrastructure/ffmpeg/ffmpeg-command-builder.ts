import type { ChromaKeyingKind } from '@shared/domain/chroma-keying-kind'
import { VideoOutputMode, type VideoQualityPreset } from '@shared/domain/video-output-mode'
import {
  buildAlphaMovFilterComplex,
  buildGreenscreenPlateFilterComplex
} from '@shared/infrastructure/ffmpeg/chroma-key-filter-graph'

export type TranscodeBuildResult = {
  args: string[]
  filterDescription: string
}

const CHROMA_PLATE = '0x00FF00'

export function x264PresetFromQuality(preset: VideoQualityPreset): {
  crf: string
  x264preset: string
} {
  switch (preset) {
    case 'fast':
      return { crf: '26', x264preset: 'veryfast' }
    case 'balanced':
      return { crf: '21', x264preset: 'medium' }
    case 'quality':
      return { crf: '18', x264preset: 'slow' }
    default:
      return { crf: '21', x264preset: 'medium' }
  }
}

export function proresProfileFromQuality(preset: VideoQualityPreset): string {
  switch (preset) {
    case 'fast':
      return '4444'
    case 'balanced':
      return '4444'
    case 'quality':
      return '4444'
    default:
      return '4444'
  }
}

export function buildTranscodeCommand(opts: {
  inputPath: string
  outputPath: string
  mode: VideoOutputMode
  preset: VideoQualityPreset
  keyingKind: ChromaKeyingKind
  keyColor: string
  similarity: number
  blend: number
  width: number
  height: number
  fps: number
  durationSec: number | null
}): TranscodeBuildResult {
  const { keyColor, similarity, blend, width: w, height: h, fps, durationSec, mode, preset } = opts
  const keyParams = {
    keyingKind: opts.keyingKind,
    keyColor,
    similarity,
    blend
  }

  const colorSrc =
    durationSec != null && Number.isFinite(durationSec) && durationSec > 0
      ? `color=c=${CHROMA_PLATE}:s=${w}x${h}:r=${fps}:d=${durationSec}`
      : `color=c=${CHROMA_PLATE}:s=${w}x${h}:r=${fps}`

  if (mode === VideoOutputMode.GREEN_SCREEN) {
    const filter = buildGreenscreenPlateFilterComplex(keyParams)
    const { crf, x264preset } = x264PresetFromQuality(preset)
    const args = [
      '-hide_banner',
      '-y',
      '-i',
      opts.inputPath,
      '-f',
      'lavfi',
      '-i',
      colorSrc,
      '-filter_complex',
      filter,
      '-map',
      '[outv]',
      '-map',
      '0:a?',
      '-c:v',
      'libx264',
      '-preset',
      x264preset,
      '-crf',
      crf,
      '-pix_fmt',
      'yuv420p',
      '-colorspace',
      'bt709',
      '-color_primaries',
      'bt709',
      '-color_trc',
      'bt709',
      '-movflags',
      '+faststart',
      '-fps_mode',
      'cfr',
      '-r',
      String(fps),
      '-c:a',
      'aac',
      '-b:a',
      '192k',
      '-shortest',
      opts.outputPath
    ]

    return { args, filterDescription: filter }
  }

  const filter = buildAlphaMovFilterComplex(keyParams)
  const profile = proresProfileFromQuality(preset)
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    opts.inputPath,
    '-filter_complex',
    filter,
    '-map',
    '[outv]',
    '-map',
    '0:a?',
    '-c:v',
    'prores_ks',
    '-profile:v',
    profile,
    '-pix_fmt',
    'yuva444p10le',
    '-fps_mode',
    'cfr',
    '-r',
    String(fps),
    '-c:a',
    'pcm_s16le',
    opts.outputPath
  ]

  return { args, filterDescription: filter }
}

export function buildWebpCommand(opts: {
  inputPath: string
  outputPath: string
  quality: number
  maxWidth: number
}): TranscodeBuildResult {
  const q = Math.max(0, Math.min(100, Math.round(opts.quality)))
  const vf = `scale='min(${opts.maxWidth}\\,iw)':-1:flags=lanczos,format=yuva420p`
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    opts.inputPath,
    '-an',
    '-vf',
    vf,
    '-c:v',
    'libwebp',
    '-pix_fmt',
    'yuva420p',
    '-quality',
    String(q),
    '-compression_level',
    '4',
    '-preset',
    'picture',
    '-loop',
    '0',
    opts.outputPath
  ]

  return {
    args,
    filterDescription: vf
  }
}
