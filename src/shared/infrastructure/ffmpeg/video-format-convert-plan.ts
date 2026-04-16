import {
  type VideoFormatConvertProbeResult,
  type VideoFormatTarget,
  videoFormatTargetExtension
} from '@shared/domain/video-format-convert'
import { buildWebpCommand } from '@shared/infrastructure/ffmpeg/ffmpeg-command-builder'
import { filePathExtensionLower } from '@shared/infrastructure/paths/file-path-extension'

export type VideoFormatConversionPlan =
  | {
      ok: true
      args: string[]
      streamCopy: boolean
      summary: string
      warnings: string[]
    }
  | { ok: false; reason: string }

export function pixelFormatHasAlpha(pixelFormat: string | null): boolean {
  if (!pixelFormat) return false
  const p = pixelFormat.toLowerCase()
  return (
    p.startsWith('yuva') ||
    p.startsWith('rgba') ||
    p.startsWith('abgr') ||
    p.startsWith('argb') ||
    p.startsWith('bgra') ||
    p.startsWith('gbrap') ||
    p === 'ya8' ||
    p === 'ya16' ||
    p.includes('4444')
  )
}

export function targetKeepsAlphaWell(target: VideoFormatTarget): boolean {
  return (
    target === 'mov' ||
    target === 'webm' ||
    target === 'mkv' ||
    target === 'gif' ||
    target === 'webp_anim'
  )
}

export function alphaIncompatibleReason(
  probe: Pick<VideoFormatConvertProbeResult, 'inputHasAlpha'>,
  target: VideoFormatTarget
): string | null {
  if (!probe.inputHasAlpha) return null

  if (target === 'mp4') {
    return 'Video nguồn có alpha. MP4 (H.264) không hỗ trợ độ trong suốt. Hãy chọn MOV, WebM, MKV, GIF hoặc WebP động.'
  }

  if (target === 'avi') {
    return 'Video nguồn có alpha. AVI không phù hợp để giữ độ trong suốt. Hãy chọn MOV, WebM, MKV, GIF hoặc WebP động.'
  }

  return null
}

function warnGifAudio(): string {
  return 'GIF chỉ lưu các khung hình. Âm thanh sẽ bị bỏ qua.'
}

function warnWebpAnimAudio(): string {
  return 'WebP động không bao gồm âm thanh. Luồng audio sẽ bị bỏ qua.'
}

function mkvAudioCopyable(audioCodec: string | null): boolean {
  if (!audioCodec) return true
  const a = audioCodec.toLowerCase()
  return ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'ac3', 'eac3', 'pcm_s16le', 'pcm_s24le'].includes(
    a
  )
}

function tryStreamCopyMkv(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan | null {
  if (probe.inputHasAlpha) return null
  const v = probe.videoCodec?.toLowerCase()
  if (!v || !probe.hasVideo) return null
  const allowedV = new Set(['h264', 'hevc', 'vp9', 'av1', 'mpeg4', 'msmpeg4v3', 'theora'])
  if (!allowedV.has(v)) return null
  if (probe.hasAudio && probe.audioTrackCount > 0 && !mkvAudioCopyable(probe.audioCodec)) {
    return null
  }
  return {
    ok: true,
    streamCopy: true,
    summary: 'Remux MKV (copy toàn bộ luồng)',
    warnings: [],
    args: ['-hide_banner', '-y', '-i', inputPath, '-map', '0', '-c', 'copy', outputPath]
  }
}

function tryStreamCopyMp4(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan | null {
  if (probe.inputHasAlpha) return null
  if (probe.audioTrackCount > 1) return null
  const v = probe.videoCodec?.toLowerCase()
  if (v !== 'h264' && v !== 'hevc') return null
  if (probe.hasAudio && probe.audioTrackCount > 0) {
    const a = probe.audioCodec?.toLowerCase()
    if (a !== 'aac') return null
  }
  return {
    ok: true,
    streamCopy: true,
    summary: 'Copy luồng H.264/HEVC + AAC sang MP4',
    warnings: [],
    args: [
      '-hide_banner',
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-c',
      'copy',
      '-movflags',
      '+faststart',
      outputPath
    ]
  }
}

function tryStreamCopyMov(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan | null {
  return tryStreamCopyMp4(inputPath, outputPath, probe)
}

function tryStreamCopyWebm(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan | null {
  if (probe.inputHasAlpha) return null
  const fmt = probe.containerFormat?.toLowerCase() ?? ''
  if (!fmt.includes('webm') && !fmt.includes('matroska')) return null
  const v = probe.videoCodec?.toLowerCase()
  if (v !== 'vp8' && v !== 'vp9' && v !== 'av1') return null
  if (probe.hasAudio && probe.audioTrackCount > 0) {
    const a = probe.audioCodec?.toLowerCase()
    if (a !== 'opus' && a !== 'vorbis') return null
  }
  return {
    ok: true,
    streamCopy: true,
    summary: 'Copy luồng WebM (VP8/VP9/AV1 + Opus/Vorbis)',
    warnings: [],
    args: ['-hide_banner', '-y', '-i', inputPath, '-map', '0', '-c', 'copy', outputPath]
  }
}

function transcodeMp4(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p'
  ]
  if (probe.hasAudio && probe.audioTrackCount > 0) {
    args.push('-c:a', 'aac', '-b:a', '192k')
  } else {
    args.push('-an')
  }
  args.push('-movflags', '+faststart', outputPath)
  return {
    ok: true,
    streamCopy: false,
    summary: 'Transcode H.264 + AAC (MP4)',
    warnings: [],
    args
  }
}

function transcodeMov(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  if (probe.inputHasAlpha) {
    const args: string[] = [
      '-hide_banner',
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'prores_ks',
      '-profile:v',
      '4444',
      '-pix_fmt',
      'yuva444p10le'
    ]
    if (probe.hasAudio && probe.audioTrackCount > 0) {
      args.push('-c:a', 'aac', '-b:a', '192k')
    } else {
      args.push('-an')
    }
    args.push(outputPath)
    return {
      ok: true,
      streamCopy: false,
      summary: 'ProRes 4444 (giữ alpha) + AAC',
      warnings: [],
      args
    }
  }
  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p'
  ]
  if (probe.hasAudio && probe.audioTrackCount > 0) {
    args.push('-c:a', 'aac', '-b:a', '192k')
  } else {
    args.push('-an')
  }
  args.push(outputPath)
  return {
    ok: true,
    streamCopy: false,
    summary: 'Transcode H.264 + AAC (MOV)',
    warnings: [],
    args
  }
}

function transcodeWebm(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  const pix = probe.inputHasAlpha ? 'yuva420p' : 'yuv420p'
  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '31',
    '-b:v',
    '0',
    '-pix_fmt',
    pix
  ]
  if (probe.hasAudio && probe.audioTrackCount > 0) {
    args.push('-c:a', 'libopus', '-b:a', '128k')
  } else {
    args.push('-an')
  }
  args.push(outputPath)
  return {
    ok: true,
    streamCopy: false,
    summary: probe.inputHasAlpha ? 'VP9 + alpha + Opus (WebM)' : 'VP9 + Opus (WebM)',
    warnings: [],
    args
  }
}

function transcodeMkv(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  const pix = probe.inputHasAlpha ? 'yuva420p' : 'yuv420p'
  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-preset',
    'medium',
    '-pix_fmt',
    pix
  ]
  if (probe.hasAudio && probe.audioTrackCount > 0) {
    args.push('-c:a', 'aac', '-b:a', '192k')
  } else {
    args.push('-an')
  }
  args.push(outputPath)
  return {
    ok: true,
    streamCopy: false,
    summary: probe.inputHasAlpha ? 'H.264 + alpha + AAC (MKV)' : 'H.264 + AAC (MKV)',
    warnings: [],
    args
  }
}

function transcodeAvi(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  if (probe.inputHasAlpha) {
    return {
      ok: false,
      reason: 'Không hỗ trợ giữ độ trong suốt khi xuất AVI. Hãy chọn MOV, WebM hoặc MKV.'
    }
  }

  const args: string[] = [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-c:v',
    'libx264',
    '-crf',
    '23',
    '-preset',
    'medium',
    '-pix_fmt',
    'yuv420p'
  ]

  if (probe.hasAudio && probe.audioTrackCount > 0) {
    args.push('-c:a', 'libmp3lame', '-b:a', '192k')
  } else {
    args.push('-an')
  }

  args.push(outputPath)

  return {
    ok: true,
    streamCopy: false,
    summary: 'H.264 + MP3 (AVI)',
    warnings: [],
    args
  }
}

function transcodeGif(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  const warnings: string[] = []
  if (probe.hasAudio && probe.audioTrackCount > 0) warnings.push(warnGifAudio())
  const vf =
    "fps=12,scale='min(720,iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=full[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3"
  return {
    ok: true,
    streamCopy: false,
    summary: 'GIF (palette, 12 fps, scale tối đa 720px)',
    warnings,
    args: ['-hide_banner', '-y', '-i', inputPath, '-an', '-vf', vf, outputPath]
  }
}

function transcodeWebpAnim(
  inputPath: string,
  outputPath: string,
  probe: VideoFormatConvertProbeResult
): VideoFormatConversionPlan {
  const warnings: string[] = []
  if (probe.hasAudio && probe.audioTrackCount > 0) warnings.push(warnWebpAnimAudio())
  const built = buildWebpCommand({
    inputPath,
    outputPath,
    quality: 82,
    maxWidth: 1280
  })
  return {
    ok: true,
    streamCopy: false,
    summary: `WebP động (${built.filterDescription})`,
    warnings,
    args: built.args
  }
}

export function resolveVideoFormatConversion(opts: {
  probe: VideoFormatConvertProbeResult
  target: VideoFormatTarget
  inputPath: string
  outputPath: string
}): VideoFormatConversionPlan {
  const { probe, target, inputPath, outputPath } = opts

  const alphaBlock = alphaIncompatibleReason(probe, target)
  if (alphaBlock) {
    return { ok: false, reason: alphaBlock }
  }

  if (!probe.hasVideo) {
    return { ok: false, reason: 'Tệp không có luồng video hợp lệ.' }
  }

  const outExt = filePathExtensionLower(outputPath)
  const expectedExt = videoFormatTargetExtension(target)
  if (outExt !== expectedExt) {
    return {
      ok: false,
      reason: `Phần mở rộng đầu ra phải là ${expectedExt} cho định dạng đã chọn.`
    }
  }

  switch (target) {
    case 'mp4': {
      const copy = tryStreamCopyMp4(inputPath, outputPath, probe)
      if (copy) return copy
      return transcodeMp4(inputPath, outputPath, probe)
    }
    case 'mov': {
      const copy = tryStreamCopyMov(inputPath, outputPath, probe)
      if (copy && copy.ok) {
        return { ...copy, summary: 'Copy luồng sang MOV' }
      }
      return transcodeMov(inputPath, outputPath, probe)
    }
    case 'webm': {
      const copy = tryStreamCopyWebm(inputPath, outputPath, probe)
      if (copy) return copy
      return transcodeWebm(inputPath, outputPath, probe)
    }
    case 'mkv': {
      const copy = tryStreamCopyMkv(inputPath, outputPath, probe)
      if (copy) return copy
      return transcodeMkv(inputPath, outputPath, probe)
    }
    case 'avi':
      return transcodeAvi(inputPath, outputPath, probe)
    case 'gif':
      return transcodeGif(inputPath, outputPath, probe)
    case 'webp_anim':
      return transcodeWebpAnim(inputPath, outputPath, probe)
    default:
      return { ok: false, reason: 'Định dạng đích không được hỗ trợ.' }
  }
}

export function previewFfmpegCommandLine(ffmpegExecutable: string, args: string[]): string {
  const quote = (s: string): string => (/\s/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
  return [ffmpegExecutable, ...args.map(quote)].join(' ')
}
