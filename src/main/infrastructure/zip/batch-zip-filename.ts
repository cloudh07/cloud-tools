import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'

export const BATCH_ZIP_FILES_STEM = 'images'

const INVALID_FILE_NAME_CHARS = new Set('<>:"/\\|?*')

function stripUnsafeFileNameChars(segment: string): string {
  let out = ''
  for (const ch of segment) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 32 || INVALID_FILE_NAME_CHARS.has(ch)) continue
    out += ch
  }
  return out
}

function batchZipUniqueSuffix(): string {
  return randomBytes(5).toString('hex')
}

export function sanitizeBatchZipStemFromFolderPath(folderPath: string): string {
  const trimmed = folderPath.trim()
  const base = basename(trimmed) || trimmed
  const cleaned = stripUnsafeFileNameChars(base)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/g, '')
    .trim()
    .slice(0, 120)
  return cleaned.length > 0 ? cleaned : BATCH_ZIP_FILES_STEM
}

export function buildBatchZipFileName(sourceFolderPath: string | null | undefined): string {
  const stem =
    sourceFolderPath != null && sourceFolderPath.trim() !== ''
      ? sanitizeBatchZipStemFromFolderPath(sourceFolderPath)
      : BATCH_ZIP_FILES_STEM
  return `${stem}-batch-${batchZipUniqueSuffix()}.zip`
}
