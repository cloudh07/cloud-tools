import { z } from 'zod'

import {
  VIDEO_FORMAT_TARGETS,
  type StartVideoFormatConvertJobRequest
} from '@shared/domain/video-format-convert'

const targetSchema = z.enum(VIDEO_FORMAT_TARGETS)

const startJobSchema = z.object({
  jobId: z.string().min(8).max(128),
  inputPath: z.string().min(1).max(8192),
  outputPath: z.string().min(1).max(8192),
  target: targetSchema
})

export function parseStartVideoFormatConvertJobPayload(
  raw: unknown
): StartVideoFormatConvertJobRequest {
  return startJobSchema.parse(raw)
}

export function parseVideoFormatConvertJobId(raw: unknown): string {
  return z.string().min(8).max(128).parse(raw)
}
