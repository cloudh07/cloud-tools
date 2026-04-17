import sharp from 'sharp'

import {
  classifyWatermarkRemoveMediaKind,
  validateWatermarkRemoveInputPath
} from '@main/infrastructure/fs/path-validator'
import { probeVideoFile } from '@main/infrastructure/ffmpeg/ffprobe-service'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import type { AppConfig } from '@shared/domain/app-config'
import type { WatermarkRemoveProbeResult } from '@shared/domain/watermark-remove'

export async function probeWatermarkRemoveMedia(
  cfg: AppConfig,
  inputPath: string
): Promise<WatermarkRemoveProbeResult> {
  const kind = classifyWatermarkRemoveMediaKind(inputPath)
  if (!kind) {
    throw new Error(`Định dạng không hỗ trợ cho xóa watermark: ${inputPath}`)
  }
  const abs = validateWatermarkRemoveInputPath(inputPath, kind)

  if (kind === 'image') {
    const meta = await sharp(abs, { failOn: 'none' }).metadata()
    return {
      mediaKind: 'image',
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      durationSec: null,
      fps: null,
      formatLabel: meta.format ?? 'image'
    }
  }

  const resolver = getMediaBinaryResolver()
  const ffprobe = resolver.resolveFfprobeOrThrow(cfg)
  const probe = await probeVideoFile(ffprobe.path, abs)
  return {
    mediaKind: 'video',
    width: probe.width ?? 0,
    height: probe.height ?? 0,
    durationSec: probe.durationSec,
    fps: probe.fps,
    formatLabel: probe.videoCodec ?? 'video'
  }
}
