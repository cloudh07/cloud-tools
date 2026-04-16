export type ImageSmartCropOutputFormat = 'png' | 'jpeg' | 'webp' | 'avif' | 'tiff'

export type SmartCropAspectMode = 'free' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'

export type CropRect = {
  x: number
  y: number
  width: number
  height: number
}

export type ImageSmartCropMeta = {
  width: number
  height: number
  format?: string
  orientationNormalized: boolean
}

export type SmartCropAnalysisResult = {
  image: ImageSmartCropMeta
  tightSaliencyRect?: CropRect
  paddingAppliedPx?: number
  cropRect: CropRect
  analysisSize: { width: number; height: number }
  confidence: number
  fallbackUsed: boolean
  detail: string
}

export type SmartCropAnalyzeRequest = {
  inputPath: string
  sensitivity: number
  paddingRatio: number
  aspectMode: SmartCropAspectMode
}

export type StartImageSmartCropJobRequest = {
  jobId: string
  inputPath: string
  outputPath: string
  outputFormat: ImageSmartCropOutputFormat
  cropRect: CropRect
  keepAlpha: boolean
  jpegQuality: number
  webpQuality: number
}

export type ImageSmartCropJobEvent =
  | { type: 'item_started'; jobId: string }
  | { type: 'progress'; jobId: string; progress: number }
  | { type: 'log'; jobId: string; line: string }
  | { type: 'completed'; jobId: string; outputPath: string }
  | { type: 'failed'; jobId: string; message: string }
  | { type: 'cancelled'; jobId: string }

export function aspectModeToRatio(mode: SmartCropAspectMode): number | null {
  switch (mode) {
    case 'free':
      return null
    case '1:1':
      return 1
    case '16:9':
      return 16 / 9
    case '9:16':
      return 9 / 16
    case '4:3':
      return 4 / 3
    case '3:4':
      return 3 / 4
    default:
      return null
  }
}

export function outputFormatSupportsAlpha(format: ImageSmartCropOutputFormat): boolean {
  return format === 'png' || format === 'webp' || format === 'avif' || format === 'tiff'
}
