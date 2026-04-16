import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { app } from 'electron'
import type { AppConfig } from '@shared/domain/app-config'
import type { ResolvedMediaBinary } from '@shared/domain/media-binary'
import { MediaBinaryNotFoundError } from '@shared/domain/media-binary'

const ENV_FFMPEG = ['CLOUD_TOOLS_FFMPEG_PATH', 'FFMPEG_PATH'] as const
const ENV_FFPROBE = ['CLOUD_TOOLS_FFPROBE_PATH', 'FFPROBE_PATH'] as const

function bundledBinRoot(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'ffmpeg-bin')
  }
  return join(__dirname, '../../resources/ffmpeg-bin')
}

function platformSubdir(): string {
  if (process.platform === 'win32') return 'win'
  if (process.platform === 'darwin') return 'darwin'
  return 'linux'
}

function ffmpegFilename(): string {
  return process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
}

function ffprobeFilename(): string {
  return process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
}

function tryBundled(name: 'ffmpeg' | 'ffprobe'): ResolvedMediaBinary | null {
  const base = join(bundledBinRoot(), platformSubdir())
  const file = join(base, name === 'ffmpeg' ? ffmpegFilename() : ffprobeFilename())
  if (existsSync(file)) {
    return { path: file, source: 'bundled' }
  }
  return null
}

function tryEnv(keys: readonly string[]): ResolvedMediaBinary | null {
  for (const k of keys) {
    const v = process.env[k]?.trim()
    if (v && existsSync(v)) {
      return { path: v, source: 'env' }
    }
  }
  return null
}

function tryPathCommand(commandBase: string): ResolvedMediaBinary | null {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('where.exe', [commandBase], {
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore']
      })
      const line = out
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s.length > 0)
      if (line && existsSync(line)) {
        return { path: line, source: 'path' }
      }
    } else {
      const out = execFileSync('command', ['-v', commandBase], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      })
      const p = out.trim().split('\n')[0]?.trim()
      if (p && existsSync(p)) {
        return { path: p, source: 'path' }
      }
    }
  } catch {
    /* not on PATH */
  }
  return null
}

function siblingFfprobeFromFfmpeg(ffmpegAbs: string): ResolvedMediaBinary | null {
  const lower = ffmpegAbs.toLowerCase()
  const dir = dirname(ffmpegAbs)
  let probe: string
  if (lower.endsWith('ffmpeg.exe')) {
    probe = join(dir, 'ffprobe.exe')
  } else if (lower.endsWith('/ffmpeg') || lower.endsWith('\\ffmpeg')) {
    probe = join(dir, 'ffprobe')
  } else {
    probe = join(dir, ffprobeFilename())
  }
  if (existsSync(probe)) {
    return { path: probe, source: 'sibling' }
  }
  return null
}

function trySettingsFfmpeg(cfg: AppConfig): ResolvedMediaBinary | null {
  const p = cfg.ffmpegPath.trim()
  if (p.length === 0 || p === 'ffmpeg') return null
  if (existsSync(p)) {
    return { path: p, source: 'settings' }
  }
  return null
}

function trySettingsFfprobe(cfg: AppConfig): ResolvedMediaBinary | null {
  const p = cfg.ffprobePath.trim()
  if (p.length === 0) return null
  if (existsSync(p)) {
    return { path: p, source: 'settings' }
  }
  return null
}

export class MediaBinaryResolver {
  private cacheKey = ''
  private ffmpeg: ResolvedMediaBinary | null = null
  private ffprobe: ResolvedMediaBinary | null = null

  invalidate(): void {
    this.cacheKey = ''
    this.ffmpeg = null
    this.ffprobe = null
  }

  private sync(cfg: AppConfig): void {
    const k = `${cfg.ffmpegPath}|${cfg.ffprobePath}`
    if (k !== this.cacheKey) {
      this.cacheKey = k
      this.ffmpeg = null
      this.ffprobe = null
    }
  }

  resolveFfmpeg(cfg: AppConfig): ResolvedMediaBinary | null {
    this.sync(cfg)
    if (this.ffmpeg && existsSync(this.ffmpeg.path)) {
      return this.ffmpeg
    }
    this.ffmpeg =
      tryBundled('ffmpeg') ??
      tryEnv(ENV_FFMPEG) ??
      tryPathCommand('ffmpeg') ??
      trySettingsFfmpeg(cfg)
    return this.ffmpeg
  }

  resolveFfprobe(cfg: AppConfig): ResolvedMediaBinary | null {
    this.sync(cfg)
    if (this.ffprobe && existsSync(this.ffprobe.path)) {
      return this.ffprobe
    }
    const early = tryBundled('ffprobe') ?? tryEnv(ENV_FFPROBE) ?? tryPathCommand('ffprobe')
    if (early) {
      this.ffprobe = early
      return early
    }
    const ffmpeg = this.resolveFfmpeg(cfg)
    if (ffmpeg) {
      const sib = siblingFfprobeFromFfmpeg(ffmpeg.path)
      if (sib) {
        this.ffprobe = sib
        return sib
      }
    }
    const fromSettings = trySettingsFfprobe(cfg)
    if (fromSettings) {
      this.ffprobe = fromSettings
      return fromSettings
    }
    this.ffprobe = null
    return null
  }

  resolveFfmpegOrThrow(cfg: AppConfig): ResolvedMediaBinary {
    const r = this.resolveFfmpeg(cfg)
    if (!r) throw new MediaBinaryNotFoundError('ffmpeg')
    return r
  }

  resolveFfprobeOrThrow(cfg: AppConfig): ResolvedMediaBinary {
    const r = this.resolveFfprobe(cfg)
    if (!r) throw new MediaBinaryNotFoundError('ffprobe')
    return r
  }
}

let singleton: MediaBinaryResolver | null = null

export function getMediaBinaryResolver(): MediaBinaryResolver {
  if (!singleton) singleton = new MediaBinaryResolver()
  return singleton
}

export function invalidateMediaBinaryResolverCache(): void {
  singleton?.invalidate()
}

export function logMediaBinaryPreflight(cfg: AppConfig): void {
  const r = getMediaBinaryResolver()
  const ff = r.resolveFfmpeg(cfg)
  const fp = r.resolveFfprobe(cfg)
  if (ff) {
    console.info(`[media-binary] ffmpeg ← ${ff.source}: ${ff.path}`)
  } else {
    console.warn(
      '[media-binary] ffmpeg: not resolved (video features need FFmpeg on PATH or bundled)'
    )
  }
  if (fp) {
    console.info(`[media-binary] ffprobe ← ${fp.source}: ${fp.path}`)
  } else {
    console.warn('[media-binary] ffprobe: not resolved')
  }
}
