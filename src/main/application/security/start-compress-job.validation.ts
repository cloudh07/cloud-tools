import {
  CompressQualityPreset,
  CompressUseCaseProfile,
  CompressVideoCodec,
  defaultCompressOverrides,
  type CompressEncodingOverrides,
  type StartCompressBatchRequest,
  type StartCompressJobItem
} from '@shared/domain/compress-job'
import { z } from 'zod'

const qualitySchema = z.enum([
  CompressQualityPreset.MAX_QUALITY,
  CompressQualityPreset.BALANCED,
  CompressQualityPreset.SMALL_SIZE,
  CompressQualityPreset.ULTRA_COMPRESSED
])

const profileSchema = z.enum([
  CompressUseCaseProfile.GENERIC,
  CompressUseCaseProfile.WEB_UPLOAD,
  CompressUseCaseProfile.DISCORD,
  CompressUseCaseProfile.SOCIAL,
  CompressUseCaseProfile.TRANSPARENT_MOV,
  CompressUseCaseProfile.TRANSPARENT_WEBM,
  CompressUseCaseProfile.ANIMATED_WEBP,
  CompressUseCaseProfile.GREEN_SCREEN,
  CompressUseCaseProfile.ARCHIVE,
  CompressUseCaseProfile.STORAGE
])

const codecSchema = z.enum([
  CompressVideoCodec.H264,
  CompressVideoCodec.H265,
  CompressVideoCodec.VP9,
  CompressVideoCodec.AV1
])

const overridesPartialSchema = z.object({
  rateMode: z.enum(['crf', 'bitrate']).nullable().optional(),
  targetVideoBitrateKbps: z.number().nullable().optional(),
  crf: z.number().nullable().optional(),
  scale: z.number().nullable().optional(),
  fps: z.number().nullable().optional(),
  codec: codecSchema.nullable().optional(),
  audioBitrateKbps: z.number().nullable().optional()
})

const itemRawSchema = z.object({
  jobId: z.string().min(1).max(200),
  inputPath: z.string().min(1),
  outputPath: z.string().min(1),
  quality: qualitySchema,
  profile: profileSchema,
  overrides: overridesPartialSchema
})

const batchRawSchema = z.object({
  items: z.array(itemRawSchema).min(1).max(50)
})

function mergeOverrides(
  partial: z.infer<typeof overridesPartialSchema>
): CompressEncodingOverrides {
  return { ...defaultCompressOverrides(), ...partial }
}

export function parseStartCompressBatchPayload(raw: unknown): StartCompressBatchRequest {
  const parsed = batchRawSchema.parse(raw)
  const items: StartCompressJobItem[] = parsed.items.map((row) => ({
    ...row,
    overrides: mergeOverrides(row.overrides)
  }))
  return { items }
}

export function parseCompressJobId(raw: unknown): string {
  return z.string().min(1).max(200).parse(raw)
}
