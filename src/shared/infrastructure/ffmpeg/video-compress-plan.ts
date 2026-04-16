import type { VideoProbeResult } from '@shared/domain/video-job'
import {
  type CompressEncodingOverrides,
  CompressQualityPreset,
  type CompressRateMode,
  CompressUseCaseProfile,
  type CompressVideoCodec,
  CompressVideoCodec as Codec
} from '@shared/domain/compress-job'
import { heuristicSourceVideoBitrateKbps, videoPixelFormatHasAlpha } from './compress-probe-helpers'

export type CompressOutputKind = 'video_transcode' | 'animated_webp'

export type CompressEncodingPlan = {
  outputKind: CompressOutputKind
  ffmpegVideoCodec: string
  pixelFmt: string
  vf: string
  videoExtraArgs: string[]
  audioCodec: string
  audioExtraArgs: string[]
  estimatedVideoBitrateKbps: number
  estimatedAudioBitrateKbps: number
  qualityImpactLabel: string
  warnings: string[]
  webpQuality?: number
  webpMaxWidth?: number
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function baseCrfForCodec(quality: CompressQualityPreset, codec: CompressVideoCodec): number {
  const h264 = (): number => {
    switch (quality) {
      case CompressQualityPreset.MAX_QUALITY:
        return 18
      case CompressQualityPreset.BALANCED:
        return 23
      case CompressQualityPreset.SMALL_SIZE:
        return 28
      case CompressQualityPreset.ULTRA_COMPRESSED:
        return 32
      default:
        return 23
    }
  }
  switch (codec) {
    case Codec.H264:
      return h264()
    case Codec.H265:
      return h264() + 3
    case Codec.VP9:
      return h264() + 5
    case Codec.AV1:
      return h264() + 14
    default:
      return h264()
  }
}

function defaultCodecForProfile(profile: CompressUseCaseProfile): CompressVideoCodec {
  switch (profile) {
    case CompressUseCaseProfile.ARCHIVE:
    case CompressUseCaseProfile.STORAGE:
      return Codec.H265
    case CompressUseCaseProfile.TRANSPARENT_WEBM:
      return Codec.VP9
    case CompressUseCaseProfile.TRANSPARENT_MOV:
      return Codec.H265
    default:
      return Codec.H264
  }
}

function profileMaxWidth(profile: CompressUseCaseProfile): number | null {
  switch (profile) {
    case CompressUseCaseProfile.WEB_UPLOAD:
      return 1920
    case CompressUseCaseProfile.DISCORD:
      return 1280
    case CompressUseCaseProfile.SOCIAL:
      return 1080
    default:
      return null
  }
}

function effectiveScaleFromWidth(
  probe: VideoProbeResult,
  userScale: number,
  profile: CompressUseCaseProfile
): number {
  const capW = profileMaxWidth(profile)
  const w = probe.width
  if (!capW || !w || w <= 0) return clamp(userScale, 0.25, 1)
  const fit = capW / w
  if (fit >= 1) return clamp(userScale, 0.25, 1)
  return clamp(Math.min(userScale, fit), 0.25, 1)
}

function qualityImpactFromCrf(crf: number, codec: CompressVideoCodec): string {
  if (codec === Codec.VP9 || codec === Codec.AV1) {
    if (crf <= 28) return 'Rất nhẹ - hầu như không thấy nén.'
    if (crf <= 36) return 'Nhẹ - chi tiết nhỏ có thể mềm hơn một chút.'
    return 'Rõ - dễ thấy mềm / block nếu xem phóng to.'
  }
  if (crf <= 20) return 'Rất nhẹ - gần như giữ nguyên hình.'
  if (crf <= 24) return 'Nhẹ - thường chấp nhận được cho web.'
  if (crf <= 30) return 'Trung bình - giảm dung lượng rõ, cần xem thử.'
  return 'Mạnh, chất lượng giảm rõ. Chỉ dùng khi ưu tiên dung lượng.'
}

function estimateBitrateFromCrf(
  crf: number,
  codec: CompressVideoCodec,
  probe: VideoProbeResult,
  scale: number,
  prores: boolean
): number {
  if (prores) return 120000
  const w = (probe.width ?? 1920) * scale
  const h = (probe.height ?? 1080) * scale
  const pixels = (w * h) / 1_000_000
  const base =
    pixels *
    (codec === Codec.AV1 ? 1.5 : codec === Codec.VP9 ? 2.2 : codec === Codec.H265 ? 2.8 : 3.5)
  const crfFactor = Math.max(0.35, 1 - (crf - 18) * 0.04)
  return clamp(Math.round(base * 1000 * crfFactor), 200, 80000)
}

function pushDiscordBudgetWarning(
  out: string[],
  probe: VideoProbeResult,
  videoKbps: number,
  audioKbps: number
): void {
  const d = probe.durationSec
  if (d == null || d <= 0 || !Number.isFinite(d)) return
  const estBytes = ((videoKbps + audioKbps) * 1000 * d) / 8
  if (estBytes > 8 * 1024 * 1024) {
    out.push(
      'Ước lượng vượt ~8MB (giới hạn upload Discord thường gặp). Hãy giảm bitrate, độ phân giải hoặc độ dài clip.'
    )
  }
}

export function resolveCompressEncodingPlan(input: {
  probe: VideoProbeResult
  quality: CompressQualityPreset
  profile: CompressUseCaseProfile
  overrides: CompressEncodingOverrides
}): CompressEncodingPlan {
  const outWarnings: string[] = []
  const { probe, quality, profile, overrides } = input

  if (profile === CompressUseCaseProfile.ANIMATED_WEBP) {
    const q =
      quality === CompressQualityPreset.MAX_QUALITY
        ? 90
        : quality === CompressQualityPreset.BALANCED
          ? 82
          : quality === CompressQualityPreset.SMALL_SIZE
            ? 72
            : 62
    const maxW =
      profileMaxWidth(profile) ?? (quality === CompressQualityPreset.ULTRA_COMPRESSED ? 720 : 1280)
    outWarnings.push('WebP animation: âm thanh bị loại bỏ. Phù hợp loop ngắn / sticker trên web.')
    return {
      outputKind: 'animated_webp',
      ffmpegVideoCodec: 'libwebp',
      pixelFmt: 'yuva420p',
      vf: '',
      videoExtraArgs: [],
      audioCodec: 'none',
      audioExtraArgs: [],
      estimatedVideoBitrateKbps: 0,
      estimatedAudioBitrateKbps: 0,
      qualityImpactLabel:
        'WebP động, bitrate khó ước lượng. Dung lượng phụ thuộc vào nội dung và số khung.',
      warnings: outWarnings,
      webpQuality: q,
      webpMaxWidth: maxW
    }
  }

  const sourceAlpha = videoPixelFormatHasAlpha(probe.pixelFormat)
  const forceAlphaContainer =
    profile === CompressUseCaseProfile.TRANSPARENT_MOV ||
    profile === CompressUseCaseProfile.TRANSPARENT_WEBM ||
    sourceAlpha

  let codec = overrides.codec ?? defaultCodecForProfile(profile)
  if (profile === CompressUseCaseProfile.TRANSPARENT_WEBM) {
    codec = Codec.VP9
  }
  if (forceAlphaContainer && profile !== CompressUseCaseProfile.TRANSPARENT_MOV) {
    if (codec === Codec.H264 || codec === Codec.H265) {
      codec = Codec.VP9
      outWarnings.push(
        'Giữ alpha: đã chuyển sang VP9 + WebM (H.264/HEVC trong MP4 không phù hợp alpha).'
      )
    }
  }

  const userScale = overrides.scale != null && overrides.scale > 0 ? overrides.scale : 1
  const scale = effectiveScaleFromWidth(probe, userScale, profile)

  const targetFps = overrides.fps != null && overrides.fps > 0 ? overrides.fps : null
  const fpsPart = targetFps != null ? `fps=${clamp(Math.round(targetFps), 1, 120)},` : ''
  const vf = `${fpsPart}scale='trunc(iw*${scale}/2)*2':'trunc(ih*${scale}/2)*2':flags=lanczos`

  const audioKbps =
    overrides.audioBitrateKbps != null && overrides.audioBitrateKbps > 0
      ? clamp(Math.round(overrides.audioBitrateKbps), 32, 320)
      : profile === CompressUseCaseProfile.ARCHIVE
        ? 192
        : profile === CompressUseCaseProfile.DISCORD
          ? 96
          : 128

  const rateMode: CompressRateMode = overrides.rateMode ?? 'crf'
  const crfBase = baseCrfForCodec(quality, codec)
  const crf = overrides.crf != null ? clamp(overrides.crf, 0, 63) : crfBase
  const videoBitrateKbps =
    overrides.targetVideoBitrateKbps != null && overrides.targetVideoBitrateKbps > 0
      ? clamp(overrides.targetVideoBitrateKbps, 100, 80000)
      : null

  if (profile === CompressUseCaseProfile.DISCORD) {
    const guess = videoBitrateKbps ?? estimateBitrateFromCrf(crf, codec, probe, scale, false)
    pushDiscordBudgetWarning(outWarnings, probe, guess, audioKbps)
  }

  if (quality === CompressQualityPreset.ULTRA_COMPRESSED && scale >= 0.9) {
    outWarnings.push(
      'Ultra Compressed gần full độ phân giải: dễ artifact - cân nhắc giảm scale hoặc tăng bitrate.'
    )
  }

  const tuneGrain = profile === CompressUseCaseProfile.GREEN_SCREEN
  const useProres = profile === CompressUseCaseProfile.TRANSPARENT_MOV

  let ffmpegVideoCodec = 'libx264'
  let pixelFmt = 'yuv420p'
  const videoExtraArgs: string[] = []

  if (useProres) {
    ffmpegVideoCodec = 'prores_ks'
    pixelFmt = 'yuva444p10le'
    videoExtraArgs.push('-profile:v', '4444')
    if (rateMode === 'bitrate' && videoBitrateKbps) {
      videoExtraArgs.push('-b:v', `${videoBitrateKbps}k`)
    }
  } else if (codec === Codec.H264) {
    ffmpegVideoCodec = 'libx264'
    pixelFmt = 'yuv420p'
    const preset =
      quality === CompressQualityPreset.MAX_QUALITY
        ? 'slow'
        : quality === CompressQualityPreset.ULTRA_COMPRESSED
          ? 'veryfast'
          : 'medium'
    videoExtraArgs.push('-preset', preset)
    if (tuneGrain) videoExtraArgs.push('-tune', 'grain')
    if (rateMode === 'bitrate' && videoBitrateKbps) {
      videoExtraArgs.push(
        '-b:v',
        `${videoBitrateKbps}k`,
        '-maxrate',
        `${Math.round(videoBitrateKbps * 1.2)}k`,
        '-bufsize',
        `${Math.round(videoBitrateKbps * 2)}k`
      )
    } else {
      videoExtraArgs.push('-crf', String(crf))
    }
  } else if (codec === Codec.H265) {
    ffmpegVideoCodec = 'libx265'
    pixelFmt = 'yuv420p'
    const preset = quality === CompressQualityPreset.MAX_QUALITY ? 'slow' : 'medium'
    videoExtraArgs.push('-preset', preset)
    if (rateMode === 'bitrate' && videoBitrateKbps) {
      videoExtraArgs.push('-b:v', `${videoBitrateKbps}k`)
    } else {
      videoExtraArgs.push('-crf', String(crf))
    }
  } else if (codec === Codec.VP9) {
    ffmpegVideoCodec = 'libvpx-vp9'
    pixelFmt =
      sourceAlpha || profile === CompressUseCaseProfile.TRANSPARENT_WEBM ? 'yuva420p' : 'yuv420p'
    videoExtraArgs.push('-row-mt', '1')
    if (rateMode === 'bitrate' && videoBitrateKbps) {
      videoExtraArgs.push('-b:v', `${videoBitrateKbps}k`)
    } else {
      videoExtraArgs.push('-crf', String(crf), '-b:v', '0')
    }
  } else {
    ffmpegVideoCodec = 'libsvtav1'
    pixelFmt = 'yuv420p'
    videoExtraArgs.push('-preset', '6')
    if (rateMode === 'bitrate' && videoBitrateKbps) {
      videoExtraArgs.push('-b:v', `${videoBitrateKbps}k`)
    } else {
      videoExtraArgs.push('-crf', String(crf))
    }
  }

  const audioCodec = useProres
    ? 'aac'
    : profile === CompressUseCaseProfile.TRANSPARENT_WEBM || codec === Codec.VP9
      ? 'libopus'
      : 'aac'
  const audioExtraArgs =
    audioCodec === 'libopus' ? ['-b:a', `${audioKbps}k`, '-vbr', 'on'] : ['-b:a', `${audioKbps}k`]

  if (!probe.hasAudio) {
    outWarnings.push('Nguồn không có âm thanh - file ra chỉ gồm video.')
  }

  const estVideo = videoBitrateKbps ?? estimateBitrateFromCrf(crf, codec, probe, scale, useProres)

  const srcVideoKbps = heuristicSourceVideoBitrateKbps(probe)
  if (!useProres && srcVideoKbps != null && srcVideoKbps > 0 && estVideo > srcVideoKbps * 1.12) {
    const pct = Math.round((estVideo / srcVideoKbps - 1) * 100)
    outWarnings.push(
      `Ước lượng bitrate video cao hơn nguồn (~+${pct}%): file ra có thể lớn hơn file gốc. CRF nhắm mức chất lượng, không đảm bảo giảm dung lượng. Thử "Nhỏ dung lượng"/"Ultra nén", tăng CRF, hoặc chế độ bitrate tối đa.`
    )
  }

  return {
    outputKind: 'video_transcode',
    ffmpegVideoCodec,
    pixelFmt,
    vf,
    videoExtraArgs,
    audioCodec,
    audioExtraArgs,
    estimatedVideoBitrateKbps: estVideo,
    estimatedAudioBitrateKbps: probe.hasAudio ? audioKbps : 0,
    qualityImpactLabel: useProres
      ? 'ProRes 4444 - chất lượng cao, file rất lớn (phù hợp alpha).'
      : qualityImpactFromCrf(crf, codec),
    warnings: outWarnings
  }
}
