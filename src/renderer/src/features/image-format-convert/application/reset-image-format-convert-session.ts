import { useImageFormatConvertJobStore } from '@/features/image-format-convert/application/stores/image-format-convert-job.store'
import { useImageFormatConvertUiStore } from '@/features/image-format-convert/application/stores/image-format-convert-ui.store'

export function resetImageFormatConvertSession(): void {
  useImageFormatConvertUiStore.getState().resetSession()
  useImageFormatConvertJobStore.getState().reset()
}
