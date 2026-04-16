export type MediaBinaryKind = 'ffmpeg' | 'ffprobe'

export type MediaBinarySource = 'bundled' | 'env' | 'path' | 'sibling' | 'settings'

export type ResolvedMediaBinary = {
  path: string
  source: MediaBinarySource
}

const FRIENDLY_VI: Record<MediaBinaryKind, string> = {
  ffmpeg:
    'App chưa tìm thấy ffmpeg. Đã thử: binary đi kèm -> biến môi trường -> PATH -> Cài đặt. Cài FFmpeg hoặc đặt file vào thư mục ffmpeg-bin đi kèm app.',
  ffprobe:
    'App chưa tìm thấy ffprobe. Đang thử binary đi kèm / PATH / cấu hình hiện tại. Cài FFmpeg (có ffprobe) hoặc mở Cài đặt để chỉ đường dẫn nếu cần.'
}

export const MEDIA_BINARY_SPAWN_ENOENT_VI: Record<MediaBinaryKind, string> = {
  ffmpeg:
    'Không thể khởi chạy ffmpeg (ENOENT). File có thể đã bị xóa hoặc không thực thi được. Kiểm tra Cài đặt hoặc cài lại FFmpeg.',
  ffprobe:
    'Không thể khởi chạy ffprobe (ENOENT). File có thể đã bị xóa hoặc không thực thi được. Kiểm tra Cài đặt hoặc cài lại FFmpeg.'
}

export class MediaBinaryNotFoundError extends Error {
  readonly code = 'MEDIA_BINARY_NOT_FOUND'
  readonly kind: MediaBinaryKind

  constructor(kind: MediaBinaryKind, message?: string) {
    super(message ?? FRIENDLY_VI[kind])
    this.name = 'MediaBinaryNotFoundError'
    this.kind = kind
  }
}

export function isMediaBinaryNotFoundError(e: unknown): e is MediaBinaryNotFoundError {
  return e instanceof MediaBinaryNotFoundError
}
