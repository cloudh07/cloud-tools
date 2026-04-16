export const VideoOutputMode = {
  GREEN_SCREEN: 'green_screen',
  ALPHA_MOV: 'alpha_mov'
} as const

export type VideoOutputMode = (typeof VideoOutputMode)[keyof typeof VideoOutputMode]

export const VideoQualityPreset = {
  FAST: 'fast',
  BALANCED: 'balanced',
  QUALITY: 'quality'
} as const

export type VideoQualityPreset = (typeof VideoQualityPreset)[keyof typeof VideoQualityPreset]
