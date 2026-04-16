import type {
  ImageSmartCropOutputFormat,
  SmartCropAspectMode
} from '@shared/domain/image-smart-crop'
import { create } from 'zustand'

export type SmartCropBatchQueueItem = {
  localId: string
  inputPath: string
  outputPath: string
}

type State = {
  sourceFolder: string | null
  outputFolder: string | null
  outputFormat: ImageSmartCropOutputFormat
  aspectMode: SmartCropAspectMode
  paddingRatio: number
  sensitivity: number
  keepAlpha: boolean
  zipOutput: boolean
  queue: SmartCropBatchQueueItem[]
  selectedLocalId: string | null
  resetSession: () => void
  setOutputFolder: (p: string | null) => void
  setOutputFormat: (f: ImageSmartCropOutputFormat) => void
  setAspectMode: (m: SmartCropAspectMode) => void
  setPaddingRatio: (n: number) => void
  setSensitivity: (n: number) => void
  setKeepAlpha: (v: boolean) => void
  setZipOutput: (v: boolean) => void
  setSelected: (localId: string | null) => void
  addPaths: (paths: string[], options?: { scannedRoot?: string | null }) => void
  clearQueue: () => void
  removeItem: (localId: string) => void
}

const defaultState = (): Omit<
  State,
  | 'resetSession'
  | 'setOutputFolder'
  | 'setOutputFormat'
  | 'setAspectMode'
  | 'setPaddingRatio'
  | 'setSensitivity'
  | 'setKeepAlpha'
  | 'setZipOutput'
  | 'setSelected'
  | 'addPaths'
  | 'clearQueue'
  | 'removeItem'
> => ({
  sourceFolder: null,
  outputFolder: null,
  outputFormat: 'png',
  aspectMode: 'free',
  paddingRatio: 0.01,
  sensitivity: 0.55,
  keepAlpha: true,
  zipOutput: true,
  queue: [],
  selectedLocalId: null
})

export const useImageSmartCropBatchUiStore = create<State>((set, get) => ({
  ...defaultState(),
  resetSession: () => set(defaultState()),
  setOutputFolder: (outputFolder) => set({ outputFolder }),
  setOutputFormat: (outputFormat) => set({ outputFormat }),
  setAspectMode: (aspectMode) => set({ aspectMode }),
  setPaddingRatio: (paddingRatio) => set({ paddingRatio }),
  setSensitivity: (sensitivity) => set({ sensitivity }),
  setKeepAlpha: (keepAlpha) => set({ keepAlpha }),
  setZipOutput: (zipOutput) => set({ zipOutput }),
  setSelected: (selectedLocalId) => set({ selectedLocalId }),
  addPaths: (paths, options) => {
    const fromFolderScan = options?.scannedRoot !== undefined
    const root = fromFolderScan ? (options.scannedRoot?.trim() ?? '') : ''
    const sourceFolder = fromFolderScan ? (root.length > 0 ? root : null) : null

    if (paths.length === 0) {
      if (fromFolderScan) set({ sourceFolder })
      return
    }

    const existing = new Set(get().queue.map((x) => x.inputPath.toLowerCase()))
    const next: SmartCropBatchQueueItem[] = []
    for (const p of paths) {
      const key = p.toLowerCase()
      if (existing.has(key)) continue
      existing.add(key)
      next.push({
        localId: crypto.randomUUID(),
        inputPath: p,
        outputPath: ''
      })
    }
    if (next.length === 0) {
      if (fromFolderScan) set({ sourceFolder })
      return
    }
    set((s) => ({
      queue: [...s.queue, ...next],
      selectedLocalId: s.selectedLocalId ?? next[0]!.localId,
      sourceFolder
    }))
  },
  clearQueue: () => set({ queue: [], selectedLocalId: null, sourceFolder: null }),
  removeItem: (localId) =>
    set((s) => {
      const next = s.queue.filter((x) => x.localId !== localId)
      const selectedLocalId =
        s.selectedLocalId === localId ? (next[0]?.localId ?? null) : s.selectedLocalId
      return { queue: next, selectedLocalId }
    })
}))
