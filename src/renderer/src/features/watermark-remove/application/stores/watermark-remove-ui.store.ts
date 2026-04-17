import { create } from 'zustand'

import { buildRemoveOutputPath } from '@/features/watermark-remove/application/watermark-remove-paths'
import type {
  MaskKeyframe,
  MaskShape,
  WatermarkRemoveEngine,
  WatermarkRemoveImageFormat,
  WatermarkRemoveImageOptions,
  WatermarkRemoveMediaKind,
  WatermarkRemoveProbeResult,
  WatermarkRemoveSpec,
  WatermarkRemoveVideoCodec,
  WatermarkRemoveVideoOptions
} from '@shared/domain/watermark-remove'

export type WatermarkRemoveQueueItem = {
  localId: string
  inputPath: string
  outputPath: string
  mediaKind: WatermarkRemoveMediaKind
  width: number | null
  height: number | null
  durationSec: number | null
}

export type EditorTool = 'rectangle' | 'brush' | 'polygon' | 'eraser'

type Slice = {
  outputFolder: string | null
  imageOptions: WatermarkRemoveImageOptions
  videoOptions: WatermarkRemoveVideoOptions
  engine: WatermarkRemoveEngine
  temporalSmooth: boolean
  temporalAlpha: number
  canvasWidth: number
  canvasHeight: number
  brushRadius: number
  maskFeather: number
  activeTool: EditorTool
  keyframes: MaskKeyframe[]
  activeKeyframeId: string | null
  playheadSec: number
  queue: WatermarkRemoveQueueItem[]
  selectedLocalId: string | null
  isLoadingMedia: boolean
}

type State = Slice & {
  resetSession: () => void
  setOutputFolder: (p: string | null) => void
  setImageOption: <K extends keyof WatermarkRemoveImageOptions>(
    key: K,
    value: WatermarkRemoveImageOptions[K]
  ) => void
  setVideoOption: <K extends keyof WatermarkRemoveVideoOptions>(
    key: K,
    value: WatermarkRemoveVideoOptions[K]
  ) => void
  setEngine: (engine: WatermarkRemoveEngine) => void
  setTemporalSmooth: (v: boolean) => void
  setTemporalAlpha: (v: number) => void
  setCanvasSize: (w: number, h: number) => void
  setBrushRadius: (v: number) => void
  setMaskFeather: (v: number) => void
  setActiveTool: (tool: EditorTool) => void
  setActiveKeyframe: (id: string | null) => void
  setPlayhead: (sec: number) => void
  addKeyframeAt: (timeSec: number, shapes?: MaskShape[]) => string
  removeKeyframe: (id: string) => void
  moveKeyframe: (id: string, timeSec: number) => void
  pushShape: (keyframeId: string, shape: MaskShape) => void
  replaceShapes: (keyframeId: string, shapes: MaskShape[]) => void
  popShape: (keyframeId: string) => void
  clearShapes: (keyframeId: string) => void
  addProbedFiles: (files: Array<{ inputPath: string; probe: WatermarkRemoveProbeResult }>) => void
  removeItem: (localId: string) => void
  clearQueue: () => void
  setSelected: (localId: string | null) => void
  setIsLoadingMedia: (v: boolean) => void
  rebuildOutputPaths: () => void
  buildSpec: () => WatermarkRemoveSpec
}

const DEFAULT_CANVAS_W = 960
const DEFAULT_CANVAS_H = 540

function emptyKeyframe(time = 0): MaskKeyframe {
  return { id: crypto.randomUUID(), time, shapes: [] }
}

function initialSlice(): Slice {
  const seed = emptyKeyframe(0)
  return {
    outputFolder: null,
    imageOptions: {
      outputFormat: 'keep',
      jpegQuality: 92,
      webpQuality: 85,
      pngCompressionLevel: 6,
      autoRename: true,
      overwrite: false,
      keepMetadata: true
    },
    videoOptions: {
      videoCodec: 'h264',
      crf: 20,
      preset: 'medium',
      copyAudio: true,
      autoRename: true,
      overwrite: false
    },
    engine: 'classical',
    temporalSmooth: false,
    temporalAlpha: 0.65,
    canvasWidth: DEFAULT_CANVAS_W,
    canvasHeight: DEFAULT_CANVAS_H,
    brushRadius: 24,
    maskFeather: 4,
    activeTool: 'rectangle',
    keyframes: [seed],
    activeKeyframeId: seed.id,
    playheadSec: 0,
    queue: [],
    selectedLocalId: null,
    isLoadingMedia: false
  }
}

export const useWatermarkRemoveUiStore = create<State>((set, get) => ({
  ...initialSlice(),
  resetSession: () => set(initialSlice()),
  setOutputFolder: (outputFolder) => {
    set({ outputFolder })
    get().rebuildOutputPaths()
  },
  setImageOption: (key, value) =>
    set((s) => {
      const next: WatermarkRemoveImageOptions = { ...s.imageOptions, [key]: value }
      return { imageOptions: next }
    }),
  setVideoOption: (key, value) =>
    set((s) => {
      const next: WatermarkRemoveVideoOptions = { ...s.videoOptions, [key]: value }
      return { videoOptions: next }
    }),
  setEngine: (engine) => set({ engine }),
  setTemporalSmooth: (temporalSmooth) => set({ temporalSmooth }),
  setTemporalAlpha: (temporalAlpha) => set({ temporalAlpha }),
  setCanvasSize: (canvasWidth, canvasHeight) => set({ canvasWidth, canvasHeight }),
  setBrushRadius: (brushRadius) => set({ brushRadius }),
  setMaskFeather: (maskFeather) => set({ maskFeather }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setActiveKeyframe: (activeKeyframeId) => set({ activeKeyframeId }),
  setPlayhead: (playheadSec) => set({ playheadSec: Math.max(0, playheadSec) }),
  addKeyframeAt: (timeSec, shapes = []) => {
    const id = crypto.randomUUID()
    set((s) => ({
      keyframes: [...s.keyframes, { id, time: Math.max(0, timeSec), shapes }].sort(
        (a, b) => a.time - b.time
      ),
      activeKeyframeId: id
    }))
    return id
  },
  removeKeyframe: (id) =>
    set((s) => {
      if (s.keyframes.length === 1) return s
      const next = s.keyframes.filter((k) => k.id !== id)
      return {
        keyframes: next,
        activeKeyframeId: s.activeKeyframeId === id ? next[0]!.id : s.activeKeyframeId
      }
    }),
  moveKeyframe: (id, timeSec) =>
    set((s) => ({
      keyframes: s.keyframes
        .map((k) => (k.id === id ? { ...k, time: Math.max(0, timeSec) } : k))
        .sort((a, b) => a.time - b.time)
    })),
  pushShape: (keyframeId, shape) =>
    set((s) => ({
      keyframes: s.keyframes.map((k) =>
        k.id === keyframeId ? { ...k, shapes: [...k.shapes, shape] } : k
      )
    })),
  replaceShapes: (keyframeId, shapes) =>
    set((s) => ({
      keyframes: s.keyframes.map((k) => (k.id === keyframeId ? { ...k, shapes } : k))
    })),
  popShape: (keyframeId) =>
    set((s) => ({
      keyframes: s.keyframes.map((k) =>
        k.id === keyframeId && k.shapes.length > 0 ? { ...k, shapes: k.shapes.slice(0, -1) } : k
      )
    })),
  clearShapes: (keyframeId) =>
    set((s) => ({
      keyframes: s.keyframes.map((k) => (k.id === keyframeId ? { ...k, shapes: [] } : k))
    })),
  addProbedFiles: (files) => {
    if (files.length === 0) return
    const existing = new Set(get().queue.map((x) => x.inputPath.toLowerCase()))
    const next: WatermarkRemoveQueueItem[] = []
    for (const file of files) {
      const key = file.inputPath.toLowerCase()
      if (existing.has(key)) continue
      existing.add(key)
      next.push({
        localId: crypto.randomUUID(),
        inputPath: file.inputPath,
        outputPath: '',
        mediaKind: file.probe.mediaKind,
        width: file.probe.width || null,
        height: file.probe.height || null,
        durationSec: file.probe.durationSec
      })
    }
    if (next.length === 0) return
    set((s) => {
      const first = next[0]!
      const newSelected = s.selectedLocalId ?? first.localId
      const updates: Partial<Slice> = {
        queue: [...s.queue, ...next],
        selectedLocalId: newSelected
      }
      if (!s.selectedLocalId && first.width && first.height) {
        updates.canvasWidth = first.width
        updates.canvasHeight = first.height
      }
      return updates as Slice
    })
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
  clearQueue: () => {
    set({ queue: [], selectedLocalId: null })
  },
  setSelected: (selectedLocalId) => {
    set((s) => {
      if (!selectedLocalId) return { selectedLocalId }
      const item = s.queue.find((x) => x.localId === selectedLocalId)
      if (!item || !item.width || !item.height) return { selectedLocalId }
      return { selectedLocalId, canvasWidth: item.width, canvasHeight: item.height, playheadSec: 0 }
    })
  },
  setIsLoadingMedia: (isLoadingMedia) => set({ isLoadingMedia }),
  rebuildOutputPaths: () => {
    const s = get()
    const folder = s.outputFolder?.trim()
    if (!folder) {
      set((p) => ({ queue: p.queue.map((q) => ({ ...q, outputPath: '' })) }))
      return
    }
    set((p) => ({
      queue: p.queue.map((q) => ({
        ...q,
        outputPath: buildRemoveOutputPath({
          inputPath: q.inputPath,
          outputFolder: folder,
          kind: q.mediaKind,
          imageFormat: s.imageOptions.outputFormat,
          videoCodec: s.videoOptions.videoCodec,
          autoRename:
            q.mediaKind === 'image' ? s.imageOptions.autoRename : s.videoOptions.autoRename
        })
      }))
    }))
  },
  buildSpec: (): WatermarkRemoveSpec => {
    const s = get()
    const selected = s.queue.find((q) => q.localId === s.selectedLocalId)
    const mediaKind: WatermarkRemoveMediaKind = selected?.mediaKind ?? 'image'
    return {
      mediaKind,
      engine: s.engine,
      canvasWidth: s.canvasWidth,
      canvasHeight: s.canvasHeight,
      keyframes: s.keyframes,
      temporalSmooth: s.temporalSmooth,
      temporalAlpha: s.temporalAlpha
    }
  }
}))

export type _CodecRef = WatermarkRemoveImageFormat | WatermarkRemoveVideoCodec
