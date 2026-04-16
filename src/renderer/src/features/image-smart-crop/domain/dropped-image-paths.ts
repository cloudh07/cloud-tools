import { isAbsoluteFsPathForIpc } from '@/shared/lib/electron-file-path'
import { ABSOLUTE_LOCAL_PATH_REQUIRED_VI, fileExtensionLower } from '@/shared/lib/local-file-path'

export const ACCEPTED_IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'tif',
  'tiff',
  'avif',
  'bmp',
  'heic',
  'heif',
  'jxl',
  'svg'
])

export function validateDroppedImageFilePaths(
  paths: readonly string[]
): { ok: true; paths: string[] } | { ok: false; message: string } {
  if (paths.length === 0) {
    return { ok: false, message: 'Không có đường dẫn tệp hợp lệ.' }
  }
  const out: string[] = []
  for (const p of paths) {
    if (!isAbsoluteFsPathForIpc(p)) {
      return { ok: false, message: ABSOLUTE_LOCAL_PATH_REQUIRED_VI }
    }
    const ext = fileExtensionLower(p)
    if (!ext) {
      return { ok: false, message: 'Tệp cần có phần mở rộng.' }
    }
    if (!ACCEPTED_IMAGE_EXTENSIONS.has(ext)) {
      const allowed = [...ACCEPTED_IMAGE_EXTENSIONS].sort().join(', ')
      return {
        ok: false,
        message: `Định dạng .${ext} không được hỗ trợ. Chấp nhận: ${allowed}.`
      }
    }
    out.push(p)
  }
  return { ok: true, paths: out }
}
