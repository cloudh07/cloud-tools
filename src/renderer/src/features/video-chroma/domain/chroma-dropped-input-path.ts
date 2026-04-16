import { isAbsoluteFsPathForIpc } from '@/shared/lib/electron-file-path'
import { ABSOLUTE_LOCAL_PATH_REQUIRED_VI, fileExtensionLower } from '@/shared/lib/local-file-path'

export function validateChromaDroppedInputPath(
  path: string
): { ok: true; path: string } | { ok: false; message: string } {
  if (!isAbsoluteFsPathForIpc(path)) {
    return {
      ok: false,
      message: ABSOLUTE_LOCAL_PATH_REQUIRED_VI
    }
  }
  const ext = fileExtensionLower(path)
  if (!ext) {
    return { ok: false, message: 'Tệp cần có phần mở rộng .mp4.' }
  }
  if (ext !== 'mp4') {
    return { ok: false, message: 'Công cụ chroma chỉ nhận tệp .mp4.' }
  }
  return { ok: true, path }
}
