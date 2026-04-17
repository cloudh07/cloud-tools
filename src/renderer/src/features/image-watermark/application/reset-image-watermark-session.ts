import { useImageWatermarkJobStore } from '@/features/image-watermark/application/stores/image-watermark-job.store'
import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'

export function resetImageWatermarkSession(): void {
  useImageWatermarkUiStore.getState().resetSession()
  useImageWatermarkJobStore.getState().reset()
}
