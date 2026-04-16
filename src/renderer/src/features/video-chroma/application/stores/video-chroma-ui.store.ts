import { ChromaEnhancePreset } from '@shared/domain/chroma-enhance'
import { ChromaKeyingKind } from '@shared/domain/chroma-keying-kind'
import type { VideoProbeResult } from '@shared/domain/video-job'
import { VideoOutputMode, VideoQualityPreset } from '@shared/domain/video-output-mode'
import { create } from 'zustand'

type QualityPreset = (typeof VideoQualityPreset)[keyof typeof VideoQualityPreset]
type KeyingKind = (typeof ChromaKeyingKind)[keyof typeof ChromaKeyingKind]
type EnhancePreset = (typeof ChromaEnhancePreset)[keyof typeof ChromaEnhancePreset]

const defaultSession = (): Pick<
  VideoChromaUiState,
  | 'inputPath'
  | 'outputPath'
  | 'webpOutputPath'
  | 'previewUrl'
  | 'probe'
  | 'mode'
  | 'preset'
  | 'keyingKind'
  | 'keyColor'
  | 'similarity'
  | 'blend'
  | 'autoEnhanceOutput'
  | 'chromaEnhancePreset'
  | 'exportWebp'
  | 'isProbing'
  | 'probeError'
> => ({
  inputPath: null,
  outputPath: null,
  webpOutputPath: null,
  previewUrl: null,
  probe: null,
  mode: VideoOutputMode.GREEN_SCREEN,
  preset: VideoQualityPreset.BALANCED,
  keyingKind: ChromaKeyingKind.STUDIO_CHROMA,
  keyColor: '0x00FF00',
  similarity: 0.22,
  blend: 0.08,
  autoEnhanceOutput: false,
  chromaEnhancePreset: ChromaEnhancePreset.BALANCED,
  exportWebp: false,
  isProbing: false,
  probeError: null
})

type VideoChromaUiState = {
  inputPath: string | null
  outputPath: string | null
  webpOutputPath: string | null
  previewUrl: string | null
  probe: VideoProbeResult | null
  mode: VideoOutputMode
  preset: QualityPreset
  keyingKind: KeyingKind
  keyColor: string
  similarity: number
  blend: number
  autoEnhanceOutput: boolean
  chromaEnhancePreset: EnhancePreset
  exportWebp: boolean
  isProbing: boolean
  probeError: string | null
  setInputPath: (path: string | null) => void
  setOutputPath: (path: string | null) => void
  setWebpOutputPath: (path: string | null) => void
  setPreviewUrl: (url: string | null) => void
  setProbe: (probe: VideoProbeResult | null) => void
  setMode: (mode: VideoOutputMode) => void
  setPreset: (preset: QualityPreset) => void
  setKeyingKind: (keyingKind: KeyingKind) => void
  setKeyColor: (keyColor: string) => void
  setSimilarity: (similarity: number) => void
  setBlend: (blend: number) => void
  setAutoEnhanceOutput: (v: boolean) => void
  setChromaEnhancePreset: (v: EnhancePreset) => void
  setExportWebp: (exportWebp: boolean) => void
  setIsProbing: (isProbing: boolean) => void
  setProbeError: (message: string | null) => void
  resetSession: () => void
}

export const useVideoChromaUiStore = create<VideoChromaUiState>((set) => ({
  ...defaultSession(),
  setInputPath: (inputPath) => set({ inputPath }),
  setOutputPath: (outputPath) => set({ outputPath }),
  setWebpOutputPath: (webpOutputPath) => set({ webpOutputPath }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setProbe: (probe) => set({ probe }),
  setMode: (mode) => set({ mode }),
  setPreset: (preset) => set({ preset }),
  setKeyingKind: (keyingKind) => set({ keyingKind }),
  setKeyColor: (keyColor) => set({ keyColor }),
  setSimilarity: (similarity) => set({ similarity }),
  setBlend: (blend) => set({ blend }),
  setAutoEnhanceOutput: (autoEnhanceOutput) => set({ autoEnhanceOutput }),
  setChromaEnhancePreset: (chromaEnhancePreset) => set({ chromaEnhancePreset }),
  setExportWebp: (exportWebp) => set({ exportWebp }),
  setIsProbing: (isProbing) => set({ isProbing }),
  setProbeError: (probeError) => set({ probeError }),
  resetSession: () => set(defaultSession())
}))
