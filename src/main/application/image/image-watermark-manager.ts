import type { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'

import { composeWatermarkOnImage } from '@main/infrastructure/image/image-watermark-sharp-service'
import { buildBatchZipFileName } from '@main/infrastructure/zip/batch-zip-filename'
import { createZipFromFiles } from '@main/infrastructure/zip/create-zip'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type {
  ImageWatermarkBatchEvent,
  StartImageWatermarkBatchRequest
} from '@shared/domain/image-watermark'

type QueueEntry = { req: StartImageWatermarkBatchRequest }

export class ImageWatermarkManager {
  private readonly queue: QueueEntry[] = []
  private draining = false
  private activeController: AbortController | null = null
  private activeBatchId: string | null = null
  private readonly cancelledBatchIds = new Set<string>()

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: ImageWatermarkBatchEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.IMAGE_WATERMARK_EVENT, event)
  }

  cancel(batchId: string): void {
    if (this.activeBatchId === batchId && this.activeController) {
      this.activeController.abort()
      return
    }
    this.cancelledBatchIds.add(batchId)
  }

  enqueue(request: StartImageWatermarkBatchRequest): void {
    this.queue.push({ req: request })
    if (!this.draining) void this.drain()
  }

  private async drain(): Promise<void> {
    this.draining = true
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift()
        if (!next) break
        if (this.cancelledBatchIds.has(next.req.batchId)) {
          this.cancelledBatchIds.delete(next.req.batchId)
          this.emit({ type: 'batch_cancelled', batchId: next.req.batchId })
          continue
        }
        await this.runBatch(next.req)
      }
    } finally {
      this.draining = false
    }
  }

  private async runBatch(req: StartImageWatermarkBatchRequest): Promise<void> {
    const controller = new AbortController()
    this.activeController = controller
    this.activeBatchId = req.batchId

    let successCount = 0
    let failCount = 0
    const successOutputPaths: string[] = []

    try {
      this.emit({ type: 'batch_started', batchId: req.batchId, total: req.items.length })

      for (let i = 0; i < req.items.length; i++) {
        const it = req.items[i]!
        if (controller.signal.aborted || this.cancelledBatchIds.has(req.batchId)) {
          this.emit({ type: 'batch_cancelled', batchId: req.batchId })
          return
        }

        this.emit({
          type: 'item_started',
          batchId: req.batchId,
          jobId: it.jobId,
          index: i,
          total: req.items.length
        })

        try {
          this.emit({
            type: 'item_progress',
            batchId: req.batchId,
            jobId: it.jobId,
            ratio: 0.08,
            phase: 'probe'
          })
          this.emit({
            type: 'item_log',
            batchId: req.batchId,
            jobId: it.jobId,
            line: `[watermark] ${it.inputPath} -> ${it.outputPath}`
          })

          this.emit({
            type: 'item_progress',
            batchId: req.batchId,
            jobId: it.jobId,
            ratio: 0.4,
            phase: 'compose'
          })

          await composeWatermarkOnImage({
            inputPath: it.inputPath,
            outputPath: it.outputPath,
            spec: req.spec,
            outputFormat: req.options.outputFormat,
            jpegQuality: req.options.jpegQuality,
            webpQuality: req.options.webpQuality,
            pngCompressionLevel: req.options.pngCompressionLevel,
            keepMetadata: req.options.keepMetadata,
            overwrite: req.options.overwrite,
            signal: controller.signal
          })

          this.emit({
            type: 'item_progress',
            batchId: req.batchId,
            jobId: it.jobId,
            ratio: 1,
            phase: 'write'
          })
          successCount++
          successOutputPaths.push(it.outputPath)
          this.emit({
            type: 'item_completed',
            batchId: req.batchId,
            jobId: it.jobId,
            inputPath: it.inputPath,
            outputPath: it.outputPath
          })
        } catch (e) {
          failCount++
          const msg = e instanceof Error ? e.message : String(e)
          this.emit({
            type: 'item_failed',
            batchId: req.batchId,
            jobId: it.jobId,
            message: msg
          })
        }
      }

      if (controller.signal.aborted || this.cancelledBatchIds.has(req.batchId)) {
        this.emit({ type: 'batch_cancelled', batchId: req.batchId })
        return
      }

      this.emit({
        type: 'batch_completed',
        batchId: req.batchId,
        summary: { successCount, failCount }
      })

      if (req.zipOutput && successOutputPaths.length > 0) {
        this.emit({ type: 'zip_started', batchId: req.batchId })
        try {
          const zipFolder = dirname(successOutputPaths[0]!)
          const zipName = buildBatchZipFileName(req.batchZipSourceFolderPath)
          const zipPath = join(zipFolder, zipName)
          await createZipFromFiles({ zipPath, filePaths: successOutputPaths })
          if (!existsSync(zipPath)) throw new Error('Zip file was not created.')
          this.emit({
            type: 'zip_completed',
            batchId: req.batchId,
            result: {
              zipPath,
              outputCount: successOutputPaths.length,
              skippedCount: failCount
            }
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          this.emit({ type: 'zip_failed', batchId: req.batchId, message: msg })
        }
      }
    } finally {
      this.cancelledBatchIds.delete(req.batchId)
      this.activeController = null
      this.activeBatchId = null
    }
  }
}
