import type {
  ImageWatermarkBatchEvent,
  ImageWatermarkBatchSummary,
  ImageWatermarkBatchZipResult
} from '@shared/domain/image-watermark'
import { create } from 'zustand'

export type WatermarkItemStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'

export type WatermarkItemRuntime = {
  jobId: string
  localId: string
  inputPath: string
  outputPath: string
  status: WatermarkItemStatus
  progress: number
  errorMessage: string | null
}

type ImageWatermarkJobSlice = {
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  batchId: string | null
  total: number
  currentIndex: number
  items: Record<string, WatermarkItemRuntime>
  logs: string[]
  summary: ImageWatermarkBatchSummary | null
  zip: {
    status: 'idle' | 'running' | 'completed' | 'failed'
    result: ImageWatermarkBatchZipResult | null
    error: string | null
  }
}

type ImageWatermarkJobState = ImageWatermarkJobSlice & {
  reset: () => void
  bootstrapQueue: (rows: Array<{ localId: string; inputPath: string; outputPath: string }>) => {
    batchId: string
    jobIdByLocalId: Record<string, string>
  }
  applyEvent: (ev: ImageWatermarkBatchEvent) => void
}

function initialJobSlice(): ImageWatermarkJobSlice {
  return {
    status: 'idle',
    batchId: null,
    total: 0,
    currentIndex: -1,
    items: {},
    logs: [],
    summary: null,
    zip: { status: 'idle', result: null, error: null }
  }
}

export const useImageWatermarkJobStore = create<ImageWatermarkJobState>((set, get) => ({
  ...initialJobSlice(),
  reset: () => set(initialJobSlice()),
  bootstrapQueue: (rows) => {
    const batchId = crypto.randomUUID()
    const items: Record<string, WatermarkItemRuntime> = {}
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
      ...initialJobSlice(),
      status: 'queued',
      batchId,
      total: rows.length,
      currentIndex: -1,
      items,
      logs: [`[watermark] Đã xếp hàng ${rows.length} ảnh.`]
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
          logs: [`[watermark] Bắt đầu (${ev.total} ảnh).`]
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
            logs: [...s.logs, `[watermark] Lỗi: ${ev.message}`].slice(-4000)
          }
        })
        return
      case 'batch_cancelled':
        set({ status: 'cancelled' })
        return
      case 'batch_completed':
        set({
          status: ev.summary.failCount > 0 ? 'failed' : 'completed',
          summary: ev.summary,
          logs: [
            ...get().logs,
            `[watermark] Hoàn tất: ${ev.summary.successCount} thành công, ${ev.summary.failCount} lỗi.`
          ].slice(-4000)
        })
        return
      case 'zip_started':
        set((s) => ({
          ...s,
          zip: { status: 'running', result: null, error: null },
          logs: [...s.logs, '[watermark] Đang đóng gói ZIP…'].slice(-4000)
        }))
        return
      case 'zip_completed':
        set((s) => ({
          ...s,
          zip: { status: 'completed', result: ev.result, error: null },
          logs: [...s.logs, `[watermark] ZIP: ${ev.result.zipPath}`].slice(-4000)
        }))
        return
      case 'zip_failed':
        set((s) => ({
          ...s,
          zip: { status: 'failed', result: null, error: ev.message },
          logs: [...s.logs, `[watermark] ZIP lỗi: ${ev.message}`].slice(-4000)
        }))
        return
      default:
        return
    }
  }
}))
