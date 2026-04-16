import { prettifyError, z } from 'zod'

import type { StartImageSmartCropBatchRequest } from '@shared/domain/image-smart-crop-batch'
import type {
  ImageSmartCropOutputFormat,
  SmartCropAspectMode
} from '@shared/domain/image-smart-crop'

const aspectModeSchema = z.enum(['free', '1:1', '16:9', '9:16', '4:3', '3:4'])
const outputFormatSchema = z.enum(['png', 'jpeg', 'webp', 'avif', 'tiff'])

const itemSchema = z.object({
  jobId: z.uuid(),
  inputPath: z.string().min(1).max(8192),
  outputPath: z.string().min(1).max(8192)
})

const batchSchema = z.object({
  batchId: z.uuid(),
  outputFormat: outputFormatSchema,
  aspectMode: aspectModeSchema,
  paddingRatio: z.number().min(0).max(0.45),
  sensitivity: z.number().min(0).max(1),
  keepAlpha: z.boolean(),
  zipOutput: z.boolean(),
  batchZipSourceFolderPath: z.union([z.string().min(1).max(8192), z.null()]),
  items: z.array(itemSchema).min(1).max(500)
})

export function parseStartImageSmartCropBatchPayload(
  raw: unknown
): StartImageSmartCropBatchRequest {
  const parsed = batchSchema.safeParse(raw)
  if (!parsed.success) throw new Error(prettifyError(parsed.error))
  const d = parsed.data
  return {
    batchId: d.batchId,
    outputFormat: d.outputFormat as ImageSmartCropOutputFormat,
    aspectMode: d.aspectMode as SmartCropAspectMode,
    paddingRatio: d.paddingRatio,
    sensitivity: d.sensitivity,
    keepAlpha: d.keepAlpha,
    zipOutput: d.zipOutput,
    batchZipSourceFolderPath: d.batchZipSourceFolderPath,
    items: d.items.map((it) => ({
      jobId: it.jobId,
      inputPath: it.inputPath.trim(),
      outputPath: it.outputPath.trim()
    }))
  }
}

export function parseImageSmartCropBatchId(raw: unknown): string {
  const parsed = z.uuid().safeParse(raw)
  if (!parsed.success) throw new Error(prettifyError(parsed.error))
  return parsed.data
}
