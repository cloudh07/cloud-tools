import { mapSpawnErrorToMediaBinary } from '@main/infrastructure/ffmpeg/spawn-binary-error'

export function mapFfmpegSpawnError(err: unknown): Error {
  return mapSpawnErrorToMediaBinary('ffmpeg', err)
}
