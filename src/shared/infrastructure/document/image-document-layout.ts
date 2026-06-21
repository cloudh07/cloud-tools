import type { PageSettings } from '@shared/domain/image-document-merge'

const POINTS_PER_MILLIMETRE = 72 / 25.4
const A4_WIDTH_POINTS = 210 * POINTS_PER_MILLIMETRE
const A4_HEIGHT_POINTS = 297 * POINTS_PER_MILLIMETRE

const MARGIN_MILLIMETRES: Record<PageSettings['margin'], number> = {
  none: 0,
  small: 6,
  standard: 12
}

export type DocumentPageLayout = {
  pageWidthPoints: number
  pageHeightPoints: number
  marginPoints: number
  contentWidthPoints: number
  contentHeightPoints: number
}

function resolveLandscape(
  imageWidth: number,
  imageHeight: number,
  orientation: PageSettings['orientation']
): boolean {
  if (orientation === 'landscape') return true
  if (orientation === 'portrait') return false
  return imageWidth > imageHeight
}

export function calculateDocumentPageLayout(
  imageWidth: number,
  imageHeight: number,
  settings: PageSettings
): DocumentPageLayout {
  const safeWidth = Math.max(1, imageWidth)
  const safeHeight = Math.max(1, imageHeight)
  const landscape = resolveLandscape(safeWidth, safeHeight, settings.orientation)

  let pageWidthPoints = landscape ? A4_HEIGHT_POINTS : A4_WIDTH_POINTS
  let pageHeightPoints = landscape ? A4_WIDTH_POINTS : A4_HEIGHT_POINTS

  if (settings.pageSize === 'match_image') {
    const longToShortRatio = Math.max(safeWidth, safeHeight) / Math.min(safeWidth, safeHeight)
    if (landscape) {
      pageWidthPoints = A4_HEIGHT_POINTS
      pageHeightPoints = pageWidthPoints / longToShortRatio
    } else {
      pageHeightPoints = A4_HEIGHT_POINTS
      pageWidthPoints = pageHeightPoints / longToShortRatio
    }
  }

  const requestedMargin = MARGIN_MILLIMETRES[settings.margin] * POINTS_PER_MILLIMETRE
  const maximumMargin = Math.max(0, Math.min(pageWidthPoints, pageHeightPoints) / 2 - 1)
  const marginPoints = Math.min(requestedMargin, maximumMargin)

  return {
    pageWidthPoints,
    pageHeightPoints,
    marginPoints,
    contentWidthPoints: Math.max(1, pageWidthPoints - marginPoints * 2),
    contentHeightPoints: Math.max(1, pageHeightPoints - marginPoints * 2)
  }
}

export function calculateContainedSize(
  sourceWidth: number,
  sourceHeight: number,
  maximumWidth: number,
  maximumHeight: number,
  allowUpscale = true
): { width: number; height: number } {
  const safeWidth = Math.max(1, sourceWidth)
  const safeHeight = Math.max(1, sourceHeight)
  const scale = Math.min(maximumWidth / safeWidth, maximumHeight / safeHeight)
  const appliedScale = allowUpscale ? scale : Math.min(1, scale)
  return {
    width: safeWidth * appliedScale,
    height: safeHeight * appliedScale
  }
}

export function millimetresToTwips(millimetres: number): number {
  return Math.round((millimetres / 25.4) * 1440)
}

export function pointsToTwips(points: number): number {
  return Math.round(points * 20)
}
