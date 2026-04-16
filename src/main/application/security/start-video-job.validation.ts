import { prettifyError, z } from 'zod'
import { ChromaEnhancePreset } from '@shared/domain/chroma-enhance'
import { ChromaKeyingKind } from '@shared/domain/chroma-keying-kind'
import type { StartVideoJobRequest } from '@shared/domain/video-job'
import { VideoOutputMode, VideoQualityPreset } from '@shared/domain/video-output-mode'

const modeSchema = z.enum([VideoOutputMode.GREEN_SCREEN, VideoOutputMode.ALPHA_MOV])
const presetSchema = z.enum([
  VideoQualityPreset.FAST,
  VideoQualityPreset.BALANCED,
  VideoQualityPreset.QUALITY
])

const keyingKindSchema = z.enum([ChromaKeyingKind.STUDIO_CHROMA, ChromaKeyingKind.SOLID_RGB])

const chromaEnhancePresetSchema = z.enum([
  ChromaEnhancePreset.LIGHT,
  ChromaEnhancePreset.BALANCED,
  ChromaEnhancePreset.STRONG
])

const startVideoJobSchema = z
  .object({
    jobId: z.uuid(),
    inputPath: z.string().min(1).max(4096),
    outputPath: z.string().min(1).max(4096),
    mode: modeSchema,
    preset: presetSchema,
    keyingKind: keyingKindSchema.default(ChromaKeyingKind.STUDIO_CHROMA),
    keyColor: z
      .string()
      .min(7)
      .max(12)
      .regex(/^0x[0-9a-fA-F]{6}$/, 'Key color must be like 0x00FF00'),
    similarity: z.number().min(0.01).max(0.55),
    blend: z.number().min(0).max(0.25),
    autoEnhanceOutput: z.boolean(),
    chromaEnhancePreset: chromaEnhancePresetSchema,
    exportWebp: z.boolean(),
    webpOutputPath: z.string().min(1).max(4096).optional()
  })
  .superRefine((data, ctx) => {
    if (data.exportWebp && (!data.webpOutputPath || data.webpOutputPath.trim().length === 0)) {
      ctx.addIssue({
        code: 'custom',
        message: 'webpOutputPath is required when exportWebp is true',
        path: ['webpOutputPath']
      })
    }
  })

export function parseStartVideoJobPayload(raw: unknown): StartVideoJobRequest {
  const parsed = startVideoJobSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(prettifyError(parsed.error))
  }
  const d = parsed.data
  return {
    jobId: d.jobId,
    inputPath: d.inputPath.trim(),
    outputPath: d.outputPath.trim(),
    mode: d.mode,
    preset: d.preset,
    keyingKind: d.keyingKind,
    keyColor: d.keyColor.trim(),
    similarity: d.similarity,
    blend: d.blend,
    autoEnhanceOutput: d.autoEnhanceOutput,
    chromaEnhancePreset: d.chromaEnhancePreset,
    exportWebp: d.exportWebp,
    webpOutputPath: d.exportWebp ? d.webpOutputPath?.trim() : undefined
  }
}

const jobIdSchema = z.uuid()

export function parseJobId(raw: unknown): string {
  const parsed = jobIdSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(prettifyError(parsed.error))
  }
  return parsed.data
}
