import type {
  CompressJobEvent,
  CompressJobPhase,
  CompressJobStatus
} from '@shared/domain/compress-job'
import { create } from 'zustand'

type VideoCompressJobState = {
  status: CompressJobStatus
  jobId: string | null
  phase: CompressJobPhase | null
  progress: number
  logs: string[]
  commands: string[]
  errorMessage: string | null
  lastOutput: {
    inputPath: string
    outputPath: string
    inputBytes: number
    outputBytes: number
  } | null
  reset: () => void
  markQueued: (jobId: string) => void
  markCancelling: () => void
  applyEvent: (event: CompressJobEvent) => void
}

const initial = (): Pick<
  VideoCompressJobState,
  'status' | 'jobId' | 'phase' | 'progress' | 'logs' | 'commands' | 'errorMessage' | 'lastOutput'
> => ({
  status: 'idle',
  jobId: null,
  phase: null,
  progress: 0,
  logs: [],
  commands: [],
  errorMessage: null,
  lastOutput: null
})

export const useVideoCompressJobStore = create<VideoCompressJobState>((set, get) => ({
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
      lastOutput: null
    }),
  markCancelling: () => set({ status: 'cancelling' }),
  applyEvent: (event) => {
    const activeId = get().jobId

    if (event.type === 'item_started') {
      set({
        jobId: event.jobId,
        status: 'running',
        phase: 'encode',
        progress: 0,
        errorMessage: null,
        commands: [],
        logs: [`[compress] Tệp ${event.index + 1}/${event.total} (job ${event.jobId.slice(0, 8)}…)`]
      })
      return
    }

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
          lastOutput: {
            inputPath: event.inputPath,
            outputPath: event.outputPath,
            inputBytes: event.inputBytes,
            outputBytes: event.outputBytes
          }
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
      default:
        return
    }
  }
}))
