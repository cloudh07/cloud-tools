import type { ImageSmartCropOutputFormat, SmartCropAspectMode } from './image-smart-crop'

export type SmartCropBatchStatus =
  | 'idle'
  | 'scanning'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type SmartCropBatchItem = {
  jobId: string
  inputPath: string
  outputPath: string
}

export type StartImageSmartCropBatchRequest = {
  batchId: string
  outputFormat: ImageSmartCropOutputFormat
  aspectMode: SmartCropAspectMode
  paddingRatio: number
  sensitivity: number
  keepAlpha: boolean
  zipOutput: boolean
  batchZipSourceFolderPath: string | null
  items: SmartCropBatchItem[]
}

export type SmartCropBatchZipResult = {
  zipPath: string
  outputCount: number
  skippedCount: number
}

export type ImageSmartCropBatchEvent =
  | { type: 'batch_started'; batchId: string; total: number }
  | { type: 'item_started'; batchId: string; jobId: string; index: number; total: number }
  | {
      type: 'item_progress'
      batchId: string
      jobId: string
      ratio: number
      phase: 'probe' | 'analyze' | 'export'
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
  | { type: 'batch_completed'; batchId: string; successCount: number; failCount: number }
  | { type: 'zip_started'; batchId: string }
  | { type: 'zip_completed'; batchId: string; result: SmartCropBatchZipResult }
  | { type: 'zip_failed'; batchId: string; message: string }
