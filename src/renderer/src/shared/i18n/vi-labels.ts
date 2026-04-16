import {
  CompressQualityPreset,
  CompressUseCaseProfile,
  CompressVideoCodec
} from '@shared/domain/compress-job'
import { ChromaEnhancePreset } from '@shared/domain/chroma-enhance'
import { ChromaKeyingKind } from '@shared/domain/chroma-keying-kind'
import type { VideoJobPhase, VideoJobStatus } from '@shared/domain/video-job'
import type { AudioExtractJobPhase } from '@shared/domain/audio-extract-job'
import {
  VideoOutputMode as OutputMode,
  VideoQualityPreset as QualityPreset,
  type VideoOutputMode,
  type VideoQualityPreset
} from '@shared/domain/video-output-mode'

const JOB_STATUS_VI: Record<VideoJobStatus, string> = {
  idle: 'Idle',
  queued: 'Chờ xử lý',
  running: 'Đang chạy',
  cancelling: 'Đang hủy',
  completed: 'Hoàn tất',
  failed: 'Lỗi',
  cancelled: 'Đã hủy'
}

export function jobStatusVi(status: VideoJobStatus): string {
  return JOB_STATUS_VI[status] ?? status
}

export function chromaEnhancePresetLabelVi(
  preset: (typeof ChromaEnhancePreset)[keyof typeof ChromaEnhancePreset]
): string {
  switch (preset) {
    case ChromaEnhancePreset.LIGHT:
      return 'Nhẹ'
    case ChromaEnhancePreset.BALANCED:
      return 'Cân bằng'
    case ChromaEnhancePreset.STRONG:
      return 'Mạnh vừa'
    default:
      return preset
  }
}

export function jobPhaseVi(phase: VideoJobPhase): string {
  if (phase === 'transcode') return 'Mã hóa'
  if (phase === 'enhance') return 'Làm nét / denoise (hậu xử lý)'
  return 'WebP'
}

export function audioExtractPhaseVi(phase: AudioExtractJobPhase): string {
  return phase === 'extract' ? 'Tách âm thanh' : phase
}

export function outputModeLabelVi(mode: VideoOutputMode): string {
  return mode === OutputMode.GREEN_SCREEN ? 'Nền xanh (MP4 / H.264)' : 'Alpha (MOV / ProRes 4444)'
}

export function qualityPresetLabelVi(preset: VideoQualityPreset): string {
  switch (preset) {
    case QualityPreset.FAST:
      return 'Nhanh'
    case QualityPreset.BALANCED:
      return 'Cân bằng'
    case QualityPreset.QUALITY:
      return 'Chất lượng'
    default:
      return preset
  }
}

type ChromaKeyingKindValue = (typeof ChromaKeyingKind)[keyof typeof ChromaKeyingKind]

export function keyingKindLabelVi(kind: ChromaKeyingKindValue): string {
  if (kind === ChromaKeyingKind.STUDIO_CHROMA) {
    return 'Chroma studio (chromakey - phông xanh/đỏ)'
  }
  if (kind === ChromaKeyingKind.SOLID_RGB) {
    return 'RGB đồng nhất (colorkey - nền đen/trắng/xám)'
  }
  return kind
}

export function compressQualityLabelVi(q: CompressQualityPreset): string {
  switch (q) {
    case CompressQualityPreset.MAX_QUALITY:
      return 'Chất lượng tối đa'
    case CompressQualityPreset.BALANCED:
      return 'Cân bằng'
    case CompressQualityPreset.SMALL_SIZE:
      return 'Dung lượng nhỏ'
    case CompressQualityPreset.ULTRA_COMPRESSED:
      return 'Siêu nén'
    default:
      return q
  }
}

export function compressProfileLabelVi(p: CompressUseCaseProfile): string {
  switch (p) {
    case CompressUseCaseProfile.GENERIC:
      return 'Tổng quát'
    case CompressUseCaseProfile.WEB_UPLOAD:
      return 'Web upload'
    case CompressUseCaseProfile.DISCORD:
      return 'Discord'
    case CompressUseCaseProfile.SOCIAL:
      return 'Mạng xã hội'
    case CompressUseCaseProfile.TRANSPARENT_MOV:
      return 'Alpha - MOV (ProRes)'
    case CompressUseCaseProfile.TRANSPARENT_WEBM:
      return 'Alpha - WebM (VP9)'
    case CompressUseCaseProfile.ANIMATED_WEBP:
      return 'WebP động'
    case CompressUseCaseProfile.GREEN_SCREEN:
      return 'Phông xanh (giữ grain)'
    case CompressUseCaseProfile.ARCHIVE:
      return 'Lưu trữ (HEVC)'
    case CompressUseCaseProfile.STORAGE:
      return 'Kho dữ liệu (HEVC nhỏ)'
    default:
      return p
  }
}

export function compressCodecLabelVi(c: CompressVideoCodec): string {
  switch (c) {
    case CompressVideoCodec.H264:
      return 'H.264 (libx264)'
    case CompressVideoCodec.H265:
      return 'H.265 / HEVC (libx265)'
    case CompressVideoCodec.VP9:
      return 'VP9 (libvpx-vp9)'
    case CompressVideoCodec.AV1:
      return 'AV1 (libsvtav1 - cần ffmpeg hỗ trợ)'
    default:
      return c
  }
}

export function batchStatusLabelVi(
  status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
): string {
  switch (status) {
    case 'idle':
      return 'Idle'
    case 'queued':
      return 'Đang xếp hàng'
    case 'processing':
      return 'Đang xử lý'
    case 'completed':
      return 'Hoàn tất'
    case 'failed':
      return 'Có lỗi'
    case 'cancelled':
      return 'Đã hủy'
    default:
      return String(status)
  }
}
