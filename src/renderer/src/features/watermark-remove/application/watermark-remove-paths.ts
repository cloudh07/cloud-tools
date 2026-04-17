import { fileExtensionLower, joinDirFile, stemFromPath } from '@/shared/lib/local-file-path'
import type {
  WatermarkRemoveImageFormat,
  WatermarkRemoveMediaKind,
  WatermarkRemoveVideoCodec
} from '@shared/domain/watermark-remove'

const IMAGE_KEEP_EXT = new Set(['jpg', 'jpeg', 'png', 'webp'])
const VIDEO_KEEP_EXT = new Set(['mp4', 'mov', 'webm', 'mkv'])

export function extensionForRemoveOutput(
  kind: WatermarkRemoveMediaKind,
  format: WatermarkRemoveImageFormat,
  codec: WatermarkRemoveVideoCodec,
  inputPath: string
): string {
  if (kind === 'image') {
    if (format === 'jpeg') return 'jpg'
    if (format === 'png') return 'png'
    if (format === 'webp') return 'webp'
    const ext = fileExtensionLower(inputPath)
    if (ext && IMAGE_KEEP_EXT.has(ext)) return ext
    return 'png'
  }
  if (codec === 'vp9') return 'webm'
  if (codec === 'h264') return 'mp4'
  const ext = fileExtensionLower(inputPath)
  if (ext && VIDEO_KEEP_EXT.has(ext)) return ext
  return 'mp4'
}

export function buildRemoveOutputFileName(params: {
  inputPath: string
  kind: WatermarkRemoveMediaKind
  imageFormat: WatermarkRemoveImageFormat
  videoCodec: WatermarkRemoveVideoCodec
  autoRename: boolean
}): string {
  const stem = stemFromPath(params.inputPath)
  const ext = extensionForRemoveOutput(
    params.kind,
    params.imageFormat,
    params.videoCodec,
    params.inputPath
  )
  return params.autoRename ? `${stem}_clean.${ext}` : `${stem}.${ext}`
}

export function buildRemoveOutputPath(params: {
  inputPath: string
  outputFolder: string
  kind: WatermarkRemoveMediaKind
  imageFormat: WatermarkRemoveImageFormat
  videoCodec: WatermarkRemoveVideoCodec
  autoRename: boolean
}): string {
  return joinDirFile(params.outputFolder, buildRemoveOutputFileName(params))
}
