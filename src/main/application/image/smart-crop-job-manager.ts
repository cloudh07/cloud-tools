import type { BrowserWindow } from 'electron'

import { exportSmartCropImage } from '@main/infrastructure/image/smart-crop-sharp-service'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type {
  ImageSmartCropJobEvent,
  StartImageSmartCropJobRequest
} from '@shared/domain/image-smart-crop'

type Active = { controller: AbortController }

export class SmartCropJobManager {
  private readonly jobs = new Map<string, Active>()

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: ImageSmartCropJobEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.IMAGE_SMART_CROP_JOB_EVENT, event)
  }

  cancel(jobId: string): void {
    const j = this.jobs.get(jobId)
    if (j) j.controller.abort()
  }

  async start(request: StartImageSmartCropJobRequest): Promise<void> {
    if (this.jobs.has(request.jobId)) {
      this.emit({ type: 'failed', jobId: request.jobId, message: 'Job id already active' })
      return
    }
    const controller = new AbortController()
    this.jobs.set(request.jobId, { controller })
    const finish = (): void => {
      this.jobs.delete(request.jobId)
    }

    try {
      this.emit({ type: 'item_started', jobId: request.jobId })
      this.emit({ type: 'progress', jobId: request.jobId, progress: 0.08 })
      const r = request.cropRect
      this.emit({
        type: 'log',
        jobId: request.jobId,
        line: `[smart-crop] Crop từ UI (khớp preview): ${Math.round(r.width)}×${Math.round(r.height)} @ (${Math.round(r.x)},${Math.round(r.y)})`
      })
      this.emit({ type: 'log', jobId: request.jobId, line: 'Starting Sharp export…' })

      const out = await exportSmartCropImage(
        request,
        (line) => {
          this.emit({ type: 'log', jobId: request.jobId, line })
        },
        controller.signal
      )

      this.emit({ type: 'progress', jobId: request.jobId, progress: 1 })
      this.emit({ type: 'completed', jobId: request.jobId, outputPath: out })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg === 'Aborted') {
        this.emit({ type: 'cancelled', jobId: request.jobId })
      } else {
        this.emit({ type: 'failed', jobId: request.jobId, message: msg })
      }
    } finally {
      finish()
    }
  }
}
