import type {
  AudioExtractJobEvent,
  AudioExtractJobPhase,
  AudioExtractJobStatus
} from '@shared/domain/audio-extract-job'
import { create } from 'zustand'

type AudioExtractJobState = {
  status: AudioExtractJobStatus
  jobId: string | null
  phase: AudioExtractJobPhase | null
  progress: number
  logs: string[]
  commands: string[]
  errorMessage: string | null
  lastOutput: {
    inputPath: string
    outputPath: string
    inputBytes: number
    outputBytes: number
    usedCopy: boolean
  } | null
  reset: () => void
  markCancelling: () => void
  applyEvent: (event: AudioExtractJobEvent) => void
}

const initial = (): Pick<
  AudioExtractJobState,
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

export const useAudioExtractJobStore = create<AudioExtractJobState>((set, get) => ({
  ...initial(),
  reset: () => set(initial()),
  markCancelling: () => set({ status: 'cancelling' }),
  applyEvent: (event) => {
    const activeId = get().jobId

    if (event.type === 'item_started') {
      set({
        jobId: event.jobId,
        status: 'running',
        phase: 'extract',
        progress: 0,
        errorMessage: null,
        commands: [],
        logs: [`[audio] Tệp ${event.index + 1}/${event.total} (job ${event.jobId.slice(0, 8)}…)`]
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
            outputBytes: event.outputBytes,
            usedCopy: event.usedCopy
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
