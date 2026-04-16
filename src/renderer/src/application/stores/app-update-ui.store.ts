import type { AppUpdateEvent } from '@shared/domain/app-update'
import { create } from 'zustand'

type State = {
  incomingVersion: string | null
  readyInstallVersion: string | null
  downloadPercent: number | null
  lastHint: string | null
  lastError: string | null
  applyEvent: (ev: AppUpdateEvent) => void
  reset: () => void
}

const initial = (): Pick<
  State,
  'incomingVersion' | 'readyInstallVersion' | 'downloadPercent' | 'lastHint' | 'lastError'
> => ({
  incomingVersion: null,
  readyInstallVersion: null,
  downloadPercent: null,
  lastHint: null,
  lastError: null
})

export const useAppUpdateUiStore = create<State>((set) => ({
  ...initial(),
  applyEvent: (ev) => {
    switch (ev.type) {
      case 'checking':
        set({ lastHint: 'Đang kiểm tra máy chủ cập nhật…', lastError: null })
        return
      case 'update-available':
        set({
          incomingVersion: ev.version,
          readyInstallVersion: null,
          downloadPercent: 0,
          lastHint: `Phiên bản ${ev.version} - đang tải…`,
          lastError: null
        })
        return
      case 'update-not-available':
        set({
          ...initial(),
          lastHint: `Ứng dụng đã ở bản mới nhất (${ev.version}).`
        })
        return
      case 'download-progress':
        set({
          downloadPercent: ev.percent,
          lastError: null
        })
        return
      case 'update-downloaded':
        set({
          incomingVersion: null,
          readyInstallVersion: ev.version,
          downloadPercent: null,
          lastHint: 'Đã tải xong. Khởi động lại để áp dụng.',
          lastError: null
        })
        return
      case 'error':
        set({ lastError: ev.message })
        return
      default:
        return
    }
  },
  reset: () => set(initial())
}))

export function selectAppUpdateSidebarIconVisible(s: State): boolean {
  if (s.readyInstallVersion != null) return true
  if (s.incomingVersion != null) return true
  if (s.downloadPercent != null && s.downloadPercent < 100) return true
  return false
}
