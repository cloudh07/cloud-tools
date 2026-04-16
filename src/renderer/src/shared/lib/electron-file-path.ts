import type {
  GetPathForLocalFileFailureCode,
  GetPathForLocalFileResult
} from '@shared/domain/local-file-drop-path'

export type ElectronBackedFile = File & { path?: string }

export type ReadDroppedPathFailureCode =
  | GetPathForLocalFileFailureCode
  | 'no_desktop_bridge'
  | 'not_absolute'
  | 'invalid_file_url'

export type ReadDroppedPathResult =
  | { ok: true; path: string }
  | { ok: false; code: ReadDroppedPathFailureCode; message: string }

export function isAbsoluteFsPathForIpc(p: string): boolean {
  const t = p.trim()
  if (!t) return false
  if (t.startsWith('\\\\')) return true
  if (t.startsWith('/')) return true
  return /^[A-Za-z]:[\\/]/.test(t)
}

function callPreloadGetPath(file: File): GetPathForLocalFileResult | null {
  if (typeof window === 'undefined') return null
  const fn = window.desktop?.getPathForLocalFile
  if (typeof fn !== 'function') return null
  return fn(file)
}

export function readDroppedLocalFilePath(file: File): ReadDroppedPathResult {
  const bridge = callPreloadGetPath(file)
  if (bridge === null) {
    return {
      ok: false,
      code: 'no_desktop_bridge',
      message: 'Thiếu API desktop.getPathForLocalFile (preload chưa nạp hoặc lỗi contextBridge).'
    }
  }
  if (!bridge.ok) {
    return { ok: false, code: bridge.code, message: bridge.message }
  }
  let p = bridge.path
  if (/^file:/i.test(p)) {
    try {
      const { pathname } = new URL(p)
      let decoded = decodeURIComponent(pathname)
      if (decoded.startsWith('/') && /^\/[A-Za-z]:/.test(decoded)) {
        decoded = decoded.slice(1)
      }
      p = decoded
    } catch {
      return { ok: false, code: 'invalid_file_url', message: 'Không parse được URL file://.' }
    }
  }
  p = p.trim()
  if (!isAbsoluteFsPathForIpc(p)) {
    return {
      ok: false,
      code: 'not_absolute',
      message: `Đường dẫn sau khi chuẩn hóa không được coi là tuyệt đối: ${p.slice(0, 120)}${p.length > 120 ? '…' : ''}`
    }
  }
  return { ok: true, path: p }
}

export function tryReadElectronFilePath(file: File): string | null {
  const r = readDroppedLocalFilePath(file)
  return r.ok ? r.path : null
}

export function inferFolderPathFromDroppedFiles(files: readonly File[]): string | null {
  if (files.length === 0) return null
  const paths: string[] = []
  for (const f of files) {
    const p = tryReadElectronFilePath(f)
    if (p) paths.push(p)
  }
  if (paths.length === 0) return null
  if (paths.length === 1) return paths[0]!
  return inferCommonParentDirectory(paths)
}

export function dirnameDroppedPath(filePath: string): string {
  let p = filePath.trim()
  while (p.length > 1) {
    const last = p[p.length - 1]
    if (last !== '/' && last !== '\\') break
    if (/^[A-Za-z]:\\$/.test(p)) break
    if (p === '/') break
    p = p.slice(0, -1)
  }
  const i = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  if (i < 0) return p
  if (i === 0 && p[0] === '/') return '/'
  const out = p.slice(0, i)
  if (/^[A-Za-z]:$/.test(out)) {
    return `${out}\\`
  }
  return out
}

function toComparablePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/')
}

function isUnderOrEqualDirectory(filePath: string, dir: string): boolean {
  const f = toComparablePath(filePath)
  const d = toComparablePath(dir).replace(/\/$/, '')
  if (f === d) return true
  return f.startsWith(`${d}/`)
}

function inferCommonParentDirectory(paths: string[]): string | null {
  let dir = dirnameDroppedPath(paths[0]!)
  for (let i = 0; i < 512; i++) {
    const ok = paths.every((p) => isUnderOrEqualDirectory(p, dir))
    if (ok) return dir
    const next = dirnameDroppedPath(dir)
    if (next === dir) return null
    dir = next
  }
  return null
}
