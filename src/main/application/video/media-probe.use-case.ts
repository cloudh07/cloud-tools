import { probeAudioTracks } from '@main/infrastructure/ffmpeg/probe-audio-tracks'
import { probeVideoFile } from '@main/infrastructure/ffmpeg/ffprobe-service'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import { validateMediaBinaryPath } from '@main/infrastructure/media/validate-binary-path'
import type { AppConfig } from '@shared/domain/app-config'
import type { AudioExtractProbeResult } from '@shared/domain/audio-extract-job'
import { MediaBinaryNotFoundError, type ResolvedMediaBinary } from '@shared/domain/media-binary'
import type { VideoProbeResult } from '@shared/domain/video-job'

function resolvedFfprobeOrThrow(cfg: AppConfig): ResolvedMediaBinary {
  const r = getMediaBinaryResolver().resolveFfprobeOrThrow(cfg)
  if (!validateMediaBinaryPath(r.path)) {
    throw new MediaBinaryNotFoundError('ffprobe')
  }
  return r
}

export async function probeVideoForApp(
  cfg: AppConfig,
  inputPath: string
): Promise<VideoProbeResult> {
  const r = resolvedFfprobeOrThrow(cfg)
  console.info(`[ffprobe] video metadata source=${r.source} path=${r.path}`)
  return probeVideoFile(r.path, inputPath)
}

export async function probeAudioStreamsForApp(
  cfg: AppConfig,
  inputPath: string
): Promise<AudioExtractProbeResult> {
  const r = resolvedFfprobeOrThrow(cfg)
  console.info(`[ffprobe] audio streams source=${r.source} path=${r.path}`)
  return probeAudioTracks(r.path, inputPath)
}
