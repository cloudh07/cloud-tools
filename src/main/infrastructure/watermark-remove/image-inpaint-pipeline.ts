import { extname } from 'path'

import sharp from 'sharp'

import {
  validateWatermarkRemoveInputPath,
  validateWatermarkRemoveOutputPath
} from '@main/infrastructure/fs/path-validator'
import type {
  WatermarkRemoveImageFormat,
  WatermarkRemoveImageOptions,
  WatermarkRemoveSpec
} from '@shared/domain/watermark-remove'

import { inpaintImageClassical } from './classical-engine'
import { inpaintImageWithLama } from './lama-engine'

export type RunImageInpaintParams = {
  inputPath: string
  outputPath: string
  spec: WatermarkRemoveSpec
  options: WatermarkRemoveImageOptions
}

const SOURCE_EXT_TO_FORMAT: Record<string, Exclude<WatermarkRemoveImageFormat, 'keep'>> = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp'
}

export async function runImageInpaint(params: RunImageInpaintParams): Promise<void> {
  const { spec, options } = params
  const inputPath = validateWatermarkRemoveInputPath(params.inputPath, 'image')
  const outputPath = validateWatermarkRemoveOutputPath(params.outputPath, 'image')

  const result =
    spec.engine === 'ai'
      ? await inpaintImageWithLama({
          inputPath,
          canvasWidth: spec.canvasWidth,
          canvasHeight: spec.canvasHeight,
          keyframes: spec.keyframes,
          time: 0
        })
      : await inpaintImageClassical({
          inputPath,
          canvasWidth: spec.canvasWidth,
          canvasHeight: spec.canvasHeight,
          keyframes: spec.keyframes,
          time: 0
        })

  let pipeline = sharp(
    Buffer.from(result.rgba.buffer, result.rgba.byteOffset, result.rgba.byteLength),
    {
      raw: { width: result.width, height: result.height, channels: 4 }
    }
  )

  if (options.keepMetadata) pipeline = pipeline.withMetadata()

  const targetFormat = resolveTargetFormat(options.outputFormat, outputPath)
  switch (targetFormat) {
    case 'jpeg':
      pipeline = pipeline
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: options.jpegQuality, mozjpeg: true })
      break
    case 'png':
      pipeline = pipeline.png({ compressionLevel: options.pngCompressionLevel })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality: options.webpQuality })
      break
  }

  await pipeline.toFile(outputPath)
}

function resolveTargetFormat(
  format: WatermarkRemoveImageFormat,
  outputPath: string
): Exclude<WatermarkRemoveImageFormat, 'keep'> {
  if (format !== 'keep') return format
  const ext = extname(outputPath).toLowerCase()
  return SOURCE_EXT_TO_FORMAT[ext] ?? 'png'
}
