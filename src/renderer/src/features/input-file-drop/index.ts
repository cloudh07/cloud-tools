export { validateDroppedVideoFilePaths } from '@/features/input-file-drop/domain/dropped-video-paths'
export { useInputVideoDrop } from '@/features/input-file-drop/application/use-input-video-drop'
export type {
  DroppedPathListValidation,
  DroppedPathsValidator,
  InputVideoDropSurface
} from '@/features/input-file-drop/application/use-input-video-drop'
export { readDroppedLocalFilePath } from '@/shared/lib/electron-file-path'
export type {
  ReadDroppedPathResult,
  ReadDroppedPathFailureCode
} from '@/shared/lib/electron-file-path'
