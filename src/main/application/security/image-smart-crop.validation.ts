import { prettifyError, z } from 'zod'

import type {
  ImageSmartCropOutputFormat,
  SmartCropAnalyzeRequest,
  StartImageSmartCropJobRequest
} from '@shared/domain/image-smart-crop'

const aspectModeSchema = z.enum(['free', '1:1', '16:9', '9:16', '4:3', '3:4'])

const outputFormatSchema = z.enum(['png', 'jpeg', 'webp', 'avif', 'tiff'])

const cropRectSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive()
})

const analyzeSchema = z.object({
  inputPath: z.string().min(1).max(8192),
  sensitivity: z.number().min(0).max(1),
  paddingRatio: z.number().min(0).max(0.45),
  aspectMode: aspectModeSchema
})

const startJobSchema = z.object({
  jobId: z.uuid(),
  inputPath: z.string().min(1).max(8192),
  outputPath: z.string().min(1).max(8192),
  outputFormat: outputFormatSchema,
  cropRect: cropRectSchema,
  keepAlpha: z.boolean(),
  jpegQuality: z.number().min(40).max(100).optional(),
  webpQuality: z.number().min(40).max(100).optional()
})

export function parseSmartCropAnalyzePayload(raw: unknown): SmartCropAnalyzeRequest {
  const parsed = analyzeSchema.safeParse(raw)
  if (!parsed.success) throw new Error(prettifyError(parsed.error))
  const d = parsed.data
  return { ...d, inputPath: d.inputPath.trim() }
}

export function parseStartImageSmartCropJobPayload(raw: unknown): StartImageSmartCropJobRequest {
  const parsed = startJobSchema.safeParse(raw)
  if (!parsed.success) throw new Error(prettifyError(parsed.error))
  const d = parsed.data
  return {
    jobId: d.jobId,
    inputPath: d.inputPath.trim(),
    outputPath: d.outputPath.trim(),
    outputFormat: d.outputFormat as ImageSmartCropOutputFormat,
    cropRect: d.cropRect,
    keepAlpha: d.keepAlpha,
    jpegQuality: d.jpegQuality ?? 88,
    webpQuality: d.webpQuality ?? 82
  }
}

const jobIdSchema = z.uuid()

export function parseImageSmartCropJobId(raw: unknown): string {
  const parsed = jobIdSchema.safeParse(raw)
  if (!parsed.success) throw new Error(prettifyError(parsed.error))
  return parsed.data
}
