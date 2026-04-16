import { useVideoFormatConvertJobStore } from '@/features/video-format-convert/application/stores/video-format-convert-job.store'
import { useVideoFormatConvertUiStore } from '@/features/video-format-convert/application/stores/video-format-convert-ui.store'

export function resetVideoFormatConvertSession(): void {
  useVideoFormatConvertUiStore.getState().reset()
  useVideoFormatConvertJobStore.getState().reset()
}
