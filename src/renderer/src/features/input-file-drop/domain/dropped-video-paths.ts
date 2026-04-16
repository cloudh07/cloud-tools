import { ACCEPTED_DROP_VIDEO_EXTENSIONS } from './accepted-drop-video-extensions'
import { isAbsoluteFsPathForIpc } from '@/shared/lib/electron-file-path'
import { ABSOLUTE_LOCAL_PATH_REQUIRED_VI, fileExtensionLower } from '@/shared/lib/local-file-path'

export function validateDroppedVideoFilePaths(
  paths: readonly string[]
): { ok: true; paths: string[] } | { ok: false; message: string } {
  if (paths.length === 0) {
    return { ok: false, message: 'Không có đường dẫn tệp hợp lệ.' }
  }
  const normalized: string[] = []
  for (const p of paths) {
    if (!isAbsoluteFsPathForIpc(p)) {
      return {
        ok: false,
        message: ABSOLUTE_LOCAL_PATH_REQUIRED_VI
      }
    }
    const ext = fileExtensionLower(p)
    if (!ext) {
      return { ok: false, message: 'Tệp cần có phần mở rộng (ví dụ .mp4).' }
    }
    if (!ACCEPTED_DROP_VIDEO_EXTENSIONS.has(ext)) {
      const allowed = [...ACCEPTED_DROP_VIDEO_EXTENSIONS].sort().join(', ')
      return {
        ok: false,
        message: `Định dạng .${ext} không được hỗ trợ. Chấp nhận: ${allowed}.`
      }
    }
    normalized.push(p)
  }
  return { ok: true, paths: normalized }
}
