import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { AppConfig } from '@shared/domain/app-config'
import { create } from 'zustand'

type SettingsState = {
  config: AppConfig | null
  loaded: boolean
  load: () => Promise<void>
  save: (partial: Partial<AppConfig>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set) => ({
  config: null,
  loaded: false,
  load: async () => {
    const cfg = await getDesktop().getConfig()
    set({ config: cfg, loaded: true })
  },
  save: async (partial) => {
    const next = await getDesktop().setConfig(partial)
    set({ config: next })
  }
}))
