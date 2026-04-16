import { AudioExtractFormat } from '@shared/domain/audio-extract-job'
import { create } from 'zustand'

type AudioExtractUiSession = {
  inputPath: string | null
  outputFolder: string | null
  format: AudioExtractFormat
  preferCopy: boolean
  extractAll: boolean
  selectedAudioOrdinal: number
}

const defaultSession = (): AudioExtractUiSession => ({
  inputPath: null,
  outputFolder: null,
  format: AudioExtractFormat.M4A,
  preferCopy: true,
  extractAll: false,
  selectedAudioOrdinal: 0
})

export type AudioExtractUiState = AudioExtractUiSession & {
  resetSession: () => void
  setInputPath: (p: string | null) => void
  setOutputFolder: (p: string | null) => void
  setFormat: (f: AudioExtractFormat) => void
  setPreferCopy: (v: boolean) => void
  setExtractAll: (v: boolean) => void
  setSelectedAudioOrdinal: (n: number) => void
}

export const useAudioExtractUiStore = create<AudioExtractUiState>((set) => ({
  ...defaultSession(),
  resetSession: () => set(defaultSession()),
  setInputPath: (inputPath) => set({ inputPath }),
  setOutputFolder: (outputFolder) => set({ outputFolder }),
  setFormat: (format) => set({ format }),
  setPreferCopy: (preferCopy) => set({ preferCopy }),
  setExtractAll: (extractAll) => set({ extractAll }),
  setSelectedAudioOrdinal: (selectedAudioOrdinal) => set({ selectedAudioOrdinal })
}))
