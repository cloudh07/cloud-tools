function pathSeparator(p: string): '\\' | '/' {
  return p.includes('\\') ? '\\' : '/'
}

function parseVideoOutputPath(userOutput: string): { dir: string; ext: string; stem: string } {
  const lastSep = Math.max(userOutput.lastIndexOf('/'), userOutput.lastIndexOf('\\'))
  const dir = lastSep === -1 ? '' : userOutput.slice(0, lastSep)
  const filename = lastSep === -1 ? userOutput : userOutput.slice(lastSep + 1)
  const lastDot = filename.lastIndexOf('.')
  const ext = lastDot > 0 ? filename.slice(lastDot) : ''
  const stem = ext ? filename.slice(0, lastDot) : filename
  return { dir, ext, stem }
}

function joinDirFile(dir: string, file: string, sep: '\\' | '/'): string {
  if (!dir) return file
  const trimmed = dir.replace(/[/\\]+$/, '')
  return `${trimmed}${sep}${file}`
}

export function buildChromaStagingVideoPath(userOutput: string, jobId: string): string {
  const sep = pathSeparator(userOutput)
  const { dir, ext, stem } = parseVideoOutputPath(userOutput)
  return joinDirFile(dir, `${stem}.chroma-staging-${jobId}${ext}`, sep)
}

export function buildChromaEnhancePartialVideoPath(userOutput: string, jobId: string): string {
  const sep = pathSeparator(userOutput)
  const { dir, ext, stem } = parseVideoOutputPath(userOutput)
  return joinDirFile(dir, `${stem}.enhance-partial-${jobId}${ext}`, sep)
}
