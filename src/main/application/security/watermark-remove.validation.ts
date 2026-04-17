import { z } from 'zod'

import {
  WATERMARK_REMOVE_ENGINES,
  WATERMARK_REMOVE_IMAGE_FORMATS,
  WATERMARK_REMOVE_MEDIA_KINDS,
  WATERMARK_REMOVE_MODELS,
  WATERMARK_REMOVE_VIDEO_CODECS,
  type StartWatermarkRemoveBatchRequest,
  type WatermarkRemoveAutoDetectRequest,
  type WatermarkRemovePreviewRequest,
  type WatermarkRemoveSpec
} from '@shared/domain/watermark-remove'

const point = z.object({
  x: z.number().min(-100000).max(100000),
  y: z.number().min(-100000).max(100000)
})

const rectShape = z.object({
  kind: z.literal('rect'),
  x: z.number().min(-100000).max(100000),
  y: z.number().min(-100000).max(100000),
  width: z.number().min(0).max(100000),
  height: z.number().min(0).max(100000),
  feather: z.number().min(0).max(64)
})

const brushShape = z.object({
  kind: z.literal('brush'),
  points: z.array(point).min(1).max(8192),
  radius: z.number().min(0.5).max(512),
  feather: z.number().min(0).max(64)
})

const polygonShape = z.object({
  kind: z.literal('polygon'),
  points: z.array(point).min(3).max(2048),
  feather: z.number().min(0).max(64)
})

const maskShapeSchema = z.discriminatedUnion('kind', [rectShape, brushShape, polygonShape])

const keyframeSchema = z.object({
  id: z.string().min(1).max(128),
  time: z.number().min(0).max(86400),
  shapes: z.array(maskShapeSchema).max(64)
})

const specSchema: z.ZodType<WatermarkRemoveSpec> = z.object({
  mediaKind: z.enum(WATERMARK_REMOVE_MEDIA_KINDS),
  engine: z.enum(WATERMARK_REMOVE_ENGINES),
  canvasWidth: z.number().int().min(2).max(16384),
  canvasHeight: z.number().int().min(2).max(16384),
  keyframes: z.array(keyframeSchema).min(1).max(64),
  temporalSmooth: z.boolean(),
  temporalAlpha: z.number().min(0.05).max(1)
})

const imageOptionsSchema = z.object({
  outputFormat: z.enum(WATERMARK_REMOVE_IMAGE_FORMATS),
  jpegQuality: z.number().int().min(1).max(100),
  webpQuality: z.number().int().min(1).max(100),
  pngCompressionLevel: z.number().int().min(0).max(9),
  autoRename: z.boolean(),
  overwrite: z.boolean(),
  keepMetadata: z.boolean()
})

const videoOptionsSchema = z.object({
  videoCodec: z.enum(WATERMARK_REMOVE_VIDEO_CODECS),
  crf: z.number().int().min(0).max(51),
  preset: z.enum(['ultrafast', 'fast', 'medium', 'slow']),
  copyAudio: z.boolean(),
  autoRename: z.boolean(),
  overwrite: z.boolean()
})

const batchItem = z.object({
  jobId: z.string().uuid(),
  inputPath: z.string().min(1).max(8192),
  outputPath: z.string().min(1).max(8192)
})

const startBatchSchema = z.object({
  batchId: z.string().uuid(),
  spec: specSchema,
  imageOptions: imageOptionsSchema,
  videoOptions: videoOptionsSchema,
  items: z.array(batchItem).min(1).max(2048)
})

const previewSchema = z.object({
  inputPath: z.string().min(1).max(8192),
  previewTime: z.number().min(0).max(86400),
  spec: specSchema,
  maxPreviewSize: z.number().int().min(64).max(4096)
})

const autoDetectSchema = z.object({
  inputPath: z.string().min(1).max(8192),
  previewTime: z.number().min(0).max(86400),
  preferAi: z.boolean(),
  canvasWidth: z.number().int().min(2).max(16384),
  canvasHeight: z.number().int().min(2).max(16384)
})

export function parseStartWatermarkRemoveBatchPayload(
  raw: unknown
): StartWatermarkRemoveBatchRequest {
  return startBatchSchema.parse(raw)
}

export function parseWatermarkRemoveBatchId(raw: unknown): string {
  return z.string().uuid().parse(raw)
}

export function parseWatermarkRemovePreviewPayload(raw: unknown): WatermarkRemovePreviewRequest {
  return previewSchema.parse(raw)
}

export function parseWatermarkRemoveAutoDetectPayload(
  raw: unknown
): WatermarkRemoveAutoDetectRequest {
  return autoDetectSchema.parse(raw)
}

export function parseWatermarkRemoveModelId(
  raw: unknown
): (typeof WATERMARK_REMOVE_MODELS)[number] {
  return z.enum(WATERMARK_REMOVE_MODELS).parse(raw)
}

export function parseWatermarkRemoveMediaKind(raw: unknown): 'image' | 'video' {
  return z.enum(['image', 'video']).parse(raw)
}
