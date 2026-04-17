import sharp from 'sharp'

import {
  classifyWatermarkRemoveMediaKind,
  validateWatermarkRemoveInputPath
} from '@main/infrastructure/fs/path-validator'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  WatermarkRemovePreviewRequest,
  WatermarkRemovePreviewResult
} from '@shared/domain/watermark-remove'

import { inpaintFrameAsync, inpaintImageClassical } from './classical-engine'
import { inpaintImageWithLama } from './lama-engine'
import { extractVideoFrameRgba } from './video-frame-pipeline'
import { rasterizeInterpolatedMask } from './mask-interpolator'

export async function renderWatermarkRemovePreview(
  cfg: AppConfig,
  req: WatermarkRemovePreviewRequest
): Promise<WatermarkRemovePreviewResult> {
  const kind = classifyWatermarkRemoveMediaKind(req.inputPath)
  if (!kind) throw new Error(`Định dạng không hỗ trợ: ${req.inputPath}`)
  const inputPath = validateWatermarkRemoveInputPath(req.inputPath, kind)

  if (kind === 'image') {
    const result =
      req.spec.engine === 'ai'
        ? await inpaintImageWithLama({
            inputPath,
            canvasWidth: req.spec.canvasWidth,
            canvasHeight: req.spec.canvasHeight,
            keyframes: req.spec.keyframes,
            time: 0
          })
        : await inpaintImageClassical({
            inputPath,
            canvasWidth: req.spec.canvasWidth,
            canvasHeight: req.spec.canvasHeight,
            keyframes: req.spec.keyframes,
            time: 0
          })
    return encodePreview(result.rgba, result.width, result.height, req.maxPreviewSize)
  }

  const frame = await extractVideoFrameRgba(cfg, inputPath, req.previewTime, req.maxPreviewSize)
  const mask = rasterizeInterpolatedMask({
    keyframes: req.spec.keyframes,
    time: req.previewTime,
    canvasWidth: req.spec.canvasWidth,
    canvasHeight: req.spec.canvasHeight,
    width: frame.width,
    height: frame.height
  })
  await inpaintFrameAsync(frame.rgba, mask, frame.width, frame.height)
  return encodePreview(frame.rgba, frame.width, frame.height, req.maxPreviewSize)
}

async function encodePreview(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  maxSize: number
): Promise<WatermarkRemovePreviewResult> {
  const ratio = Math.min(1, maxSize / Math.max(width, height))
  const targetW = Math.max(1, Math.round(width * ratio))
  const targetH = Math.max(1, Math.round(height * ratio))
  const buffer = await sharp(Buffer.from(rgba.buffer, rgba.byteOffset, rgba.byteLength), {
    raw: { width, height, channels: 4 }
  })
    .resize(targetW, targetH, { fit: 'inside' })
    .png({ compressionLevel: 6 })
    .toBuffer()
  return { pngBase64: buffer.toString('base64'), width: targetW, height: targetH }
}
