import { useVideoCompressJobStore } from '@/features/video-compress/application/stores/video-compress-job.store'
import { useVideoCompressUiStore } from '@/features/video-compress/application/stores/video-compress-ui.store'

export function resetVideoCompressSession(): void {
  useVideoCompressJobStore.getState().reset()
  useVideoCompressUiStore.getState().resetSession()
}
