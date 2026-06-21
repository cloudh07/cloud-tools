import type { BrowserWindow } from 'electron'
import { rename, rm, stat } from 'fs/promises'
import type { Worker } from 'node:worker_threads'

import createDocumentMergeWorker from './image-document-merge.worker?nodeWorker'

import { inspectDocumentImages } from '@main/infrastructure/document/document-image-inspector'
import { inspectDocumentPdf } from '@main/infrastructure/document/document-pdf-inspector'
import {
  buildTemporaryDocumentOutputPath,
  validateDocumentOutputPath
} from '@main/infrastructure/document/document-output-path'
import { IpcChannels } from '@shared/constants/ipc-channels'
import { DOCUMENT_MERGE_LIMITS } from '@shared/domain/image-document-merge'
import type {
  DocumentOutputFormat,
  DocumentMergeEvent,
  DocumentMergeWorkerMessage,
  DocumentMergeWorkerRequest,
  StartDocumentMergeRequest
} from '@shared/domain/image-document-merge'

type ActiveJob = {
  jobId: string
  outputPath: string
  temporaryOutputPath: string
  worker: Worker
  outputFormat: DocumentOutputFormat
  settled: boolean
}

export class ImageDocumentMergeManager {
  private activeJob: ActiveJob | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: DocumentMergeEvent): void {
    const window = this.getWindow()
    if (!window || window.isDestroyed()) return
    window.webContents.send(IpcChannels.IMAGE_DOCUMENT_MERGE_EVENT, event)
  }

  async start(request: StartDocumentMergeRequest): Promise<void> {
    if (this.activeJob) throw new Error('Another document export is already running.')

    this.emit({ type: 'started', jobId: request.jobId, totalImages: request.imagePaths.length })
    this.emit({
      type: 'progress',
      jobId: request.jobId,
      phase: 'validate',
      ratio: 0.01,
      currentIndex: 0,
      totalImages: request.imagePaths.length
    })

    const outputPath = validateDocumentOutputPath(
      request.outputPath,
      request.outputFormat,
      request.basePdfPath
    )
    const inspection = await inspectDocumentImages(request.imagePaths)
    if (
      inspection.rejected.length > 0 ||
      inspection.accepted.length !== request.imagePaths.length
    ) {
      throw new Error(inspection.rejected[0]?.message ?? 'One or more images are invalid.')
    }
    if (request.basePdfPath) await inspectDocumentPdf(request.basePdfPath)

    const temporaryOutputPath = buildTemporaryDocumentOutputPath(outputPath, request.jobId)
    await rm(temporaryOutputPath, { force: true })
    const workerRequest: DocumentMergeWorkerRequest = {
      ...request,
      outputPath,
      temporaryOutputPath
    }
    const worker = createDocumentMergeWorker({ workerData: workerRequest })
    const active: ActiveJob = {
      jobId: request.jobId,
      outputPath,
      temporaryOutputPath,
      worker,
      outputFormat: request.outputFormat,
      settled: false
    }
    this.activeJob = active

    worker.on('message', (message: DocumentMergeWorkerMessage) => {
      void this.handleWorkerMessage(active, message)
    })
    worker.on('error', (error) => {
      void this.failActiveJob(active, error instanceof Error ? error.message : String(error))
    })
    worker.on('exit', (code) => {
      if (!active.settled && code !== 0) {
        void this.failActiveJob(active, `Document worker stopped with exit code ${code}.`)
      }
    })
  }

  async cancel(jobId: string): Promise<void> {
    const active = this.activeJob
    if (!active || active.jobId !== jobId) return
    active.settled = true
    await active.worker.terminate()
    await rm(active.temporaryOutputPath, { force: true })
    if (this.activeJob === active) this.activeJob = null
    this.emit({ type: 'cancelled', jobId })
  }

  private async handleWorkerMessage(
    active: ActiveJob,
    message: DocumentMergeWorkerMessage
  ): Promise<void> {
    if (active.settled || this.activeJob !== active) return
    if (message.type === 'progress') {
      this.emit({ ...message, type: 'progress', jobId: active.jobId })
      return
    }
    if (message.type === 'failed') {
      await this.failActiveJob(active, message.message)
      return
    }

    active.settled = true
    try {
      const outputSizeBytes = (await stat(active.temporaryOutputPath)).size
      if (
        active.outputFormat === 'pdf' &&
        outputSizeBytes >= DOCUMENT_MERGE_LIMITS.maxOutputPdfBytes
      ) {
        throw new Error('The generated PDF exceeds the strict 10 MB output limit.')
      }
      await rm(active.outputPath, { force: true })
      await rename(active.temporaryOutputPath, active.outputPath)
      this.emit({
        type: 'completed',
        jobId: active.jobId,
        outputPath: active.outputPath,
        pageCount: message.pageCount,
        outputSizeBytes,
        blankPagesFilled: message.blankPagesFilled,
        blankPagesRemoved: message.blankPagesRemoved
      })
    } catch (error) {
      await rm(active.temporaryOutputPath, { force: true })
      this.emit({
        type: 'failed',
        jobId: active.jobId,
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      if (this.activeJob === active) this.activeJob = null
    }
  }

  private async failActiveJob(active: ActiveJob, message: string): Promise<void> {
    if (active.settled) return
    active.settled = true
    await rm(active.temporaryOutputPath, { force: true })
    if (this.activeJob === active) this.activeJob = null
    this.emit({ type: 'failed', jobId: active.jobId, message })
  }
}
