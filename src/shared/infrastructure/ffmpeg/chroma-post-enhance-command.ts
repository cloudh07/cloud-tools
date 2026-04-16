import type { ChromaEnhancePreset } from '@shared/domain/chroma-enhance'
import { VideoOutputMode, type VideoQualityPreset } from '@shared/domain/video-output-mode'
import {
  buildChromaEnhanceFilterComplexForAlpha,
  buildChromaEnhanceVfForGreenScreen
} from '@shared/infrastructure/ffmpeg/chroma-enhance-params'
import {
  proresProfileFromQuality,
  x264PresetFromQuality,
  type TranscodeBuildResult
} from '@shared/infrastructure/ffmpeg/ffmpeg-command-builder'

export type ChromaPostEnhanceBuildOpts = {
  inputPath: string
  outputPath: string
  mode: VideoOutputMode
  qualityPreset: VideoQualityPreset
  enhancePreset: ChromaEnhancePreset
}

export function buildChromaPostEnhanceCommand(
  opts: ChromaPostEnhanceBuildOpts
): TranscodeBuildResult {
  const { mode, qualityPreset } = opts

  if (mode === VideoOutputMode.GREEN_SCREEN) {
    const vf = buildChromaEnhanceVfForGreenScreen(opts.enhancePreset)
    const { crf, x264preset } = x264PresetFromQuality(qualityPreset)
    const args = [
      '-hide_banner',
      '-y',
      '-i',
      opts.inputPath,
      '-vf',
      vf,
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
      '-c:a',
      'copy',
      opts.outputPath
    ]
    return { args, filterDescription: vf }
  }

  const fc = buildChromaEnhanceFilterComplexForAlpha(opts.enhancePreset)
  const profile = proresProfileFromQuality(qualityPreset)
  const args = [
    '-hide_banner',
    '-y',
    '-i',
    opts.inputPath,
    '-filter_complex',
    fc,
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
    '-c:a',
    'copy',
    opts.outputPath
  ]

  return { args, filterDescription: fc }
}
