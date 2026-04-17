import { useWatermarkRemoveJobStore } from '@/features/watermark-remove/application/stores/watermark-remove-job.store'
import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'

export function resetWatermarkRemoveSession(): void {
  useWatermarkRemoveUiStore.getState().resetSession()
  useWatermarkRemoveJobStore.getState().reset()
}
