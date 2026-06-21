import sharp from 'sharp'

import {
  DOCUMENT_MERGE_LIMITS,
  type DocumentImageDescriptor,
  type PageSettings
} from '@shared/domain/image-document-merge'
import {
  calculateDocumentPageLayout,
  type DocumentPageLayout
} from '@shared/infrastructure/document/image-document-layout'

export type NormalizedDocumentImage = {
  data: Buffer
  type: 'jpg' | 'png'
  width: number
  height: number
  sourceWidth: number
  sourceHeight: number
  layout: DocumentPageLayout
}

export type DocumentImageNormalizationOptions = {
  maxEdgePixels?: number
  quality?: number
  preserveAlpha?: boolean
}

function orientedDimensions(
  descriptor: DocumentImageDescriptor,
  orientation: number | undefined
): { width: number; height: number } {
  const swapAxes = orientation != null && orientation >= 5 && orientation <= 8
  return swapAxes
    ? { width: descriptor.height, height: descriptor.width }
    : { width: descriptor.width, height: descriptor.height }
}

function targetPixelSize(
  layout: DocumentPageLayout,
  maxEdgePixels: number
): { width: number; height: number } {
  const pixelsPerPoint = 300 / 72
  let width = layout.contentWidthPoints * pixelsPerPoint
  let height = layout.contentHeightPoints * pixelsPerPoint
  const maximumEdge = Math.max(width, height)
  if (maximumEdge > maxEdgePixels) {
    const scale = maxEdgePixels / maximumEdge
    width *= scale
    height *= scale
  }
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) }
}

export async function normalizeDocumentImage(
  descriptor: DocumentImageDescriptor,
  settings: PageSettings,
  options: DocumentImageNormalizationOptions = {}
): Promise<NormalizedDocumentImage> {
  const metadata = await sharp(descriptor.path, {
    failOn: 'error',
    limitInputPixels: DOCUMENT_MERGE_LIMITS.maxInputPixels
  }).metadata()
  const source = orientedDimensions(descriptor, metadata.orientation)
  const layout = calculateDocumentPageLayout(source.width, source.height, settings)
  const target = targetPixelSize(
    layout,
    options.maxEdgePixels ?? DOCUMENT_MERGE_LIMITS.maxNormalizedEdgePixels
  )
  const preserveAlpha = options.preserveAlpha ?? true
  const quality = options.quality ?? settings.quality

  let pipeline = sharp(descriptor.path, {
    failOn: 'error',
    limitInputPixels: DOCUMENT_MERGE_LIMITS.maxInputPixels
  })
    .rotate()
    .toColourspace('srgb')

  if (settings.imageFit === 'cover') {
    pipeline = pipeline.resize(target.width, target.height, { fit: 'cover', position: 'centre' })
  } else {
    pipeline = pipeline.resize(target.width, target.height, {
      fit: 'inside',
      withoutEnlargement: settings.imageFit === 'actual'
    })
  }

  if (descriptor.hasAlpha && preserveAlpha) {
    const result = await pipeline.png({ compressionLevel: 8 }).toBuffer({ resolveWithObject: true })
    return {
      data: result.data,
      type: 'png',
      width: result.info.width,
      height: result.info.height,
      sourceWidth: source.width,
      sourceHeight: source.height,
      layout
    }
  }

  const result = await pipeline
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
  return {
    data: result.data,
    type: 'jpg',
    width: result.info.width,
    height: result.info.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    layout
  }
}
