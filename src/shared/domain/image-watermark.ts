export const WATERMARK_LAYOUTS = ['anchor', 'tile'] as const
export type WatermarkLayout = (typeof WATERMARK_LAYOUTS)[number]

export const WATERMARK_ANCHOR_POSITIONS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
] as const
export type WatermarkAnchorPosition = (typeof WATERMARK_ANCHOR_POSITIONS)[number]

export const WATERMARK_OUTPUT_FORMATS = ['keep', 'jpeg', 'png', 'webp'] as const
export type WatermarkOutputFormat = (typeof WATERMARK_OUTPUT_FORMATS)[number]

export type WatermarkCommonOptions = {
  opacity: number
  rotationDeg: number
  scalePercent: number
  marginPercent: number
}

export type WatermarkAnchorOptions = {
  position: WatermarkAnchorPosition
  offsetXpx: number
  offsetYpx: number
}

export type WatermarkTileOptions = {
  spacingXpercent: number
  spacingYpercent: number
  staggerOddRows: boolean
}

export type ImageWatermarkImageSource = {
  kind: 'image'
  logoPath: string
}

export type ImageWatermarkTextSource = {
  kind: 'text'
  text: string
  fontFamily: string
  fontWeight: number
  fontSizePercent: number
  colorHex: string
  strokeColorHex: string | null
  strokeWidthPx: number
}

export type ImageWatermarkSource = ImageWatermarkImageSource | ImageWatermarkTextSource

export type ImageWatermarkSpec = {
  source: ImageWatermarkSource
  layout: WatermarkLayout
  common: WatermarkCommonOptions
  anchor: WatermarkAnchorOptions
  tile: WatermarkTileOptions
}

export type ImageWatermarkBatchOptions = {
  outputFormat: WatermarkOutputFormat
  jpegQuality: number
  webpQuality: number
  pngCompressionLevel: number
  autoRename: boolean
  overwrite: boolean
  keepMetadata: boolean
}

export type ImageWatermarkBatchItem = {
  jobId: string
  inputPath: string
  outputPath: string
}

export type StartImageWatermarkBatchRequest = {
  batchId: string
  spec: ImageWatermarkSpec
  options: ImageWatermarkBatchOptions
  zipOutput: boolean
  batchZipSourceFolderPath: string | null
  items: ImageWatermarkBatchItem[]
}

export type ImageWatermarkPreviewRequest = {
  inputPath: string
  spec: ImageWatermarkSpec
  maxPreviewSize: number
}

export type ImageWatermarkPreviewResult = {
  pngBase64: string
  width: number
  height: number
}

export type ImageWatermarkBatchSummary = {
  successCount: number
  failCount: number
}

export type ImageWatermarkBatchZipResult = {
  zipPath: string
  outputCount: number
  skippedCount: number
}

export type ImageWatermarkBatchEvent =
  | { type: 'batch_started'; batchId: string; total: number }
  | {
      type: 'item_started'
      batchId: string
      jobId: string
      index: number
      total: number
    }
  | {
      type: 'item_progress'
      batchId: string
      jobId: string
      ratio: number
      phase: 'probe' | 'compose' | 'write'
    }
  | { type: 'item_log'; batchId: string; jobId: string; line: string }
  | {
      type: 'item_completed'
      batchId: string
      jobId: string
      inputPath: string
      outputPath: string
    }
  | { type: 'item_failed'; batchId: string; jobId: string; message: string }
  | { type: 'batch_cancelled'; batchId: string }
  | {
      type: 'batch_completed'
      batchId: string
      summary: ImageWatermarkBatchSummary
    }
  | { type: 'zip_started'; batchId: string }
  | { type: 'zip_completed'; batchId: string; result: ImageWatermarkBatchZipResult }
  | { type: 'zip_failed'; batchId: string; message: string }
