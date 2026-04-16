import { useImageSmartCropBatchJobStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-batch-job.store'
import { useImageSmartCropBatchUiStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-batch-ui.store'
import { useImageSmartCropJobStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-job.store'
import { useImageSmartCropUiStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-ui.store'

export function resetImageSmartCropSession(): void {
  useImageSmartCropUiStore.getState().resetSession()
  useImageSmartCropJobStore.getState().reset()
}

export function resetImageSmartCropBatchSession(): void {
  useImageSmartCropBatchJobStore.getState().reset()
  useImageSmartCropBatchUiStore.getState().resetSession()
}

export function resetImageSmartCropAllSessions(): void {
  resetImageSmartCropSession()
  resetImageSmartCropBatchSession()
}
