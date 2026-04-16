import {
  CompressQualityPreset,
  CompressUseCaseProfile,
  CompressVideoCodec,
  defaultCompressOverrides,
  type CompressEncodingOverrides,
  type CompressRateMode
} from '@shared/domain/compress-job'
import { create } from 'zustand'

const defaultUiSession = (): Pick<
  VideoCompressUiState,
  'outputFolder' | 'quality' | 'profile' | 'codec' | 'overrides'
> => ({
  outputFolder: null,
  quality: CompressQualityPreset.BALANCED,
  profile: CompressUseCaseProfile.GENERIC,
  codec: CompressVideoCodec.H264,
  overrides: defaultCompressOverrides()
})

export type VideoCompressUiState = {
  outputFolder: string | null
  quality: CompressQualityPreset
  profile: CompressUseCaseProfile
  codec: CompressVideoCodec
  overrides: CompressEncodingOverrides
  resetSession: () => void
  setOutputFolder: (p: string | null) => void
  setQuality: (q: CompressQualityPreset) => void
  setProfile: (p: CompressUseCaseProfile) => void
  setCodec: (c: CompressVideoCodec) => void
  setRateMode: (m: CompressRateMode | null) => void
  setTargetVideoBitrateKbps: (v: number | null) => void
  setCrf: (v: number | null) => void
  setScale: (v: number | null) => void
  setFps: (v: number | null) => void
  setAudioBitrateKbps: (v: number | null) => void
}

export const useVideoCompressUiStore = create<VideoCompressUiState>((set) => ({
  ...defaultUiSession(),
  resetSession: () => set(defaultUiSession()),
  setOutputFolder: (outputFolder) => set({ outputFolder }),
  setQuality: (quality) => set({ quality }),
  setProfile: (profile) => set({ profile }),
  setCodec: (codec) => set({ codec }),
  setRateMode: (rateMode) =>
    set((s) => ({ overrides: { ...s.overrides, rateMode: rateMode ?? null } })),
  setTargetVideoBitrateKbps: (targetVideoBitrateKbps) =>
    set((s) => ({ overrides: { ...s.overrides, targetVideoBitrateKbps } })),
  setCrf: (crf) => set((s) => ({ overrides: { ...s.overrides, crf } })),
  setScale: (scale) => set((s) => ({ overrides: { ...s.overrides, scale } })),
  setFps: (fps) => set((s) => ({ overrides: { ...s.overrides, fps } })),
  setAudioBitrateKbps: (audioBitrateKbps) =>
    set((s) => ({ overrides: { ...s.overrides, audioBitrateKbps } }))
}))
