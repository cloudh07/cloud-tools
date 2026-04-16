import type {
  VideoFormatConvertProbeResult,
  VideoFormatConvertJobStatus,
  VideoFormatTarget
} from '@shared/domain/video-format-convert'
import { VIDEO_FORMAT_TARGETS } from '@shared/domain/video-format-convert'
import { create } from 'zustand'

const defaultFormat: VideoFormatTarget = 'mp4'

type VideoFormatConvertUiSlice = {
  flowStatus: VideoFormatConvertJobStatus
  inputPath: string | null
  outputFormat: VideoFormatTarget
  outputPath: string | null
  probe: VideoFormatConvertProbeResult | null
  probeError: string | null
  planError: string | null
  previewCommand: string | null
}

type VideoFormatConvertUiState = VideoFormatConvertUiSlice & {
  reset: () => void
  setInputPath: (path: string | null) => void
  setOutputFormat: (target: VideoFormatTarget) => void
  setOutputPath: (path: string | null) => void
  setProbe: (probe: VideoFormatConvertProbeResult | null) => void
  setProbeError: (message: string | null) => void
  setFlowStatus: (s: VideoFormatConvertJobStatus) => void
  setPlanPreview: (preview: string | null, planError: string | null) => void
}

function initialUiSlice(): VideoFormatConvertUiSlice {
  return {
    flowStatus: 'idle',
    inputPath: null,
    outputFormat: defaultFormat,
    outputPath: null,
    probe: null,
    probeError: null,
    planError: null,
    previewCommand: null
  }
}

export const useVideoFormatConvertUiStore = create<VideoFormatConvertUiState>((set) => ({
  ...initialUiSlice(),
  reset: () => set(initialUiSlice()),
  setInputPath: (inputPath) =>
    set({
      inputPath,
      probe: null,
      probeError: null,
      planError: null,
      previewCommand: null,
      outputPath: null,
      flowStatus: 'idle'
    }),
  setOutputFormat: (outputFormat) =>
    set({
      outputFormat,
      planError: null,
      previewCommand: null,
      outputPath: null
    }),
  setOutputPath: (outputPath) => set({ outputPath }),
  setProbe: (probe) => set({ probe, probeError: null }),
  setProbeError: (probeError) => set({ probeError, probe: null }),
  setFlowStatus: (flowStatus) => set({ flowStatus }),
  setPlanPreview: (previewCommand, planError) => set({ previewCommand, planError })
}))

export function videoFormatTargetLabel(t: VideoFormatTarget): string {
  switch (t) {
    case 'webp_anim':
      return 'WebP động'
    default:
      return t.toUpperCase()
  }
}

export const VIDEO_FORMAT_SELECT_ITEMS: readonly VideoFormatTarget[] = VIDEO_FORMAT_TARGETS
