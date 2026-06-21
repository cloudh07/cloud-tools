import { rm, stat } from 'fs/promises'
import { parentPort, workerData } from 'node:worker_threads'

import type {
  DocumentMergeWorkerMessage,
  DocumentMergeWorkerRequest
} from '@shared/domain/image-document-merge'
import { inspectDocumentImages } from '@main/infrastructure/document/document-image-inspector'
import { inspectDocumentPdf } from '@main/infrastructure/document/document-pdf-inspector'
import { writeDocxDocument } from '@main/infrastructure/document/docx-document-writer'
import { writePdfDocument } from '@main/infrastructure/document/pdf-document-writer'

const request = workerData as DocumentMergeWorkerRequest

function emit(message: DocumentMergeWorkerMessage): void {
  parentPort?.postMessage(message)
}

async function run(): Promise<void> {
  try {
    emit({
      type: 'progress',
      phase: 'inspect',
      ratio: 0.02,
      currentIndex: 0,
      totalImages: request.imagePaths.length
    })
    const inspection = await inspectDocumentImages(request.imagePaths)
    if (
      inspection.rejected.length > 0 ||
      inspection.accepted.length !== request.imagePaths.length
    ) {
      throw new Error(inspection.rejected[0]?.message ?? 'One or more images are no longer valid.')
    }
    if (request.basePdfPath) await inspectDocumentPdf(request.basePdfPath)

    const onProgress = (
      phase: Extract<DocumentMergeWorkerMessage, { type: 'progress' }>['phase'],
      ratio: number,
      currentIndex: number
    ): void => {
      emit({
        type: 'progress',
        phase,
        ratio,
        currentIndex,
        totalImages: request.imagePaths.length
      })
    }

    if (request.outputFormat === 'pdf') {
      const result = await writePdfDocument({
        basePdfPath: request.basePdfPath,
        outputPath: request.temporaryOutputPath,
        images: inspection.accepted,
        settings: request.settings,
        blankPageHandling: request.blankPageHandling,
        onProgress
      })
      emit({ type: 'completed', ...result })
      return
    }

    const pageCount = await writeDocxDocument({
      outputPath: request.temporaryOutputPath,
      images: inspection.accepted,
      settings: request.settings,
      onProgress
    })
    const outputSizeBytes = (await stat(request.temporaryOutputPath)).size
    emit({
      type: 'completed',
      pageCount,
      outputSizeBytes,
      blankPagesFilled: 0,
      blankPagesRemoved: 0
    })
  } catch (error) {
    await rm(request.temporaryOutputPath, { force: true }).catch(() => undefined)
    emit({ type: 'failed', message: error instanceof Error ? error.message : String(error) })
  }
}

void run()
