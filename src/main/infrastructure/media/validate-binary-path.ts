import { existsSync } from 'fs'

export function validateMediaBinaryPath(absPath: string): boolean {
  return typeof absPath === 'string' && absPath.trim().length > 0 && existsSync(absPath)
}
