import { z } from 'zod'

export const chromaVideoSearchSchema = z.object({
  focus: z.enum(['input', 'output', 'logs']).optional(),
  ref: z.string().trim().max(120).optional()
})

export type ChromaVideoSearch = z.infer<typeof chromaVideoSearchSchema>

export function parseChromaVideoSearch(raw: unknown): ChromaVideoSearch {
  const parsed = chromaVideoSearchSchema.safeParse(raw)
  return parsed.success ? parsed.data : {}
}
