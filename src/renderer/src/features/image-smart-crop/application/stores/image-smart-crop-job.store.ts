import type { ImageSmartCropJobEvent } from '@shared/domain/image-smart-crop'
import { create } from 'zustand'

export type ImageSmartCropJobStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

type State = {
  status: ImageSmartCropJobStatus
  jobId: string | null
  progress: number
  logs: string[]
  errorMessage: string | null
  lastOutputPath: string | null
  reset: () => void
  markQueued: (jobId: string) => void
  markCancelling: () => void
  applyEvent: (ev: ImageSmartCropJobEvent) => void
}

const initial = (): Pick<
  State,
  'status' | 'jobId' | 'progress' | 'logs' | 'errorMessage' | 'lastOutputPath'
> => ({
  status: 'idle',
  jobId: null,
  progress: 0,
  logs: [],
  errorMessage: null,
  lastOutputPath: null
})

export const useImageSmartCropJobStore = create<State>((set, get) => ({
  ...initial(),
  reset: () => set(initial()),
  markQueued: (jobId) =>
    set({
      jobId,
      status: 'queued',
      progress: 0,
      logs: [],
      errorMessage: null,
      lastOutputPath: null
    }),
  markCancelling: () => set({ status: 'cancelling' }),
  applyEvent: (ev) => {
    const active = get().jobId

    if (ev.type === 'item_started') {
      set({
        jobId: ev.jobId,
        status: 'running',
        progress: 0.05,
        errorMessage: null,
        logs: ['[smart-crop] Bắt đầu xuất tệp…']
      })
      return
    }

    if (!active || ev.jobId !== active) return

    switch (ev.type) {
      case 'log':
        set((s) => ({ logs: [...s.logs, ev.line].slice(-2000) }))
        return
      case 'progress':
        set({ progress: ev.progress, status: 'running' })
        return
      case 'completed':
        set({
          status: 'completed',
          progress: 1,
          lastOutputPath: ev.outputPath
        })
        return
      case 'failed':
        set({ status: 'failed', errorMessage: ev.message })
        return
      case 'cancelled':
        set({ status: 'cancelled' })
        return
      default:
        return
    }
  }
}))
