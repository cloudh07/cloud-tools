import type { ImageFormatTarget } from '@shared/domain/image-format-convert'
import { joinDirFile, stemFromPath } from '@/shared/lib/local-file-path'

export function extensionForImageFormatTarget(t: ImageFormatTarget): string {
  if (t === 'jpeg') return 'jpg'
  if (t === 'tiff') return 'tif'
  return t
}

export function buildConvertedFileName(
  inputPath: string,
  target: ImageFormatTarget,
  autoRename: boolean
): string {
  const stem = stemFromPath(inputPath)
  const ext = extensionForImageFormatTarget(target)
  return autoRename ? `${stem}_converted.${ext}` : `${stem}.${ext}`
}

export function buildOutputPathForConvert(
  inputPath: string,
  outputFolder: string,
  target: ImageFormatTarget,
  autoRename: boolean
): string {
  return joinDirFile(outputFolder, buildConvertedFileName(inputPath, target, autoRename))
}
