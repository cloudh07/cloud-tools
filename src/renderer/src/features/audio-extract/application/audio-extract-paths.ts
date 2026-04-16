import type { AudioExtractFormat } from '@shared/domain/audio-extract-job'

export { fileNameFromPath, joinDirFile, stemFromPath } from '@/shared/lib/local-file-path'

export function extensionForFormat(format: AudioExtractFormat): string {
  return `.${format}`
}
