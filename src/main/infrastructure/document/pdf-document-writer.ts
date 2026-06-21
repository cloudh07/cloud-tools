import { readFile, writeFile } from 'fs/promises'

import { PDFDocument } from 'pdf-lib'

import type {
  BlankPageHandling,
  DocumentImageDescriptor,
  DocumentMergeProgressPhase,
  PageSettings
} from '@shared/domain/image-document-merge'
import { DOCUMENT_MERGE_LIMITS } from '@shared/domain/image-document-merge'
import { calculateContainedSize } from '@shared/infrastructure/document/image-document-layout'
import { normalizeDocumentImage, type NormalizedDocumentImage } from './document-image-normalizer'
import { findStructurallyBlankPdfPageIndices } from './pdf-blank-page-analyzer'

type ProgressCallback = (
  phase: DocumentMergeProgressPhase,
  ratio: number,
  currentIndex: number
) => void

export type PdfCompressionProfile = {
  maxEdgePixels: number
  quality: number
  preserveAlpha: boolean
}

export type BlankPagePlacementPlan = {
  replacementPageIndices: number[]
  appendedImageIndices: number[]
  blankPagesFilled: number
  blankPagesRemoved: number
}

export type PdfDocumentWriteResult = {
  pageCount: number
  outputSizeBytes: number
  blankPagesFilled: number
  blankPagesRemoved: number
}

const COMPRESSION_PROFILE_PRESETS = [
  { maxEdgePixels: 3508, maximumQuality: 95, preserveAlpha: true },
  { maxEdgePixels: 2480, maximumQuality: 80, preserveAlpha: false },
  { maxEdgePixels: 1754, maximumQuality: 70, preserveAlpha: false },
  { maxEdgePixels: 1240, maximumQuality: 60, preserveAlpha: false },
  { maxEdgePixels: 960, maximumQuality: 50, preserveAlpha: false },
  { maxEdgePixels: 720, maximumQuality: 40, preserveAlpha: false },
  { maxEdgePixels: 512, maximumQuality: 30, preserveAlpha: false }
] as const

export function buildPdfCompressionProfiles(preferredQuality: number): PdfCompressionProfile[] {
  return COMPRESSION_PROFILE_PRESETS.map((preset) => ({
    maxEdgePixels: preset.maxEdgePixels,
    quality: Math.min(preferredQuality, preset.maximumQuality),
    preserveAlpha: preset.preserveAlpha
  }))
}

export function buildBlankPagePlacementPlan(
  blankPageIndices: readonly number[],
  imageCount: number
): BlankPagePlacementPlan {
  const blankPagesFilled = Math.min(blankPageIndices.length, imageCount)
  return {
    replacementPageIndices: blankPageIndices.slice(0, blankPagesFilled),
    appendedImageIndices: Array.from(
      { length: Math.max(0, imageCount - blankPagesFilled) },
      (_, index) => blankPagesFilled + index
    ),
    blankPagesFilled,
    blankPagesRemoved: blankPageIndices.length - blankPagesFilled
  }
}

async function prepareBasePdf(params: {
  basePdfPath: string | null
  blankPageHandling: BlankPageHandling
  maxOutputBytes: number
}): Promise<{ bytes: Uint8Array | null; blankPageIndices: number[] }> {
  if (!params.basePdfPath) return { bytes: null, blankPageIndices: [] }

  const pdf = await PDFDocument.load(await readFile(params.basePdfPath), { updateMetadata: false })
  const blankPageIndices =
    params.blankPageHandling === 'fill_and_remove' ? findStructurallyBlankPdfPageIndices(pdf) : []

  for (let index = blankPageIndices.length - 1; index >= 0; index--) {
    pdf.removePage(blankPageIndices[index]!)
  }

  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false })
  if (bytes.length >= params.maxOutputBytes) {
    throw new Error(
      'The source PDF cannot fit under the 10 MB output limit after blank-page cleanup.'
    )
  }
  return { bytes, blankPageIndices }
}

async function addImagePage(params: {
  pdf: PDFDocument
  normalized: NormalizedDocumentImage
  settings: PageSettings
  pageIndex?: number
}): Promise<void> {
  const embedded =
    params.normalized.type === 'png'
      ? await params.pdf.embedPng(params.normalized.data)
      : await params.pdf.embedJpg(params.normalized.data)
  const { layout } = params.normalized
  const page =
    params.pageIndex == null
      ? params.pdf.addPage([layout.pageWidthPoints, layout.pageHeightPoints])
      : params.pdf.insertPage(params.pageIndex, [layout.pageWidthPoints, layout.pageHeightPoints])

  let drawWidth = layout.contentWidthPoints
  let drawHeight = layout.contentHeightPoints
  if (params.settings.imageFit !== 'cover') {
    const sourceWidth =
      params.settings.imageFit === 'actual' ? params.normalized.sourceWidth * 0.75 : embedded.width
    const sourceHeight =
      params.settings.imageFit === 'actual'
        ? params.normalized.sourceHeight * 0.75
        : embedded.height
    const contained = calculateContainedSize(
      sourceWidth,
      sourceHeight,
      layout.contentWidthPoints,
      layout.contentHeightPoints,
      params.settings.imageFit !== 'actual'
    )
    drawWidth = contained.width
    drawHeight = contained.height
  }

  page.drawImage(embedded, {
    x: layout.marginPoints + (layout.contentWidthPoints - drawWidth) / 2,
    y: layout.marginPoints + (layout.contentHeightPoints - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight
  })
}

async function buildPdfAttempt(params: {
  preparedBaseBytes: Uint8Array | null
  blankPageIndices: readonly number[]
  images: DocumentImageDescriptor[]
  settings: PageSettings
  profile: PdfCompressionProfile
  attemptIndex: number
  attemptCount: number
  onProgress: ProgressCallback
}): Promise<{ bytes: Uint8Array; pageCount: number; plan: BlankPagePlacementPlan }> {
  const normalizedImages: NormalizedDocumentImage[] = []
  const attemptStart = 0.08 + (params.attemptIndex / params.attemptCount) * 0.82
  const attemptSpan = 0.82 / params.attemptCount
  const phase: DocumentMergeProgressPhase = params.attemptIndex === 0 ? 'normalize' : 'optimize'

  for (let index = 0; index < params.images.length; index++) {
    params.onProgress(
      phase,
      attemptStart + (index / Math.max(1, params.images.length)) * attemptSpan * 0.75,
      index
    )
    normalizedImages.push(
      await normalizeDocumentImage(params.images[index]!, params.settings, params.profile)
    )
  }

  const pdf = params.preparedBaseBytes
    ? await PDFDocument.load(params.preparedBaseBytes, { updateMetadata: false })
    : await PDFDocument.create()
  const plan = buildBlankPagePlacementPlan(params.blankPageIndices, normalizedImages.length)

  for (let index = 0; index < plan.replacementPageIndices.length; index++) {
    await addImagePage({
      pdf,
      normalized: normalizedImages[index]!,
      settings: params.settings,
      pageIndex: plan.replacementPageIndices[index]
    })
  }
  for (const imageIndex of plan.appendedImageIndices) {
    await addImagePage({
      pdf,
      normalized: normalizedImages[imageIndex]!,
      settings: params.settings
    })
  }

  params.onProgress(
    params.attemptIndex === 0 ? 'merge' : 'optimize',
    attemptStart + attemptSpan * 0.85,
    params.images.length - 1
  )
  const bytes = await pdf.save({ useObjectStreams: true, addDefaultPage: false })
  return { bytes, pageCount: pdf.getPageCount(), plan }
}

export async function writePdfDocument(params: {
  basePdfPath: string | null
  outputPath: string
  images: DocumentImageDescriptor[]
  settings: PageSettings
  blankPageHandling: BlankPageHandling
  onProgress: ProgressCallback
  maxOutputBytes?: number
}): Promise<PdfDocumentWriteResult> {
  const maxOutputBytes = params.maxOutputBytes ?? DOCUMENT_MERGE_LIMITS.maxOutputPdfBytes
  const prepared = await prepareBasePdf({
    basePdfPath: params.basePdfPath,
    blankPageHandling: params.blankPageHandling,
    maxOutputBytes
  })
  const profiles = buildPdfCompressionProfiles(params.settings.quality)

  for (let attemptIndex = 0; attemptIndex < profiles.length; attemptIndex++) {
    const attempt = await buildPdfAttempt({
      preparedBaseBytes: prepared.bytes,
      blankPageIndices: prepared.blankPageIndices,
      images: params.images,
      settings: params.settings,
      profile: profiles[attemptIndex]!,
      attemptIndex,
      attemptCount: profiles.length,
      onProgress: params.onProgress
    })
    if (attempt.bytes.length >= maxOutputBytes) continue

    params.onProgress('write', 0.95, params.images.length - 1)
    await writeFile(params.outputPath, attempt.bytes)
    params.onProgress('write', 1, params.images.length - 1)
    return {
      pageCount: attempt.pageCount,
      outputSizeBytes: attempt.bytes.length,
      blankPagesFilled: attempt.plan.blankPagesFilled,
      blankPagesRemoved: attempt.plan.blankPagesRemoved
    }
  }

  throw new Error(
    'Unable to create a PDF under 10 MB without reducing the document below the minimum quality profile.'
  )
}
