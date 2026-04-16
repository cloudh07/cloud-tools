import { z } from 'zod'

export const imageFormatConvertSearchSchema = z.object({
  mode: z.enum(['single', 'batch']).optional()
})

export type ImageFormatConvertSearch = z.infer<typeof imageFormatConvertSearchSchema>

export function parseImageFormatConvertSearch(raw: unknown): ImageFormatConvertSearch {
  const parsed = imageFormatConvertSearchSchema.safeParse(raw)
  if (!parsed.success) return {}
  return parsed.data
}
