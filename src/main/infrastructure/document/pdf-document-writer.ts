import { readFile, writeFile } from 'fs/promises'

import { PDFDocument } from 'pdf-lib'

import type {
  DocumentImageDescriptor,
  DocumentMergeProgressPhase,
  PageSettings
} from '@shared/domain/image-document-merge'
import { calculateContainedSize } from '@shared/infrastructure/document/image-document-layout'
import { normalizeDocumentImage } from './document-image-normalizer'

type ProgressCallback = (
  phase: DocumentMergeProgressPhase,
  ratio: number,
  currentIndex: number
) => void

export async function writePdfDocument(params: {
  basePdfPath: string | null
  outputPath: string
  images: DocumentImageDescriptor[]
  settings: PageSettings
  onProgress: ProgressCallback
}): Promise<number> {
  const pdf = params.basePdfPath
    ? await PDFDocument.load(await readFile(params.basePdfPath), { updateMetadata: false })
    : await PDFDocument.create()

  for (let index = 0; index < params.images.length; index++) {
    const descriptor = params.images[index]!
    params.onProgress('normalize', 0.1 + (index / params.images.length) * 0.65, index)
    const normalized = await normalizeDocumentImage(descriptor, params.settings)
    const embedded =
      normalized.type === 'png'
        ? await pdf.embedPng(normalized.data)
        : await pdf.embedJpg(normalized.data)

    const { layout } = normalized
    const page = pdf.addPage([layout.pageWidthPoints, layout.pageHeightPoints])
    let drawWidth = layout.contentWidthPoints
    let drawHeight = layout.contentHeightPoints
    if (params.settings.imageFit !== 'cover') {
      const sourceWidth =
        params.settings.imageFit === 'actual' ? normalized.sourceWidth * 0.75 : embedded.width
      const sourceHeight =
        params.settings.imageFit === 'actual' ? normalized.sourceHeight * 0.75 : embedded.height
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
    params.onProgress('merge', 0.1 + ((index + 1) / params.images.length) * 0.75, index)
  }

  params.onProgress('write', 0.9, params.images.length - 1)
  const output = await pdf.save({ useObjectStreams: true, addDefaultPage: false })
  await writeFile(params.outputPath, output)
  params.onProgress('write', 1, params.images.length - 1)
  return pdf.getPageCount()
}
