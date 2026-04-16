import type { VideoJobEvent, VideoJobPhase, VideoJobStatus } from '@shared/domain/video-job'
import type { VideoOutputMode } from '@shared/domain/video-output-mode'
import { create } from 'zustand'

type VideoChromaJobState = {
  status: VideoJobStatus
  jobId: string | null
  phase: VideoJobPhase | null
  progress: number
  logs: string[]
  commands: string[]
  errorMessage: string | null
  outputs: { video?: string; webp?: string }
  completedMode: VideoOutputMode | null
  reset: () => void
  markQueued: (jobId: string) => void
  markCancelling: () => void
  applyEvent: (event: VideoJobEvent) => void
}

const initial = (): Pick<
  VideoChromaJobState,
  | 'status'
  | 'jobId'
  | 'phase'
  | 'progress'
  | 'logs'
  | 'commands'
  | 'errorMessage'
  | 'outputs'
  | 'completedMode'
> => ({
  status: 'idle',
  jobId: null,
  phase: null,
  progress: 0,
  logs: [],
  commands: [],
  errorMessage: null,
  outputs: {},
  completedMode: null
})

export const useVideoChromaJobStore = create<VideoChromaJobState>((set, get) => ({
  ...initial(),
  reset: () => set(initial()),
  markQueued: (jobId) =>
    set({
      jobId,
      status: 'queued',
      phase: null,
      progress: 0,
      logs: [],
      commands: [],
      errorMessage: null,
      outputs: {},
      completedMode: null
    }),
  markCancelling: () => set({ status: 'cancelling' }),
  applyEvent: (event) => {
    const activeId = get().jobId
    if (!activeId || event.jobId !== activeId) return

    switch (event.type) {
      case 'log':
        set((s) => ({ logs: [...s.logs, event.line].slice(-2000) }))
        return
      case 'progress':
        set({
          status: 'running',
          phase: event.phase,
          progress: event.ratio
        })
        return
      case 'phase':
        set({ phase: event.phase, status: 'running' })
        return
      case 'command': {
        const line = [...event.args].join(' ')
        set((s) => ({ commands: [...s.commands, `# ${event.phase}\n${line}`] }))
        return
      }
      case 'completed':
        set({
          status: 'completed',
          progress: 1,
          outputs: event.outputs,
          completedMode: event.mode
        })
        return
      case 'failed':
        set({
          status: 'failed',
          errorMessage: event.message
        })
        return
      case 'cancelled':
        set({ status: 'cancelled' })
        return
      case 'enhance_failed':
        set((s) => ({
          logs: [...s.logs, `[enhance] Thất bại (giữ bản chroma gốc): ${event.message}`].slice(
            -2000
          )
        }))
        return
      default:
        return
    }
  }
}))
