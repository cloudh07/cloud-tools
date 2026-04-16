export function fileNameFromPath(p: string): string {
  return p.replace(/^.*[/\\]/, '')
}

export function joinDirFile(dir: string, fileName: string): string {
  const sep = dir.includes('\\') ? '\\' : '/'
  return `${dir.replace(/[/\\]+$/, '')}${sep}${fileName}`
}

export function replaceFileExtension(fileName: string, extWithDot: string): string {
  return fileName.replace(/\.[^/.\\]+$/, '') + extWithDot
}

export function stemFromPath(p: string): string {
  const base = fileNameFromPath(p)
  return base.replace(/\.[^/.\\]+$/, '')
}

export function fileExtensionLower(filePath: string): string | null {
  const seg = filePath.replace(/\\/g, '/').split('/').pop() ?? ''
  if (!seg || seg === '.' || seg === '..') return null
  const dot = seg.lastIndexOf('.')
  if (dot <= 0 || dot === seg.length - 1) return null
  return seg.slice(dot + 1).toLowerCase()
}

export function queuePathKey(p: string): string {
  return p.replace(/\//g, '\\').toLowerCase()
}

export const ABSOLUTE_LOCAL_PATH_REQUIRED_VI =
  'Đường dẫn tệp không phải đường dẫn tuyệt đối trên máy (Windows: dạng C:\\… hoặc \\\\?\\…; POSIX: /…).'
