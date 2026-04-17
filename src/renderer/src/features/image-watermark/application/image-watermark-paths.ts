import { fileExtensionLower, joinDirFile, stemFromPath } from '@/shared/lib/local-file-path'
import type { WatermarkOutputFormat } from '@shared/domain/image-watermark'

const SUPPORTED_KEEP_EXT = new Set(['jpg', 'jpeg', 'png', 'webp'])

export function extensionForWatermarkOutput(
  format: WatermarkOutputFormat,
  inputPath: string
): string {
  if (format === 'jpeg') return 'jpg'
  if (format === 'png') return 'png'
  if (format === 'webp') return 'webp'
  const ext = fileExtensionLower(inputPath)
  if (ext && SUPPORTED_KEEP_EXT.has(ext)) return ext
  return 'png'
}

export function buildWatermarkedFileName(
  inputPath: string,
  format: WatermarkOutputFormat,
  autoRename: boolean
): string {
  const stem = stemFromPath(inputPath)
  const ext = extensionForWatermarkOutput(format, inputPath)
  return autoRename ? `${stem}_watermarked.${ext}` : `${stem}.${ext}`
}

export function buildOutputPathForWatermark(
  inputPath: string,
  outputFolder: string,
  format: WatermarkOutputFormat,
  autoRename: boolean
): string {
  return joinDirFile(outputFolder, buildWatermarkedFileName(inputPath, format, autoRename))
}
