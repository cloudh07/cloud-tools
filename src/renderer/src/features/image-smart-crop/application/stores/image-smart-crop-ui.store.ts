import type {
  ImageSmartCropOutputFormat,
  SmartCropAnalysisResult,
  SmartCropAspectMode
} from '@shared/domain/image-smart-crop'
import { create } from 'zustand'

type Session = {
  inputPath: string | null
  outputFormat: ImageSmartCropOutputFormat
  aspectMode: SmartCropAspectMode
  paddingRatio: number
  sensitivity: number
  keepAlpha: boolean
  analysis: SmartCropAnalysisResult | null
  inputPreviewUrl: string | null
  chosenOutputPath: string | null
}

const defaultSession = (): Session => ({
  inputPath: null,
  outputFormat: 'png',
  aspectMode: 'free',
  paddingRatio: 0.01,
  sensitivity: 0.55,
  keepAlpha: true,
  analysis: null,
  inputPreviewUrl: null,
  chosenOutputPath: null
})

export type ImageSmartCropUiState = Session & {
  resetSession: () => void
  setInputPath: (p: string | null) => void
  setOutputFormat: (f: ImageSmartCropOutputFormat) => void
  setAspectMode: (m: SmartCropAspectMode) => void
  setPaddingRatio: (n: number) => void
  setSensitivity: (n: number) => void
  setKeepAlpha: (v: boolean) => void
  setAnalysis: (a: SmartCropAnalysisResult | null) => void
  setInputPreviewUrl: (u: string | null) => void
  setChosenOutputPath: (p: string | null) => void
}

export const useImageSmartCropUiStore = create<ImageSmartCropUiState>((set) => ({
  ...defaultSession(),
  resetSession: () => set(defaultSession()),
  setInputPath: (inputPath) => set({ inputPath }),
  setOutputFormat: (outputFormat) => set({ outputFormat }),
  setAspectMode: (aspectMode) => set({ aspectMode }),
  setPaddingRatio: (paddingRatio) => set({ paddingRatio }),
  setSensitivity: (sensitivity) => set({ sensitivity }),
  setKeepAlpha: (keepAlpha) => set({ keepAlpha }),
  setAnalysis: (analysis) => set({ analysis }),
  setInputPreviewUrl: (inputPreviewUrl) => set({ inputPreviewUrl }),
  setChosenOutputPath: (chosenOutputPath) => set({ chosenOutputPath })
}))
