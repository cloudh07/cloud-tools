export const ChromaEnhancePreset = {
  LIGHT: 'light',
  BALANCED: 'balanced',
  STRONG: 'strong'
} as const

export type ChromaEnhancePreset = (typeof ChromaEnhancePreset)[keyof typeof ChromaEnhancePreset]

export type ChromaEnhanceStrength = {
  dnLumaSpatial: number
  dnChromaSpatial: number
  dnLumaTemporal: number
  dnChromaTemporal: number
  unsharpLumaMsize: number
  unsharpLumaAmount: number
  unsharpChromaMsize: number
  unsharpChromaAmount: number
}
