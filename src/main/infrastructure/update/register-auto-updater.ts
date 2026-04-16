import { type BrowserWindow, app, ipcMain } from 'electron'
import { autoUpdater, type UpdateDownloadedEvent } from 'electron-updater'

import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppUpdateEvent } from '@shared/domain/app-update'

let ipcHandlersRegistered = false

function broadcast(getWindow: () => BrowserWindow | null, payload: AppUpdateEvent): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(IpcChannels.APP_UPDATE_EVENT, payload)
}

function registerIpcOnce(): void {
  if (ipcHandlersRegistered) return
  ipcHandlersRegistered = true

  ipcMain.handle(IpcChannels.APP_UPDATE_CHECK, async () => {
    if (!app.isPackaged) {
      return { ok: true as const, skipped: 'not_packaged' as const }
    }
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true as const }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false as const, message }
    }
  })

  ipcMain.handle(IpcChannels.APP_UPDATE_INSTALL, () => {
    if (!app.isPackaged) {
      return { ok: false as const, reason: 'not_packaged' as const }
    }
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true)
    })
    return { ok: true as const }
  })
}

export function registerAutoUpdater(getWindow: () => BrowserWindow | null): void {
  registerIpcOnce()

  if (!app.isPackaged) return

  autoUpdater.autoDownload = true

  autoUpdater.on('checking-for-update', () => {
    broadcast(getWindow, { type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast(getWindow, { type: 'update-available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    broadcast(getWindow, { type: 'update-not-available', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater]', err)
    broadcast(getWindow, {
      type: 'error',
      message: err instanceof Error ? err.message : String(err)
    })
  })

  autoUpdater.on('download-progress', (p) => {
    broadcast(getWindow, {
      type: 'download-progress',
      percent: Math.round(p.percent),
      transferred: p.transferred,
      total: p.total
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateDownloadedEvent) => {
    broadcast(getWindow, { type: 'update-downloaded', version: info.version })
  })

  void autoUpdater.checkForUpdates()
}
