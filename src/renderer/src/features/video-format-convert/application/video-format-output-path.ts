import { joinDirFile, stemFromPath } from '@/shared/lib/local-file-path'
import type { VideoFormatTarget } from '@shared/domain/video-format-convert'
import { videoFormatTargetExtension } from '@shared/domain/video-format-convert'

function parentDir(inputPath: string): string {
  const u = inputPath.replace(/\\/g, '/')
  const idx = u.lastIndexOf('/')
  if (idx <= 0) return ''
  return inputPath.slice(0, inputPath.length - (u.length - idx))
}

export function suggestedVideoFormatConvertSavePath(
  inputPath: string,
  target: VideoFormatTarget
): string {
  const dir = parentDir(inputPath)
  const stem = stemFromPath(inputPath)
  const ext = videoFormatTargetExtension(target)
  const name = `${stem}.converted${ext}`
  return dir ? joinDirFile(dir, name) : name
}

export function defaultVideoFormatSaveFileName(
  inputPath: string,
  target: VideoFormatTarget
): string {
  const stem = stemFromPath(inputPath)
  const ext = videoFormatTargetExtension(target)
  return `${stem}.converted${ext}`
}
