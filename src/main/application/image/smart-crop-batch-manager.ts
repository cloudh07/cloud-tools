import type { BrowserWindow } from 'electron'
import { existsSync } from 'fs'
import { dirname, join } from 'path'

import { parseStartImageSmartCropJobPayload } from '@main/application/security/image-smart-crop.validation'
import {
  validateExistingFilePath,
  validateSmartCropOutputPath
} from '@main/infrastructure/fs/path-validator'
import { buildBatchZipFileName } from '@main/infrastructure/zip/batch-zip-filename'
import { createZipFromFiles } from '@main/infrastructure/zip/create-zip'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type {
  ImageSmartCropBatchEvent,
  StartImageSmartCropBatchRequest
} from '@shared/domain/image-smart-crop-batch'
import {
  analyzeSmartCropImage,
  exportSmartCropImage
} from '@main/infrastructure/image/smart-crop-sharp-service'

type QueueEntry = { req: StartImageSmartCropBatchRequest }

export class SmartCropBatchManager {
  private readonly queue: QueueEntry[] = []
  private draining = false
  private activeController: AbortController | null = null
  private activeBatchId: string | null = null
  private readonly cancelledBatchIds = new Set<string>()

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: ImageSmartCropBatchEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.IMAGE_SMART_CROP_BATCH_EVENT, event)
  }

  cancel(batchId: string): void {
    if (this.activeBatchId === batchId && this.activeController) {
      this.activeController.abort()
      return
    }
    this.cancelledBatchIds.add(batchId)
  }

  enqueue(request: StartImageSmartCropBatchRequest): void {
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

  private async runBatch(req: StartImageSmartCropBatchRequest): Promise<void> {
    const controller = new AbortController()
    this.activeController = controller
    this.activeBatchId = req.batchId

    const success: string[] = []
    let failCount = 0

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
        this.emit({
          type: 'item_progress',
          batchId: req.batchId,
          jobId: it.jobId,
          ratio: 0.05,
          phase: 'probe'
        })

        try {
          const input = validateExistingFilePath(it.inputPath)
          validateSmartCropOutputPath(it.outputPath, req.outputFormat)

          this.emit({
            type: 'item_log',
            batchId: req.batchId,
            jobId: it.jobId,
            line: `[smart-crop] Analyze: ${input}`
          })
          this.emit({
            type: 'item_progress',
            batchId: req.batchId,
            jobId: it.jobId,
            ratio: 0.18,
            phase: 'analyze'
          })

          const analysis = await analyzeSmartCropImage({
            inputPath: input,
            sensitivity: req.sensitivity,
            paddingRatio: req.paddingRatio,
            aspectMode: req.aspectMode
          })

          this.emit({
            type: 'item_log',
            batchId: req.batchId,
            jobId: it.jobId,
            line: `[smart-crop] ${analysis.detail}`
          })
          this.emit({
            type: 'item_progress',
            batchId: req.batchId,
            jobId: it.jobId,
            ratio: 0.32,
            phase: 'export'
          })

          const out = await exportSmartCropImage(
            parseStartImageSmartCropJobPayload({
              jobId: it.jobId,
              inputPath: input,
              outputPath: it.outputPath,
              outputFormat: req.outputFormat,
              cropRect: analysis.cropRect,
              keepAlpha: req.keepAlpha,
              jpegQuality: 90,
              webpQuality: 85
            }),
            (line) => this.emit({ type: 'item_log', batchId: req.batchId, jobId: it.jobId, line }),
            controller.signal
          )

          success.push(out)
          this.emit({
            type: 'item_progress',
            batchId: req.batchId,
            jobId: it.jobId,
            ratio: 1,
            phase: 'export'
          })
          this.emit({
            type: 'item_completed',
            batchId: req.batchId,
            jobId: it.jobId,
            inputPath: input,
            outputPath: out
          })
        } catch (e) {
          failCount++
          const msg = e instanceof Error ? e.message : String(e)
          this.emit({ type: 'item_failed', batchId: req.batchId, jobId: it.jobId, message: msg })
          continue
        }
      }

      if (controller.signal.aborted || this.cancelledBatchIds.has(req.batchId)) {
        this.emit({ type: 'batch_cancelled', batchId: req.batchId })
        return
      }

      this.emit({
        type: 'batch_completed',
        batchId: req.batchId,
        successCount: success.length,
        failCount
      })

      if (req.zipOutput && success.length > 0) {
        this.emit({ type: 'zip_started', batchId: req.batchId })
        try {
          const zipFolder = dirname(success[0]!)
          const zipName = buildBatchZipFileName(req.batchZipSourceFolderPath)
          const zipPath = join(zipFolder, zipName)
          await createZipFromFiles({ zipPath, filePaths: success })
          if (!existsSync(zipPath)) throw new Error('Zip file was not created.')
          this.emit({
            type: 'zip_completed',
            batchId: req.batchId,
            result: { zipPath, outputCount: success.length, skippedCount: failCount }
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
