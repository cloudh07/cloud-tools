export const ChromaKeyingKind = {
  STUDIO_CHROMA: 'studio_chroma',
  SOLID_RGB: 'solid_rgb'
} as const

export type ChromaKeyingKind = (typeof ChromaKeyingKind)[keyof typeof ChromaKeyingKind]
