import {
  AudioExtractFormat,
  type StartAudioExtractBatchRequest,
  type StartAudioExtractJobItem
} from '@shared/domain/audio-extract-job'
import { z } from 'zod'

const formatSchema = z.enum([
  AudioExtractFormat.M4A,
  AudioExtractFormat.MP3,
  AudioExtractFormat.WAV,
  AudioExtractFormat.FLAC,
  AudioExtractFormat.OPUS,
  AudioExtractFormat.OGG
])

const itemRawSchema = z.object({
  jobId: z.string().min(1).max(200),
  inputPath: z.string().min(1),
  outputPath: z.string().min(1),
  audioOrdinal: z.number().int().min(0).max(64),
  format: formatSchema,
  preferCopy: z.boolean()
})

const batchRawSchema = z.object({
  items: z.array(itemRawSchema).min(1).max(32)
})

export function parseStartAudioExtractBatchPayload(raw: unknown): StartAudioExtractBatchRequest {
  const parsed = batchRawSchema.parse(raw)
  const items: StartAudioExtractJobItem[] = parsed.items.map((row) => ({ ...row }))
  return { items }
}

export function parseAudioExtractJobId(raw: unknown): string {
  return z.string().min(1).max(200).parse(raw)
}
