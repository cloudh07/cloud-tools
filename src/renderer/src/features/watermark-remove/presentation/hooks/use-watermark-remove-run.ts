import {
  cancelWatermarkRemoveBatch,
  startWatermarkRemoveBatch
} from '@/features/watermark-remove/application/start-watermark-remove.use-case'
import { useWatermarkRemoveJobStore } from '@/features/watermark-remove/application/stores/watermark-remove-job.store'
import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import type { StartWatermarkRemoveBatchRequest } from '@shared/domain/watermark-remove'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

export function useWatermarkRemoveRun(): {
  busy: boolean
  showProgressPercent: boolean
  progressPercent: number
  canStart: boolean
  runRemoval: () => Promise<void>
  cancelRun: () => void
} {
  const ui = useWatermarkRemoveUiStore()
  const job = useWatermarkRemoveJobStore()

  const busy = job.status === 'processing' || job.status === 'queued'
  const showProgressPercent = job.status === 'processing'

  const progressPercent = useMemo(() => {
    if (job.total <= 0) return 0
    let acc = 0
    for (const it of Object.values(job.items)) acc += it.progress
    return Math.min(100, Math.max(0, Math.round((acc / job.total) * 100)))
  }, [job.items, job.total])

  const canStart = useMemo(() => {
    if (busy) return false
    if (!ui.outputFolder?.trim()) return false
    if (ui.queue.length === 0) return false
    if (!ui.keyframes.some((k) => k.shapes.length > 0)) return false
    if (ui.queue.some((r) => !r.outputPath?.trim())) return false
    return true
  }, [busy, ui.keyframes, ui.outputFolder, ui.queue])

  const runRemoval = useCallback(async () => {
    const act = useWatermarkRemoveUiStore.getState()
    const rows = act.queue
    if (rows.length === 0) {
      toast.error('Không có media để xử lý.')
      return
    }
    if (rows.some((r) => !r.outputPath?.trim())) {
      toast.error('Thiếu đường dẫn đầu ra. Chọn thư mục đích.')
      return
    }
    if (!act.keyframes.some((k) => k.shapes.length > 0)) {
      toast.error('Cần vẽ mask trước khi chạy.')
      return
    }

    const jobAct = useWatermarkRemoveJobStore.getState()
    jobAct.reset()
    const { batchId, jobIdByLocalId } = jobAct.bootstrapQueue(
      rows.map((r) => ({
        localId: r.localId,
        inputPath: r.inputPath,
        outputPath: r.outputPath
      }))
    )

    try {
      const payload: StartWatermarkRemoveBatchRequest = {
        batchId,
        spec: act.buildSpec(),
        imageOptions: act.imageOptions,
        videoOptions: act.videoOptions,
        items: rows.map((r) => ({
          jobId: jobIdByLocalId[r.localId]!,
          inputPath: r.inputPath,
          outputPath: r.outputPath
        }))
      }
      await startWatermarkRemoveBatch(payload)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể bắt đầu')
      useWatermarkRemoveJobStore.getState().reset()
    }
  }, [])

  const cancelRun = useCallback(() => {
    const id = useWatermarkRemoveJobStore.getState().batchId
    if (id) void cancelWatermarkRemoveBatch(id)
  }, [])

  return {
    busy,
    showProgressPercent,
    progressPercent,
    canStart,
    runRemoval,
    cancelRun
  }
}
