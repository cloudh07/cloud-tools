import { z } from 'zod'

export const imageSmartCropSearchSchema = z.object({
  mode: z.enum(['single', 'batch']).optional()
})

export type ImageSmartCropSearch = z.infer<typeof imageSmartCropSearchSchema>

export function parseImageSmartCropSearch(raw: unknown): ImageSmartCropSearch {
  const parsed = imageSmartCropSearchSchema.safeParse(raw)
  if (!parsed.success) return {}
  return parsed.data
}
