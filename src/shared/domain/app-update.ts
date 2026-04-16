export type AppUpdateEvent =
  | { type: 'checking' }
  | { type: 'update-available'; version: string }
  | { type: 'update-not-available'; version: string }
  | {
      type: 'download-progress'
      percent: number
      transferred: number
      total: number
    }
  | { type: 'update-downloaded'; version: string }
  | { type: 'error'; message: string }

export type AppUpdateCheckResult =
  | { ok: true }
  | { ok: true; skipped: 'not_packaged' }
  | { ok: false; message: string }

export type AppUpdateInstallResult = { ok: true } | { ok: false; reason: 'not_packaged' }
