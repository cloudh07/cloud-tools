import {
  cancelImageFormatConvertBatch,
  startImageFormatConvertBatch
} from '@/features/image-format-convert/application/start-image-format-convert.use-case'
import { useImageFormatConvertJobStore } from '@/features/image-format-convert/application/stores/image-format-convert-job.store'
import { useImageFormatConvertUiStore } from '@/features/image-format-convert/application/stores/image-format-convert-ui.store'
import type { StartImageFormatConvertBatchRequest } from '@shared/domain/image-format-convert'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

export type ImageFormatConvertRunScope = 'single' | 'batch'

export function useImageFormatConvertRun(scope: ImageFormatConvertRunScope): {
  busy: boolean
  showProgressPercent: boolean
  progressPercent: number
  canStart: boolean
  runConvert: () => Promise<void>
  cancelRun: () => void
} {
  const ui = useImageFormatConvertUiStore()
  const job = useImageFormatConvertJobStore()

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
    if (!ui.outputFolder?.trim()) return false
    if (ui.queue.length === 0) return false
    if (busy) return false

    if (scope === 'single') {
      const row = ui.queue[0]
      if (!row?.outputPath?.trim()) return false
      return true
    }

    const rows = ui.convertWholeQueue
      ? ui.queue
      : ui.queue.filter((q) => q.localId === ui.selectedLocalId)
    if (rows.length === 0) return false
    if (rows.some((r) => !r.outputPath?.trim())) return false
    return true
  }, [busy, scope, ui.convertWholeQueue, ui.outputFolder, ui.queue, ui.selectedLocalId])

  const runConvert = useCallback(async () => {
    const act = useImageFormatConvertUiStore.getState()
    const rows =
      scope === 'single'
        ? act.queue[0]
          ? [act.queue[0]]
          : []
        : act.convertWholeQueue
          ? act.queue
          : act.queue.filter((q) => q.localId === act.selectedLocalId)

    if (rows.length === 0) {
      toast.error('Không có tệp để xử lý.')
      return
    }
    if (rows.some((r) => !r.outputPath?.trim())) {
      toast.error('Thiếu đường dẫn đầu ra. Chọn thư mục đích.')
      return
    }

    const jobAct = useImageFormatConvertJobStore.getState()
    jobAct.reset()
    const { batchId, jobIdByLocalId } = jobAct.bootstrapQueue(
      rows.map((r) => ({
        localId: r.localId,
        inputPath: r.inputPath,
        outputPath: r.outputPath
      }))
    )

    try {
      const payload: StartImageFormatConvertBatchRequest = {
        batchId,
        outputFormat: act.outputFormat,
        zipOutput: scope === 'batch' && act.zipOutput,
        batchZipSourceFolderPath: scope === 'batch' ? (act.batchZipSourceFolder ?? null) : null,
        options: {
          keepMetadata: act.keepMetadata,
          autoRename: act.autoRename,
          overwrite: act.overwrite,
          jpegQuality: act.jpegQuality,
          webpQuality: act.webpQuality,
          avifQuality: act.avifQuality,
          pngCompressionLevel: act.pngCompressionLevel
        },
        items: rows.map((r) => ({
          jobId: jobIdByLocalId[r.localId]!,
          inputPath: r.inputPath,
          outputPath: r.outputPath
        }))
      }
      await startImageFormatConvertBatch(payload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể bắt đầu')
      useImageFormatConvertJobStore.getState().reset()
    }
  }, [scope])

  const cancelRun = useCallback(() => {
    const id = useImageFormatConvertJobStore.getState().batchId
    if (id) void cancelImageFormatConvertBatch(id)
  }, [])

  return {
    busy,
    showProgressPercent,
    progressPercent,
    canStart,
    runConvert,
    cancelRun
  }
}
