import { buildOutputPathForWatermark } from '@/features/image-watermark/application/image-watermark-paths'
import type {
  ImageWatermarkImageSource,
  ImageWatermarkSource,
  ImageWatermarkSpec,
  ImageWatermarkTextSource,
  WatermarkAnchorPosition,
  WatermarkLayout,
  WatermarkOutputFormat
} from '@shared/domain/image-watermark'
import { create } from 'zustand'

export type ImageWatermarkQueueItem = {
  localId: string
  inputPath: string
  outputPath: string
}

export type WatermarkSourceKind = ImageWatermarkSource['kind']

type ImageWatermarkUiSlice = {
  outputFolder: string | null
  batchZipSourceFolder: string | null
  outputFormat: WatermarkOutputFormat
  jpegQuality: number
  webpQuality: number
  pngCompressionLevel: number
  keepMetadata: boolean
  autoRename: boolean
  overwrite: boolean
  zipOutput: boolean
  processWholeQueue: boolean
  sourceKind: WatermarkSourceKind
  imageSource: ImageWatermarkImageSource
  textSource: ImageWatermarkTextSource
  layout: WatermarkLayout
  opacity: number
  rotationDeg: number
  scalePercent: number
  marginPercent: number
  anchorPosition: WatermarkAnchorPosition
  anchorOffsetX: number
  anchorOffsetY: number
  tileSpacingX: number
  tileSpacingY: number
  tileStaggerOddRows: boolean
  queue: ImageWatermarkQueueItem[]
  selectedLocalId: string | null
  isScanningFolder: boolean
}

type ImageWatermarkUiState = ImageWatermarkUiSlice & {
  resetSession: () => void
  setOutputFolder: (p: string | null) => void
  setOutputFormat: (f: WatermarkOutputFormat) => void
  setJpegQuality: (n: number) => void
  setWebpQuality: (n: number) => void
  setPngCompressionLevel: (n: number) => void
  setKeepMetadata: (v: boolean) => void
  setAutoRename: (v: boolean) => void
  setOverwrite: (v: boolean) => void
  setZipOutput: (v: boolean) => void
  setProcessWholeQueue: (v: boolean) => void
  setSourceKind: (k: WatermarkSourceKind) => void
  setImageSource: (partial: Partial<ImageWatermarkImageSource>) => void
  setTextSource: (partial: Partial<ImageWatermarkTextSource>) => void
  setLayout: (l: WatermarkLayout) => void
  setOpacity: (n: number) => void
  setRotationDeg: (n: number) => void
  setScalePercent: (n: number) => void
  setMarginPercent: (n: number) => void
  setAnchorPosition: (p: WatermarkAnchorPosition) => void
  setAnchorOffsetX: (n: number) => void
  setAnchorOffsetY: (n: number) => void
  setTileSpacingX: (n: number) => void
  setTileSpacingY: (n: number) => void
  setTileStaggerOddRows: (v: boolean) => void
  setSelected: (localId: string | null) => void
  setIsScanningFolder: (v: boolean) => void
  addPaths: (paths: string[], options?: { scannedRoot?: string | null }) => void
  clearQueue: () => void
  removeItem: (localId: string) => void
  rebuildOutputPaths: () => void
  buildSpec: () => ImageWatermarkSpec
}

function initialUiSlice(): ImageWatermarkUiSlice {
  return {
    outputFolder: null,
    batchZipSourceFolder: null,
    outputFormat: 'keep',
    jpegQuality: 92,
    webpQuality: 85,
    pngCompressionLevel: 6,
    keepMetadata: true,
    autoRename: true,
    overwrite: false,
    zipOutput: false,
    processWholeQueue: true,
    sourceKind: 'text',
    imageSource: { kind: 'image', logoPath: '' },
    textSource: {
      kind: 'text',
      text: '© Cloud Tools',
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontWeight: 700,
      fontSizePercent: 6,
      colorHex: '#ffffff',
      strokeColorHex: '#000000',
      strokeWidthPx: 2
    },
    layout: 'anchor',
    opacity: 0.7,
    rotationDeg: 0,
    scalePercent: 25,
    marginPercent: 3,
    anchorPosition: 'bottom-right',
    anchorOffsetX: 0,
    anchorOffsetY: 0,
    tileSpacingX: 30,
    tileSpacingY: 30,
    tileStaggerOddRows: true,
    queue: [],
    selectedLocalId: null,
    isScanningFolder: false
  }
}

export const useImageWatermarkUiStore = create<ImageWatermarkUiState>((set, get) => ({
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
  setJpegQuality: (jpegQuality) => set({ jpegQuality }),
  setWebpQuality: (webpQuality) => set({ webpQuality }),
  setPngCompressionLevel: (pngCompressionLevel) => set({ pngCompressionLevel }),
  setKeepMetadata: (keepMetadata) => set({ keepMetadata }),
  setAutoRename: (autoRename) => {
    set({ autoRename })
    get().rebuildOutputPaths()
  },
  setOverwrite: (overwrite) => set({ overwrite }),
  setZipOutput: (zipOutput) => set({ zipOutput }),
  setProcessWholeQueue: (processWholeQueue) => set({ processWholeQueue }),
  setSourceKind: (sourceKind) => set({ sourceKind }),
  setImageSource: (partial) => set((s) => ({ imageSource: { ...s.imageSource, ...partial } })),
  setTextSource: (partial) => set((s) => ({ textSource: { ...s.textSource, ...partial } })),
  setLayout: (layout) => set({ layout }),
  setOpacity: (opacity) => set({ opacity }),
  setRotationDeg: (rotationDeg) => set({ rotationDeg }),
  setScalePercent: (scalePercent) => set({ scalePercent }),
  setMarginPercent: (marginPercent) => set({ marginPercent }),
  setAnchorPosition: (anchorPosition) => set({ anchorPosition }),
  setAnchorOffsetX: (anchorOffsetX) => set({ anchorOffsetX }),
  setAnchorOffsetY: (anchorOffsetY) => set({ anchorOffsetY }),
  setTileSpacingX: (tileSpacingX) => set({ tileSpacingX }),
  setTileSpacingY: (tileSpacingY) => set({ tileSpacingY }),
  setTileStaggerOddRows: (tileStaggerOddRows) => set({ tileStaggerOddRows }),
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
        outputPath: buildOutputPathForWatermark(
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
    const next: ImageWatermarkQueueItem[] = []
    for (const p of paths) {
      const key = p.toLowerCase()
      if (existing.has(key)) continue
      existing.add(key)
      next.push({ localId: crypto.randomUUID(), inputPath: p, outputPath: '' })
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
  },
  buildSpec: (): ImageWatermarkSpec => {
    const s = get()
    const source: ImageWatermarkSource = s.sourceKind === 'image' ? s.imageSource : s.textSource
    return {
      source,
      layout: s.layout,
      common: {
        opacity: s.opacity,
        rotationDeg: s.rotationDeg,
        scalePercent: s.scalePercent,
        marginPercent: s.marginPercent
      },
      anchor: {
        position: s.anchorPosition,
        offsetXpx: s.anchorOffsetX,
        offsetYpx: s.anchorOffsetY
      },
      tile: {
        spacingXpercent: s.tileSpacingX,
        spacingYpercent: s.tileSpacingY,
        staggerOddRows: s.tileStaggerOddRows
      }
    }
  }
}))
