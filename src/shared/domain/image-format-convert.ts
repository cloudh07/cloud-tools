export const IMAGE_FORMAT_TARGETS = ['jpeg', 'png', 'webp', 'avif', 'tiff', 'gif'] as const

export type ImageFormatTarget = (typeof IMAGE_FORMAT_TARGETS)[number]

export type ImageFormatProbeResult = {
  width: number
  height: number
  format: string
  orientation: number | null
  hasAlpha: boolean
  fileSizeBytes: number
  pages: number | null
  hint: string | null
}

export type ImageFormatConvertOptions = {
  keepMetadata: boolean
  autoRename: boolean
  overwrite: boolean
  jpegQuality: number
  webpQuality: number
  avifQuality: number
  pngCompressionLevel: number
}

export type ImageFormatConvertBatchItem = {
  jobId: string
  inputPath: string
  outputPath: string
}

export type StartImageFormatConvertBatchRequest = {
  batchId: string
  outputFormat: ImageFormatTarget
  zipOutput: boolean
  batchZipSourceFolderPath: string | null
  options: ImageFormatConvertOptions
  items: ImageFormatConvertBatchItem[]
}

export type ImageFormatConvertBatchZipResult = {
  zipPath: string
  outputCount: number
  skippedCount: number
}

export type ImageFormatConvertBatchSummary = {
  successCount: number
  failCount: number
}

export type ImageFormatConvertBatchEvent =
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
      phase: 'probe' | 'convert' | 'write'
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
      summary: ImageFormatConvertBatchSummary
    }
  | { type: 'zip_started'; batchId: string }
  | { type: 'zip_completed'; batchId: string; result: ImageFormatConvertBatchZipResult }
  | { type: 'zip_failed'; batchId: string; message: string }
