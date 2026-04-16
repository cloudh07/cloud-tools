import { readdir } from 'fs/promises'
import { extname, join } from 'path'

import { validateExistingDirectoryPath } from '@main/infrastructure/fs/path-validator'
import { isSmartCropImageInputExt } from '@main/infrastructure/fs/path-validator'

const DEFAULT_MAX_FILES = 20_000
const DEFAULT_MAX_DEPTH = 64

export async function scanImageFolderForSmartCrop(
  folderAbs: string,
  options?: { maxFiles?: number; maxDepth?: number }
): Promise<string[]> {
  const root = validateExistingDirectoryPath(folderAbs)
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH

  const out: string[] = []
  let truncated = false

  async function walk(dir: string, depth: number): Promise<void> {
    if (truncated) return
    if (depth > maxDepth) {
      truncated = true
      return
    }
    const entries = await readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      if (truncated) return
      const full = join(dir, ent.name)
      if (ent.isDirectory()) {
        await walk(full, depth + 1)
        continue
      }
      if (!ent.isFile()) continue
      const ext = extname(full).toLowerCase()
      if (!isSmartCropImageInputExt(ext)) continue
      out.push(full)
      if (out.length >= maxFiles) {
        truncated = true
        return
      }
    }
  }

  await walk(root, 0)
  return out
}
