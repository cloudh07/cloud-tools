export const WATERMARK_REMOVE_ENGINES = ['classical', 'ai'] as const
export type WatermarkRemoveEngine = (typeof WATERMARK_REMOVE_ENGINES)[number]

export const WATERMARK_REMOVE_MEDIA_KINDS = ['image', 'video'] as const
export type WatermarkRemoveMediaKind = (typeof WATERMARK_REMOVE_MEDIA_KINDS)[number]

export const WATERMARK_REMOVE_IMAGE_FORMATS = ['keep', 'jpeg', 'png', 'webp'] as const
export type WatermarkRemoveImageFormat = (typeof WATERMARK_REMOVE_IMAGE_FORMATS)[number]

export const WATERMARK_REMOVE_VIDEO_CODECS = ['copy', 'h264', 'vp9'] as const
export type WatermarkRemoveVideoCodec = (typeof WATERMARK_REMOVE_VIDEO_CODECS)[number]

export type MaskRectShape = {
  kind: 'rect'
  x: number
  y: number
  width: number
  height: number
  feather: number
}

export type MaskBrushShape = {
  kind: 'brush'
  points: ReadonlyArray<{ x: number; y: number }>
  radius: number
  feather: number
}

export type MaskPolygonShape = {
  kind: 'polygon'
  points: ReadonlyArray<{ x: number; y: number }>
  feather: number
}

export type MaskShape = MaskRectShape | MaskBrushShape | MaskPolygonShape

export type MaskKeyframe = {
  id: string
  time: number
  shapes: MaskShape[]
}

export type WatermarkRemoveSpec = {
  mediaKind: WatermarkRemoveMediaKind
  engine: WatermarkRemoveEngine
  canvasWidth: number
  canvasHeight: number
  keyframes: MaskKeyframe[]
  temporalSmooth: boolean
  temporalAlpha: number
}

export type WatermarkRemoveImageOptions = {
  outputFormat: WatermarkRemoveImageFormat
  jpegQuality: number
  webpQuality: number
  pngCompressionLevel: number
  autoRename: boolean
  overwrite: boolean
  keepMetadata: boolean
}

export type WatermarkRemoveVideoOptions = {
  videoCodec: WatermarkRemoveVideoCodec
  crf: number
  preset: 'ultrafast' | 'fast' | 'medium' | 'slow'
  copyAudio: boolean
  autoRename: boolean
  overwrite: boolean
}

export type WatermarkRemoveBatchItem = {
  jobId: string
  inputPath: string
  outputPath: string
}

export type StartWatermarkRemoveBatchRequest = {
  batchId: string
  spec: WatermarkRemoveSpec
  imageOptions: WatermarkRemoveImageOptions
  videoOptions: WatermarkRemoveVideoOptions
  items: WatermarkRemoveBatchItem[]
}

export type WatermarkRemovePreviewRequest = {
  inputPath: string
  previewTime: number
  spec: WatermarkRemoveSpec
  maxPreviewSize: number
}

export type WatermarkRemovePreviewResult = {
  pngBase64: string
  width: number
  height: number
}

export type WatermarkRemoveProbeResult = {
  mediaKind: WatermarkRemoveMediaKind
  width: number
  height: number
  durationSec: number | null
  fps: number | null
  formatLabel: string
}

export type WatermarkRemoveBatchSummary = {
  successCount: number
  failCount: number
}

export type WatermarkRemoveBatchEvent =
  | { type: 'batch_started'; batchId: string; total: number }
  | { type: 'item_started'; batchId: string; jobId: string; index: number; total: number }
  | {
      type: 'item_progress'
      batchId: string
      jobId: string
      ratio: number
      phase: 'probe' | 'inpaint' | 'encode' | 'mux'
      currentFrame?: number
      totalFrames?: number
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
  | { type: 'batch_completed'; batchId: string; summary: WatermarkRemoveBatchSummary }

export type WatermarkRemoveAutoDetectRequest = {
  inputPath: string
  previewTime: number
  preferAi: boolean
  canvasWidth: number
  canvasHeight: number
}

export type WatermarkRemoveAutoDetectResult = {
  shapes: MaskShape[]
  usedAi: boolean
  confidence: number
}

export const WATERMARK_REMOVE_MODELS = ['lama-inpaint', 'u2net-detect'] as const
export type WatermarkRemoveModelId = (typeof WATERMARK_REMOVE_MODELS)[number]

export type WatermarkRemoveModelStatus = {
  id: WatermarkRemoveModelId
  state: 'missing' | 'downloading' | 'ready' | 'error'
  bytesDownloaded: number
  bytesTotal: number
  errorMessage: string | null
}

export type WatermarkRemoveModelEvent =
  | { type: 'progress'; id: WatermarkRemoveModelId; bytesDownloaded: number; bytesTotal: number }
  | { type: 'completed'; id: WatermarkRemoveModelId }
  | { type: 'failed'; id: WatermarkRemoveModelId; message: string }
