import { readdir, stat } from 'fs/promises'
import { basename, extname, join } from 'path'

import type { FolderDropScanResult } from '@shared/domain/folder-drop-scan'

const DEFAULT_MAX_FILES = 8_000
const DEFAULT_MAX_DEPTH = 64

function recordExt(map: Record<string, number>, filePath: string): void {
  const raw = extname(filePath).toLowerCase()
  const key = raw.startsWith('.') ? raw.slice(1) : raw
  const ext = key.length > 0 ? key : '*'
  map[ext] = (map[ext] ?? 0) + 1
}

export async function scanFolderForDrop(
  rootAbs: string,
  options?: { maxFiles?: number; maxDepth?: number }
): Promise<FolderDropScanResult> {
  const maxFiles = options?.maxFiles ?? DEFAULT_MAX_FILES
  const maxDepth = options?.maxDepth ?? DEFAULT_MAX_DEPTH
  let fileCount = 0
  let totalBytes = 0
  let truncated = false
  const extensionCounts: Record<string, number> = {}

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
      } else if (ent.isFile()) {
        fileCount += 1
        if (fileCount > maxFiles) {
          truncated = true
          return
        }
        try {
          const s = await stat(full)
          totalBytes += s.size
          recordExt(extensionCounts, full)
        } catch {
          recordExt(extensionCounts, full)
        }
      }
    }
  }

  await walk(rootAbs, 0)

  return {
    folderPath: rootAbs,
    folderName: basename(rootAbs),
    fileCount,
    totalBytes,
    truncated,
    extensionCounts
  }
}
