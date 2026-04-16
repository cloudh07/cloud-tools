import { useVideoChromaEnhanceStore } from '@/features/video-chroma/application/stores/video-chroma-enhance.store'
import { useVideoChromaJobStore } from '@/features/video-chroma/application/stores/video-chroma-job.store'
import { useVideoChromaUiStore } from '@/features/video-chroma/application/stores/video-chroma-ui.store'

export function resetVideoChromaSession(): void {
  useVideoChromaJobStore.getState().reset()
  useVideoChromaEnhanceStore.getState().reset()
  useVideoChromaUiStore.getState().resetSession()
}
