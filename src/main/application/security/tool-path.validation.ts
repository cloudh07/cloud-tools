import type { AppConfig } from '@shared/domain/app-config'
import { defaultAppConfig } from '@shared/domain/app-config'

const MAX_LEN = 2048
const SHELL_METAS = /[<>|&;`$]/

function containsControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f) return true
  }
  return false
}

function containsDisallowedChars(value: string): boolean {
  if (containsControlCharacters(value)) return true
  return SHELL_METAS.test(value)
}

export function assertSafeToolPath(label: string, value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new Error(`${label} cannot be empty`)
  }
  if (trimmed.length > MAX_LEN) {
    throw new Error(`${label} is too long`)
  }
  if (containsDisallowedChars(trimmed)) {
    throw new Error(`${label} contains disallowed characters`)
  }
  return trimmed
}

export function assertSafeOptionalToolPath(label: string, value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) return ''
  return assertSafeToolPath(label, trimmed)
}

export function sanitizeAppConfig(cfg: AppConfig): AppConfig {
  try {
    return {
      ffmpegPath: assertSafeToolPath('ffmpegPath', cfg.ffmpegPath),
      ffprobePath: assertSafeOptionalToolPath('ffprobePath', cfg.ffprobePath ?? '')
    }
  } catch {
    return defaultAppConfig()
  }
}
