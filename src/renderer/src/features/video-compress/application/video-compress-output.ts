import { CompressUseCaseProfile, CompressVideoCodec } from '@shared/domain/compress-job'

export function suggestedCompressExtension(
  profile: CompressUseCaseProfile,
  codec: CompressVideoCodec
): string {
  if (profile === CompressUseCaseProfile.ANIMATED_WEBP) return '.webp'
  if (profile === CompressUseCaseProfile.TRANSPARENT_MOV) return '.mov'
  if (profile === CompressUseCaseProfile.TRANSPARENT_WEBM) return '.webm'
  if (codec === CompressVideoCodec.VP9) return '.webm'
  return '.mp4'
}
