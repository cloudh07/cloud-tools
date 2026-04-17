import type { BrowserWindow } from 'electron'

import { runImageInpaint } from '@main/infrastructure/watermark-remove/image-inpaint-pipeline'
import { clearMaskRasterCache } from '@main/infrastructure/watermark-remove/mask-interpolator'
import { runVideoInpaint } from '@main/infrastructure/watermark-remove/video-frame-pipeline'
import { probeWatermarkRemoveMedia } from '@main/infrastructure/watermark-remove/watermark-remove-probe'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  StartWatermarkRemoveBatchRequest,
  WatermarkRemoveBatchEvent
} from '@shared/domain/watermark-remove'

type QueueEntry = { req: StartWatermarkRemoveBatchRequest; cfg: AppConfig }

export class WatermarkRemoveManager {
  private readonly queue: QueueEntry[] = []
  private draining = false
  private activeController: AbortController | null = null
  private activeBatchId: string | null = null
  private readonly cancelledBatchIds = new Set<string>()

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  enqueue(cfg: AppConfig, request: StartWatermarkRemoveBatchRequest): void {
    this.queue.push({ req: request, cfg })
    if (!this.draining) void this.drain()
  }

  cancel(batchId: string): void {
    if (this.activeBatchId === batchId && this.activeController) {
      this.activeController.abort()
      return
    }
    this.cancelledBatchIds.add(batchId)
  }

  private emit(event: WatermarkRemoveBatchEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.WATERMARK_REMOVE_EVENT, event)
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
        await this.runBatch(next.cfg, next.req)
      }
    } finally {
      this.draining = false
    }
  }

  private async runBatch(cfg: AppConfig, req: StartWatermarkRemoveBatchRequest): Promise<void> {
    const controller = new AbortController()
    this.activeController = controller
    this.activeBatchId = req.batchId

    let successCount = 0
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

        try {
          await this.runItem(cfg, req, it.jobId, it.inputPath, it.outputPath, controller.signal)
          this.emit({
            type: 'item_completed',
            batchId: req.batchId,
            jobId: it.jobId,
            inputPath: it.inputPath,
            outputPath: it.outputPath
          })
          successCount++
        } catch (err) {
          if (controller.signal.aborted) {
            this.emit({ type: 'batch_cancelled', batchId: req.batchId })
            return
          }
          failCount++
          const message = err instanceof Error ? err.message : String(err)
          this.emit({
            type: 'item_failed',
            batchId: req.batchId,
            jobId: it.jobId,
            message
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
    } finally {
      this.cancelledBatchIds.delete(req.batchId)
      this.activeController = null
      this.activeBatchId = null
      clearMaskRasterCache()
    }
  }

  private async runItem(
    cfg: AppConfig,
    req: StartWatermarkRemoveBatchRequest,
    jobId: string,
    inputPath: string,
    outputPath: string,
    signal: AbortSignal
  ): Promise<void> {
    this.emit({
      type: 'item_progress',
      batchId: req.batchId,
      jobId,
      ratio: 0.05,
      phase: 'probe'
    })
    const probe = await probeWatermarkRemoveMedia(cfg, inputPath)
    this.emit({
      type: 'item_log',
      batchId: req.batchId,
      jobId,
      line: `[probe] ${probe.mediaKind} ${probe.width}x${probe.height}`
    })
    if (probe.mediaKind === 'image') {
      this.emit({
        type: 'item_progress',
        batchId: req.batchId,
        jobId,
        ratio: 0.4,
        phase: 'inpaint'
      })
      await runImageInpaint({
        inputPath,
        outputPath,
        spec: req.spec,
        options: req.imageOptions
      })
      this.emit({
        type: 'item_progress',
        batchId: req.batchId,
        jobId,
        ratio: 1,
        phase: 'encode'
      })
      return
    }

    await runVideoInpaint({
      cfg,
      inputPath,
      outputPath,
      spec: req.spec,
      options: req.videoOptions,
      durationSec: probe.durationSec,
      fps: probe.fps,
      signal,
      onProgress: (payload) => {
        this.emit({
          type: 'item_progress',
          batchId: req.batchId,
          jobId,
          ratio: payload.ratio,
          phase: payload.phase,
          currentFrame: payload.currentFrame,
          totalFrames: payload.totalFrames
        })
      },
      onLog: (line) => {
        this.emit({ type: 'item_log', batchId: req.batchId, jobId, line })
      }
    })
  }
}
