export type GetPathForLocalFileFailureCode =
  | 'not_file'
  | 'webutils_empty'
  | 'webutils_threw'
  | 'unknown'

export type GetPathForLocalFileResult =
  | { ok: true; path: string }
  | { ok: false; code: GetPathForLocalFileFailureCode; message: string }
