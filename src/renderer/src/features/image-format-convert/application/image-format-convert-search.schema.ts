import { z } from 'zod'

export const imageFormatConvertSearchSchema = z.object({
  media: z.enum(['image', 'video']).optional(),
  mode: z.enum(['single', 'batch']).optional()
})

export type ImageFormatConvertSearch = z.infer<typeof imageFormatConvertSearchSchema>

export function parseImageFormatConvertSearch(raw: unknown): ImageFormatConvertSearch {
  const parsed = imageFormatConvertSearchSchema.safeParse(raw)
  if (!parsed.success) return {}
  return parsed.data
}
