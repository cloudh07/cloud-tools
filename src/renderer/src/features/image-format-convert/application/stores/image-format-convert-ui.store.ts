import { buildOutputPathForConvert } from '@/features/image-format-convert/application/image-format-convert-paths'
import type { ImageFormatTarget } from '@shared/domain/image-format-convert'
import { create } from 'zustand'

export type ImageFormatConvertQueueItem = {
  localId: string
  inputPath: string
  outputPath: string
}

type ImageFormatConvertUiSlice = {
  outputFolder: string | null
  batchZipSourceFolder: string | null
  outputFormat: ImageFormatTarget
  keepMetadata: boolean
  autoRename: boolean
  overwrite: boolean
  convertWholeQueue: boolean
  zipOutput: boolean
  jpegQuality: number
  webpQuality: number
  avifQuality: number
  pngCompressionLevel: number
  queue: ImageFormatConvertQueueItem[]
  selectedLocalId: string | null
  isScanningFolder: boolean
}

type ImageFormatConvertUiState = ImageFormatConvertUiSlice & {
  resetSession: () => void
  setOutputFolder: (p: string | null) => void
  setOutputFormat: (f: ImageFormatTarget) => void
  setKeepMetadata: (v: boolean) => void
  setAutoRename: (v: boolean) => void
  setOverwrite: (v: boolean) => void
  setConvertWholeQueue: (v: boolean) => void
  setZipOutput: (v: boolean) => void
  setJpegQuality: (n: number) => void
  setWebpQuality: (n: number) => void
  setAvifQuality: (n: number) => void
  setPngCompressionLevel: (n: number) => void
  setSelected: (localId: string | null) => void
  setIsScanningFolder: (v: boolean) => void
  addPaths: (paths: string[], options?: { scannedRoot?: string | null }) => void
  clearQueue: () => void
  removeItem: (localId: string) => void
  rebuildOutputPaths: () => void
}

function initialUiSlice(): ImageFormatConvertUiSlice {
  return {
    outputFolder: null,
    batchZipSourceFolder: null,
    outputFormat: 'webp',
    keepMetadata: true,
    autoRename: true,
    overwrite: false,
    convertWholeQueue: true,
    zipOutput: false,
    jpegQuality: 92,
    webpQuality: 85,
    avifQuality: 50,
    pngCompressionLevel: 6,
    queue: [],
    selectedLocalId: null,
    isScanningFolder: false
  }
}

export const useImageFormatConvertUiStore = create<ImageFormatConvertUiState>((set, get) => ({
  ...initialUiSlice(),
  resetSession: () => set(initialUiSlice()),
  setOutputFolder: (outputFolder) => {
    set({ outputFolder })
    get().rebuildOutputPaths()
  },
  setOutputFormat: (outputFormat) => {
    set({ outputFormat })
    get().rebuildOutputPaths()
  },
  setKeepMetadata: (keepMetadata) => set({ keepMetadata }),
  setAutoRename: (autoRename) => {
    set({ autoRename })
    get().rebuildOutputPaths()
  },
  setOverwrite: (overwrite) => set({ overwrite }),
  setConvertWholeQueue: (convertWholeQueue) => set({ convertWholeQueue }),
  setZipOutput: (zipOutput) => set({ zipOutput }),
  setJpegQuality: (jpegQuality) => set({ jpegQuality }),
  setWebpQuality: (webpQuality) => set({ webpQuality }),
  setAvifQuality: (avifQuality) => set({ avifQuality }),
  setPngCompressionLevel: (pngCompressionLevel) => set({ pngCompressionLevel }),
  setSelected: (selectedLocalId) => set({ selectedLocalId }),
  setIsScanningFolder: (isScanningFolder) => set({ isScanningFolder }),
  rebuildOutputPaths: () => {
    const { outputFolder, outputFormat, autoRename, queue } = get()
    if (!outputFolder?.trim()) {
      set((s) => ({
        queue: s.queue.map((q) => ({ ...q, outputPath: '' }))
      }))
      return
    }
    set({
      queue: queue.map((q) => ({
        ...q,
        outputPath: buildOutputPathForConvert(
          q.inputPath,
          outputFolder.trim(),
          outputFormat,
          autoRename
        )
      }))
    })
  },
  addPaths: (paths, options) => {
    const fromFolderScan = options?.scannedRoot !== undefined
    const root = fromFolderScan ? (options.scannedRoot?.trim() ?? '') : ''
    const batchZipSourceFolder = fromFolderScan ? (root.length > 0 ? root : null) : null

    if (paths.length === 0) {
      if (fromFolderScan) set({ batchZipSourceFolder })
      return
    }

    const existing = new Set(get().queue.map((x) => x.inputPath.toLowerCase()))
    const next: ImageFormatConvertQueueItem[] = []
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
      if (fromFolderScan) set({ batchZipSourceFolder })
      return
    }
    set((s) => ({
      queue: [...s.queue, ...next],
      selectedLocalId: s.selectedLocalId ?? next[0]!.localId,
      batchZipSourceFolder
    }))
    get().rebuildOutputPaths()
  },
  clearQueue: () => {
    set({ queue: [], selectedLocalId: null, batchZipSourceFolder: null })
    get().rebuildOutputPaths()
  },
  removeItem: (localId) => {
    set((s) => {
      const next = s.queue.filter((x) => x.localId !== localId)
      const selectedLocalId =
        s.selectedLocalId === localId ? (next[0]?.localId ?? null) : s.selectedLocalId
      return { queue: next, selectedLocalId }
    })
    get().rebuildOutputPaths()
  }
}))
