import {
  MediaBinaryNotFoundError,
  type MediaBinaryKind,
  MEDIA_BINARY_SPAWN_ENOENT_VI
} from '@shared/domain/media-binary'

export function isErrnoCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as NodeJS.ErrnoException).code === code
  )
}

export function mapSpawnErrorToMediaBinary(kind: MediaBinaryKind, err: unknown): Error {
  if (isErrnoCode(err, 'ENOENT')) {
    return new MediaBinaryNotFoundError(kind, MEDIA_BINARY_SPAWN_ENOENT_VI[kind])
  }
  return err instanceof Error ? err : new Error(String(err))
}
