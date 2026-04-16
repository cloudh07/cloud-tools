import type {
  ImageSmartCropBatchEvent,
  SmartCropBatchZipResult
} from '@shared/domain/image-smart-crop-batch'
import { create } from 'zustand'

export type BatchItemStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type BatchItemRuntime = {
  jobId: string
  localId: string
  inputPath: string
  outputPath: string
  status: BatchItemStatus
  progress: number
  errorMessage: string | null
}

type State = {
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  batchId: string | null
  total: number
  currentIndex: number
  items: Record<string, BatchItemRuntime>
  logs: string[]
  zip: {
    status: 'idle' | 'running' | 'completed' | 'failed'
    result: SmartCropBatchZipResult | null
    error: string | null
  }
  reset: () => void
  bootstrapQueue: (rows: Array<{ localId: string; inputPath: string; outputPath: string }>) => {
    batchId: string
    jobIdByLocalId: Record<string, string>
  }
  applyEvent: (ev: ImageSmartCropBatchEvent) => void
}

const initial = (): Pick<
  State,
  'status' | 'batchId' | 'total' | 'currentIndex' | 'items' | 'logs' | 'zip'
> => ({
  status: 'idle',
  batchId: null,
  total: 0,
  currentIndex: -1,
  items: {},
  logs: [],
  zip: { status: 'idle', result: null, error: null }
})

export const useImageSmartCropBatchJobStore = create<State>((set, get) => ({
  ...initial(),
  reset: () => set(initial()),
  bootstrapQueue: (rows) => {
    const batchId = crypto.randomUUID()
    const items: Record<string, BatchItemRuntime> = {}
    const jobIdByLocalId: Record<string, string> = {}
    for (const r of rows) {
      const jobId = crypto.randomUUID()
      jobIdByLocalId[r.localId] = jobId
      items[jobId] = {
        jobId,
        localId: r.localId,
        inputPath: r.inputPath,
        outputPath: r.outputPath,
        status: 'queued',
        progress: 0,
        errorMessage: null
      }
    }
    set({
      ...initial(),
      status: 'queued',
      batchId,
      total: rows.length,
      currentIndex: -1,
      items,
      logs: [`[smart-crop-batch] Queued ${rows.length} item(s).`]
    })
    return { batchId, jobIdByLocalId }
  },
  applyEvent: (ev) => {
    const active = get().batchId
    if (active && ev.batchId !== active) return

    switch (ev.type) {
      case 'batch_started':
        set({
          status: 'processing',
          total: ev.total,
          logs: [`[smart-crop-batch] Started (${ev.total} item(s)).`]
        })
        return
      case 'item_started':
        set((s) => {
          const it = s.items[ev.jobId]
          if (!it) return s
          return {
            ...s,
            status: 'processing',
            currentIndex: ev.index,
            items: { ...s.items, [ev.jobId]: { ...it, status: 'processing', progress: 0 } }
          }
        })
        return
      case 'item_progress':
        set((s) => {
          const it = s.items[ev.jobId]
          if (!it) return s
          return { ...s, items: { ...s.items, [ev.jobId]: { ...it, progress: ev.ratio } } }
        })
        return
      case 'item_log':
        set((s) => ({ ...s, logs: [...s.logs, ev.line].slice(-4000) }))
        return
      case 'item_completed':
        set((s) => {
          const it = s.items[ev.jobId]
          if (!it) return s
          return {
            ...s,
            items: {
              ...s.items,
              [ev.jobId]: { ...it, status: 'completed', progress: 1, outputPath: ev.outputPath }
            }
          }
        })
        return
      case 'item_failed':
        set((s) => {
          const it = s.items[ev.jobId]
          if (!it) return s
          return {
            ...s,
            items: {
              ...s.items,
              [ev.jobId]: {
                ...it,
                status: 'failed',
                errorMessage: ev.message,
                progress: it.progress
              }
            },
            logs: [...s.logs, `[smart-crop-batch] failed: ${ev.message}`].slice(-4000)
          }
        })
        return
      case 'batch_cancelled':
        set({ status: 'cancelled' })
        return
      case 'batch_completed':
        set({
          status: ev.failCount > 0 ? 'failed' : 'completed',
          logs: [
            ...get().logs,
            `[smart-crop-batch] Done: ${ev.successCount} ok, ${ev.failCount} failed.`
          ].slice(-4000)
        })
        return
      case 'zip_started':
        set((s) => ({ ...s, zip: { status: 'running', result: null, error: null } }))
        return
      case 'zip_completed':
        set((s) => ({ ...s, zip: { status: 'completed', result: ev.result, error: null } }))
        return
      case 'zip_failed':
        set((s) => ({ ...s, zip: { status: 'failed', result: null, error: ev.message } }))
        return
      default:
        return
    }
  }
}))
