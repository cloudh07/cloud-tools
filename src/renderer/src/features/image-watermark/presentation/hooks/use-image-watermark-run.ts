import {
  cancelImageWatermarkBatch,
  startImageWatermarkBatch
} from '@/features/image-watermark/application/start-image-watermark.use-case'
import { useImageWatermarkJobStore } from '@/features/image-watermark/application/stores/image-watermark-job.store'
import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'
import type { StartImageWatermarkBatchRequest } from '@shared/domain/image-watermark'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

export function useImageWatermarkRun(): {
  busy: boolean
  showProgressPercent: boolean
  progressPercent: number
  canStart: boolean
  runWatermark: () => Promise<void>
  cancelRun: () => void
} {
  const ui = useImageWatermarkUiStore()
  const job = useImageWatermarkJobStore()

  const zipBusy = job.zip.status === 'running'
  const busy = job.status === 'processing' || job.status === 'queued' || zipBusy
  const showProgressPercent = job.status === 'processing'

  const progressPercent = useMemo(() => {
    if (job.total <= 0) return 0
    let acc = 0
    for (const it of Object.values(job.items)) {
      acc += it.progress
    }
    return Math.min(100, Math.max(0, Math.round((acc / job.total) * 100)))
  }, [job.items, job.total])

  const canStart = useMemo(() => {
    if (busy) return false
    if (!ui.outputFolder?.trim()) return false
    if (ui.queue.length === 0) return false

    if (ui.sourceKind === 'image') {
      if (!ui.imageSource.logoPath.trim()) return false
    } else if (!ui.textSource.text.trim()) {
      return false
    }

    const rows = ui.processWholeQueue
      ? ui.queue
      : ui.queue.filter((q) => q.localId === ui.selectedLocalId)
    if (rows.length === 0) return false
    if (rows.some((r) => !r.outputPath?.trim())) return false
    return true
  }, [
    busy,
    ui.imageSource.logoPath,
    ui.outputFolder,
    ui.processWholeQueue,
    ui.queue,
    ui.selectedLocalId,
    ui.sourceKind,
    ui.textSource.text
  ])

  const runWatermark = useCallback(async () => {
    const act = useImageWatermarkUiStore.getState()
    const rows = act.processWholeQueue
      ? act.queue
      : act.queue.filter((q) => q.localId === act.selectedLocalId)

    if (rows.length === 0) {
      toast.error('Không có ảnh để xử lý.')
      return
    }
    if (rows.some((r) => !r.outputPath?.trim())) {
      toast.error('Thiếu đường dẫn đầu ra. Chọn thư mục đích.')
      return
    }

    const jobAct = useImageWatermarkJobStore.getState()
    jobAct.reset()
    const { batchId, jobIdByLocalId } = jobAct.bootstrapQueue(
      rows.map((r) => ({
        localId: r.localId,
        inputPath: r.inputPath,
        outputPath: r.outputPath
      }))
    )

    try {
      const payload: StartImageWatermarkBatchRequest = {
        batchId,
        spec: act.buildSpec(),
        options: {
          outputFormat: act.outputFormat,
          jpegQuality: act.jpegQuality,
          webpQuality: act.webpQuality,
          pngCompressionLevel: act.pngCompressionLevel,
          autoRename: act.autoRename,
          overwrite: act.overwrite,
          keepMetadata: act.keepMetadata
        },
        zipOutput: act.zipOutput,
        batchZipSourceFolderPath: act.batchZipSourceFolder,
        items: rows.map((r) => ({
          jobId: jobIdByLocalId[r.localId]!,
          inputPath: r.inputPath,
          outputPath: r.outputPath
        }))
      }
      await startImageWatermarkBatch(payload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể bắt đầu')
      useImageWatermarkJobStore.getState().reset()
    }
  }, [])

  const cancelRun = useCallback(() => {
    const id = useImageWatermarkJobStore.getState().batchId
    if (id) void cancelImageWatermarkBatch(id)
  }, [])

  return {
    busy,
    showProgressPercent,
    progressPercent,
    canStart,
    runWatermark,
    cancelRun
  }
}
