export const DOCUMENT_MERGE_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
  'tif',
  'tiff'
] as const

export const DOCUMENT_MERGE_LIMITS = {
  maxImages: 100,
  maxImageBytes: 50 * 1024 * 1024,
  maxTotalImageBytes: 250 * 1024 * 1024,
  maxInputPixels: 80_000_000,
  maxPdfBytes: 100 * 1024 * 1024,
  maxPdfPages: 500,
  maxOutputPdfBytes: 10 * 1024 * 1024,
  thumbnailEdgePixels: 192,
  maxNormalizedEdgePixels: 3508
} as const

export type DocumentMergeMode = 'create' | 'append'
export type DocumentOutputFormat = 'pdf' | 'docx'
export type DocumentPageSize = 'a4' | 'match_image'
export type DocumentOrientation = 'auto' | 'portrait' | 'landscape'
export type DocumentMargin = 'none' | 'small' | 'standard'
export type ImageFit = 'contain' | 'cover' | 'actual'
export type BlankPageHandling = 'preserve' | 'fill_and_remove'

export type PageSettings = {
  pageSize: DocumentPageSize
  orientation: DocumentOrientation
  margin: DocumentMargin
  imageFit: ImageFit
  quality: number
}

export type DocumentImageFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'tiff'

export type DocumentImageDescriptor = {
  path: string
  name: string
  sizeBytes: number
  width: number
  height: number
  format: DocumentImageFormat
  mimeType: string
  hasAlpha: boolean
}

export type DocumentImageRejectionCode =
  | 'invalid_path'
  | 'unsupported_extension'
  | 'missing_file'
  | 'too_many_files'
  | 'file_too_large'
  | 'total_too_large'
  | 'signature_mismatch'
  | 'unsupported_content'
  | 'animated_or_multipage'
  | 'too_many_pixels'

export type DocumentImageRejection = {
  path: string
  name: string
  code: DocumentImageRejectionCode
  message: string
}

export type InspectDocumentImagesResult = {
  accepted: DocumentImageDescriptor[]
  rejected: DocumentImageRejection[]
}

export type DocumentPdfDescriptor = {
  path: string
  name: string
  sizeBytes: number
  pageCount: number
  structurallyBlankPageCount: number
}

export type DocumentImageThumbnail = {
  path: string
  dataUrl: string
}

export type StartDocumentMergeRequest = {
  jobId: string
  mode: DocumentMergeMode
  outputFormat: DocumentOutputFormat
  basePdfPath: string | null
  outputPath: string
  imagePaths: string[]
  blankPageHandling: BlankPageHandling
  settings: PageSettings
}

export type DocumentMergeProgressPhase =
  | 'validate'
  | 'inspect'
  | 'normalize'
  | 'merge'
  | 'optimize'
  | 'write'

export type DocumentMergeEvent =
  | { type: 'started'; jobId: string; totalImages: number }
  | {
      type: 'progress'
      jobId: string
      phase: DocumentMergeProgressPhase
      ratio: number
      currentIndex: number
      totalImages: number
    }
  | {
      type: 'completed'
      jobId: string
      outputPath: string
      pageCount: number
      outputSizeBytes: number
      blankPagesFilled: number
      blankPagesRemoved: number
    }
  | { type: 'cancelled'; jobId: string }
  | { type: 'failed'; jobId: string; message: string }

export type DocumentMergeWorkerRequest = StartDocumentMergeRequest & {
  temporaryOutputPath: string
}

export type DocumentMergeWorkerMessage =
  | {
      type: 'progress'
      phase: DocumentMergeProgressPhase
      ratio: number
      currentIndex: number
      totalImages: number
    }
  | {
      type: 'completed'
      pageCount: number
      outputSizeBytes: number
      blankPagesFilled: number
      blankPagesRemoved: number
    }
  | { type: 'failed'; message: string }
