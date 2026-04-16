import { useAudioExtractJobStore } from '@/features/audio-extract/application/stores/audio-extract-job.store'
import { useAudioExtractUiStore } from '@/features/audio-extract/application/stores/audio-extract-ui.store'

export function resetAudioExtractSession(): void {
  useAudioExtractJobStore.getState().reset()
  useAudioExtractUiStore.getState().resetSession()
}
