import type { VideoFormatConvertJobEvent } from '@shared/domain/video-format-convert'
import { create } from 'zustand'

type VideoFormatConvertJobSlice = {
  jobId: string | null
  progress: number
  percent: number
  logs: string[]
  commands: string[]
  errorMessage: string | null
  outputPath: string | null
}

type VideoFormatConvertJobState = VideoFormatConvertJobSlice & {
  reset: () => void
  beginJob: (jobId: string) => void
  applyEvent: (event: VideoFormatConvertJobEvent) => void
}

function initialJobSlice(): VideoFormatConvertJobSlice {
  return {
    jobId: null,
    progress: 0,
    percent: 0,
    logs: [],
    commands: [],
    errorMessage: null,
    outputPath: null
  }
}

export const useVideoFormatConvertJobStore = create<VideoFormatConvertJobState>((set, get) => ({
  ...initialJobSlice(),
  reset: () => set(initialJobSlice()),
  beginJob: (jobId) =>
    set({
      ...initialJobSlice(),
      jobId
    }),
  applyEvent: (event) => {
    const active = get().jobId
    switch (event.type) {
      case 'log':
        if (!active || event.jobId !== active) return
        set((s) => ({ logs: [...s.logs, event.line].slice(-2000) }))
        return
      case 'progress':
        if (!active || event.jobId !== active) return
        set({
          progress: event.ratio,
          percent: event.percent
        })
        return
      case 'command':
        if (!active || event.jobId !== active) return
        set((s) => ({
          commands: [...s.commands, event.args.join(' ')].slice(-20)
        }))
        return
      case 'completed':
        if (!active || event.jobId !== active) return
        set({
          progress: 1,
          percent: 100,
          outputPath: event.outputPath
        })
        return
      case 'failed':
        if (!active || event.jobId !== active) return
        set({ errorMessage: event.message, progress: 0, percent: 0 })
        return
      case 'cancelled':
        if (!active || event.jobId !== active) return
        set({ progress: 0, percent: 0 })
        return
      default:
        return
    }
  }
}))
