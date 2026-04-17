import { create } from 'zustand'

import type {
  WatermarkRemoveBatchEvent,
  WatermarkRemoveBatchSummary
} from '@shared/domain/watermark-remove'

export type WatermarkRemoveItemStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type WatermarkRemovePhase = 'probe' | 'inpaint' | 'encode' | 'mux' | null

export type WatermarkRemoveItemRuntime = {
  jobId: string
  localId: string
  inputPath: string
  outputPath: string
  status: WatermarkRemoveItemStatus
  progress: number
  phase: WatermarkRemovePhase
  currentFrame: number | null
  totalFrames: number | null
  errorMessage: string | null
}

type Slice = {
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  batchId: string | null
  total: number
  currentIndex: number
  items: Record<string, WatermarkRemoveItemRuntime>
  logs: string[]
  summary: WatermarkRemoveBatchSummary | null
}

type State = Slice & {
  reset: () => void
  bootstrapQueue: (rows: Array<{ localId: string; inputPath: string; outputPath: string }>) => {
    batchId: string
    jobIdByLocalId: Record<string, string>
  }
  applyEvent: (ev: WatermarkRemoveBatchEvent) => void
}

function initialSlice(): Slice {
  return {
    status: 'idle',
    batchId: null,
    total: 0,
    currentIndex: -1,
    items: {},
    logs: [],
    summary: null
  }
}

export const useWatermarkRemoveJobStore = create<State>((set, get) => ({
  ...initialSlice(),
  reset: () => set(initialSlice()),
  bootstrapQueue: (rows) => {
    const batchId = crypto.randomUUID()
    const items: Record<string, WatermarkRemoveItemRuntime> = {}
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
        phase: null,
        currentFrame: null,
        totalFrames: null,
        errorMessage: null
      }
    }
    set({
      ...initialSlice(),
      status: 'queued',
      batchId,
      total: rows.length,
      currentIndex: -1,
      items,
      logs: [`[watermark-remove] Đã xếp hàng ${rows.length} mục.`]
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
          logs: [`[watermark-remove] Bắt đầu (${ev.total} mục).`]
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
            items: {
              ...s.items,
              [ev.jobId]: { ...it, status: 'processing', progress: 0, phase: 'probe' }
            }
          }
        })
        return
      case 'item_progress':
        set((s) => {
          const it = s.items[ev.jobId]
          if (!it) return s
          return {
            ...s,
            items: {
              ...s.items,
              [ev.jobId]: {
                ...it,
                progress: ev.ratio,
                phase: ev.phase,
                currentFrame: ev.currentFrame ?? it.currentFrame,
                totalFrames: ev.totalFrames ?? it.totalFrames
              }
            }
          }
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
              [ev.jobId]: {
                ...it,
                status: 'completed',
                progress: 1,
                phase: null,
                outputPath: ev.outputPath
              }
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
                phase: null
              }
            },
            logs: [...s.logs, `[watermark-remove] Lỗi: ${ev.message}`].slice(-4000)
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
            `[watermark-remove] Hoàn tất: ${ev.summary.successCount} thành công, ${ev.summary.failCount} lỗi.`
          ].slice(-4000)
        })
        return
      default:
        return
    }
  }
}))
