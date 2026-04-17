import { z } from 'zod'

import type {
  ImageWatermarkPreviewRequest,
  ImageWatermarkSpec,
  StartImageWatermarkBatchRequest
} from '@shared/domain/image-watermark'

const commonSchema = z.object({
  opacity: z.number().min(0).max(1),
  rotationDeg: z.number().min(-360).max(360),
  scalePercent: z.number().min(1).max(100),
  marginPercent: z.number().min(0).max(50)
})

const anchorSchema = z.object({
  position: z.enum([
    'top-left',
    'top',
    'top-right',
    'left',
    'center',
    'right',
    'bottom-left',
    'bottom',
    'bottom-right'
  ]),
  offsetXpx: z.number().int().min(-10000).max(10000),
  offsetYpx: z.number().int().min(-10000).max(10000)
})

const tileSchema = z.object({
  spacingXpercent: z.number().min(5).max(100),
  spacingYpercent: z.number().min(5).max(100),
  staggerOddRows: z.boolean()
})

const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/u, 'Mã màu không hợp lệ (ví dụ: #ffffff)')

const imageSourceSchema = z.object({
  kind: z.literal('image'),
  logoPath: z.string().min(1).max(8192)
})

const textSourceSchema = z.object({
  kind: z.literal('text'),
  text: z.string().min(1).max(512),
  fontFamily: z.string().min(1).max(120),
  fontWeight: z.number().int().min(100).max(900),
  fontSizePercent: z.number().min(1).max(50),
  colorHex: hexColor,
  strokeColorHex: z.union([hexColor, z.null()]),
  strokeWidthPx: z.number().min(0).max(20)
})

const specSchema: z.ZodType<ImageWatermarkSpec> = z.object({
  source: z.discriminatedUnion('kind', [imageSourceSchema, textSourceSchema]),
  layout: z.enum(['anchor', 'tile']),
  common: commonSchema,
  anchor: anchorSchema,
  tile: tileSchema
})

const optionsSchema = z.object({
  outputFormat: z.enum(['keep', 'jpeg', 'png', 'webp']),
  jpegQuality: z.number().min(1).max(100),
  webpQuality: z.number().min(1).max(100),
  pngCompressionLevel: z.number().min(0).max(9),
  autoRename: z.boolean(),
  overwrite: z.boolean(),
  keepMetadata: z.boolean()
})

const batchItemSchema = z.object({
  jobId: z.string().uuid(),
  inputPath: z.string().min(1),
  outputPath: z.string().min(1)
})

const startBatchSchema = z.object({
  batchId: z.string().uuid(),
  spec: specSchema,
  options: optionsSchema,
  zipOutput: z.boolean(),
  batchZipSourceFolderPath: z.union([z.string().min(1).max(8192), z.null()]),
  items: z.array(batchItemSchema).min(1)
})

const previewSchema = z.object({
  inputPath: z.string().min(1),
  spec: specSchema,
  maxPreviewSize: z.number().int().min(64).max(4096)
})

export function parseStartImageWatermarkBatchPayload(
  raw: unknown
): StartImageWatermarkBatchRequest {
  return startBatchSchema.parse(raw)
}

export function parseImageWatermarkBatchId(raw: unknown): string {
  return z.string().uuid().parse(raw)
}

export function parseImageWatermarkPreviewPayload(raw: unknown): ImageWatermarkPreviewRequest {
  return previewSchema.parse(raw)
}
