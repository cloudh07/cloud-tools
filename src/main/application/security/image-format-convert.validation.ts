import { z } from 'zod'

import type { ImageFormatTarget } from '@shared/domain/image-format-convert'

const batchItemSchema = z.object({
  jobId: z.string().uuid(),
  inputPath: z.string().min(1),
  outputPath: z.string().min(1)
})

const optionsSchema = z.object({
  keepMetadata: z.boolean(),
  autoRename: z.boolean(),
  overwrite: z.boolean(),
  jpegQuality: z.number().min(1).max(100),
  webpQuality: z.number().min(1).max(100),
  avifQuality: z.number().min(1).max(100),
  pngCompressionLevel: z.number().min(0).max(9)
})

const startBatchSchema = z.object({
  batchId: z.string().uuid(),
  outputFormat: z.enum(['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif']),
  zipOutput: z.boolean(),
  batchZipSourceFolderPath: z.union([z.string().min(1).max(8192), z.null()]),
  options: optionsSchema,
  items: z.array(batchItemSchema).min(1)
})

export type ParsedStartImageFormatConvertBatch = Omit<
  z.infer<typeof startBatchSchema>,
  'outputFormat'
> & {
  outputFormat: ImageFormatTarget
}

export function parseStartImageFormatConvertBatchPayload(
  raw: unknown
): ParsedStartImageFormatConvertBatch {
  const p = startBatchSchema.parse(raw)
  return { ...p, outputFormat: p.outputFormat as ImageFormatTarget }
}

export function parseImageFormatConvertBatchId(raw: unknown): string {
  return z.string().uuid().parse(raw)
}
