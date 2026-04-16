import { useVideoChromaJobStore } from '@/features/video-chroma/application/stores/video-chroma-job.store'
import type { VideoJobEvent, VideoJobPhase } from '@shared/domain/video-job'
import { create } from 'zustand'

export type ChromaEnhanceJobStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped'

type State = {
  status: ChromaEnhanceJobStatus
  progress: number
  phase: VideoJobPhase | null
  logs: string[]
  lastError: string | null
  everEnhance: boolean
  reset: () => void
  onVideoJobEvent: (event: VideoJobEvent) => void
}

const initial = (): Pick<
  State,
  'status' | 'progress' | 'phase' | 'logs' | 'lastError' | 'everEnhance'
> => ({
  status: 'idle',
  progress: 0,
  phase: null,
  logs: [],
  lastError: null,
  everEnhance: false
})

export const useVideoChromaEnhanceStore = create<State>((set, get) => ({
  ...initial(),
  reset: () => set(initial()),
  onVideoJobEvent: (event) => {
    const activeId = useVideoChromaJobStore.getState().jobId
    if (!activeId || event.jobId !== activeId) return

    switch (event.type) {
      case 'phase':
        if (event.phase === 'enhance') {
          set({ status: 'running', phase: 'enhance', lastError: null, everEnhance: true })
        }
        return
      case 'progress':
        if (event.phase === 'enhance') {
          set({ status: 'running', phase: 'enhance', progress: event.ratio, everEnhance: true })
        }
        return
      case 'log':
        if (event.line.startsWith('[enhance]')) {
          set((s) => ({ logs: [...s.logs, event.line].slice(-800), everEnhance: true }))
        }
        return
      case 'command':
        if (event.phase === 'enhance') {
          const line = [...event.args].join(' ')
          set((s) => ({
            logs: [...s.logs, `[enhance] # command\n${line}`].slice(-800),
            everEnhance: true
          }))
        }
        return
      case 'enhance_failed':
        set({ status: 'failed', lastError: event.message, progress: 0, everEnhance: true })
        return
      case 'completed': {
        const st = get()
        if (!st.everEnhance) {
          set({ status: 'skipped' })
          return
        }
        if (st.status === 'failed') return
        set({ status: 'completed', progress: 1, phase: null })
        return
      }
      case 'failed':
      case 'cancelled':
        set(initial())
        return
      default:
        return
    }
  }
}))
