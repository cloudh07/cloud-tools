import type { AppUpdateEvent } from '@shared/domain/app-update'
import { create } from 'zustand'

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'failed'

type State = {
  phase: UpdatePhase
  version: string | null
  downloadPercent: number
  errorMessage: string | null
  applyEvent: (ev: AppUpdateEvent) => void
  markInstalling: () => void
  reset: () => void
}

const initial = (): Pick<State, 'phase' | 'version' | 'downloadPercent' | 'errorMessage'> => ({
  phase: 'idle',
  version: null,
  downloadPercent: 0,
  errorMessage: null
})

export const useAppUpdateUiStore = create<State>((set) => ({
  ...initial(),
  applyEvent: (ev) => {
    switch (ev.type) {
      case 'checking':
        set({ phase: 'checking', errorMessage: null })
        return
      case 'update-available':
        set({
          phase: 'update-available',
          version: ev.version,
          downloadPercent: 0,
          errorMessage: null
        })
        return
      case 'update-not-available':
        set(initial())
        return
      case 'download-progress':
        set({ phase: 'downloading', downloadPercent: Math.round(ev.percent) })
        return
      case 'update-downloaded':
        set({ phase: 'downloaded', version: ev.version, downloadPercent: 100, errorMessage: null })
        return
      case 'error':
        set({ phase: 'failed', errorMessage: ev.message })
        return
      default:
        return
    }
  },
  markInstalling: () => set({ phase: 'installing' }),
  reset: () => set(initial())
}))

export function selectShowUpdateIcon(s: State): boolean {
  return (
    s.phase === 'update-available' ||
    s.phase === 'downloading' ||
    s.phase === 'downloaded' ||
    s.phase === 'failed'
  )
}

export const selectAppUpdateSidebarIconVisible = selectShowUpdateIcon
