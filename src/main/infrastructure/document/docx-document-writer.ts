import { writeFile } from 'fs/promises'

import {
  AlignmentType,
  Document,
  ImageRun,
  Packer,
  PageOrientation,
  Paragraph,
  type ISectionOptions
} from 'docx'

import type {
  DocumentImageDescriptor,
  DocumentMergeProgressPhase,
  PageSettings
} from '@shared/domain/image-document-merge'
import {
  calculateContainedSize,
  pointsToTwips
} from '@shared/infrastructure/document/image-document-layout'
import { normalizeDocumentImage } from './document-image-normalizer'

type ProgressCallback = (
  phase: DocumentMergeProgressPhase,
  ratio: number,
  currentIndex: number
) => void

export async function writeDocxDocument(params: {
  outputPath: string
  images: DocumentImageDescriptor[]
  settings: PageSettings
  onProgress: ProgressCallback
}): Promise<number> {
  const sections: ISectionOptions[] = []

  for (let index = 0; index < params.images.length; index++) {
    const descriptor = params.images[index]!
    params.onProgress('normalize', 0.1 + (index / params.images.length) * 0.65, index)
    const normalized = await normalizeDocumentImage(descriptor, params.settings)
    const { layout } = normalized
    const maximumWidth = (layout.contentWidthPoints * 96) / 72
    const maximumHeight = (layout.contentHeightPoints * 96) / 72
    const displaySize =
      params.settings.imageFit === 'cover'
        ? { width: maximumWidth, height: maximumHeight }
        : calculateContainedSize(
            normalized.sourceWidth,
            normalized.sourceHeight,
            maximumWidth,
            maximumHeight,
            params.settings.imageFit !== 'actual'
          )
    const landscape = layout.pageWidthPoints > layout.pageHeightPoints

    sections.push({
      properties: {
        page: {
          size: {
            width: pointsToTwips(landscape ? layout.pageHeightPoints : layout.pageWidthPoints),
            height: pointsToTwips(landscape ? layout.pageWidthPoints : layout.pageHeightPoints),
            orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
          },
          margin: {
            top: pointsToTwips(layout.marginPoints),
            right: pointsToTwips(layout.marginPoints),
            bottom: pointsToTwips(layout.marginPoints),
            left: pointsToTwips(layout.marginPoints)
          }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new ImageRun({
              type: normalized.type,
              data: normalized.data,
              transformation: {
                width: Math.max(1, Math.round(displaySize.width)),
                height: Math.max(1, Math.round(displaySize.height))
              },
              altText: {
                name: descriptor.name,
                title: descriptor.name,
                description: 'Source image'
              }
            })
          ]
        })
      ]
    })
    params.onProgress('merge', 0.1 + ((index + 1) / params.images.length) * 0.75, index)
  }

  params.onProgress('write', 0.9, params.images.length - 1)
  const output = await Packer.toBuffer(new Document({ sections }))
  await writeFile(params.outputPath, output)
  params.onProgress('write', 1, params.images.length - 1)
  return sections.length
}
