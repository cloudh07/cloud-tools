import { create } from 'zustand'

import type {
  DocumentImageDescriptor,
  DocumentImageRejection,
  DocumentMargin,
  DocumentMergeEvent,
  DocumentMergeMode,
  DocumentMergeProgressPhase,
  DocumentOrientation,
  DocumentOutputFormat,
  DocumentPageSize,
  DocumentPdfDescriptor,
  ImageFit,
  PageSettings
} from '@shared/domain/image-document-merge'
import { DOCUMENT_MERGE_LIMITS } from '@shared/domain/image-document-merge'

export type DocumentMergeQueueItem = DocumentImageDescriptor & {
  localId: string
  thumbnailDataUrl: string | null
}

type JobState = {
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  jobId: string | null
  phase: DocumentMergeProgressPhase
  progress: number
  currentIndex: number
  error: string | null
  resultPath: string | null
  pageCount: number | null
}

type State = {
  mode: DocumentMergeMode
  outputFormat: DocumentOutputFormat
  basePdf: DocumentPdfDescriptor | null
  outputPath: string | null
  settings: PageSettings
  queue: DocumentMergeQueueItem[]
  rejections: DocumentImageRejection[]
  job: JobState
  setMode: (mode: DocumentMergeMode) => void
  setOutputFormat: (format: DocumentOutputFormat) => void
  setBasePdf: (pdf: DocumentPdfDescriptor | null) => void
  setOutputPath: (path: string | null) => void
  updateSettings: (partial: Partial<PageSettings>) => void
  addImages: (images: DocumentImageDescriptor[]) => string[]
  setThumbnail: (path: string, dataUrl: string) => void
  removeImage: (localId: string) => void
  clearImages: () => void
  moveImage: (fromIndex: number, toIndex: number) => void
  setRejections: (rejections: DocumentImageRejection[]) => void
  beginJob: (jobId: string) => void
  applyEvent: (event: DocumentMergeEvent) => void
  resetJob: () => void
}

function initialJob(): JobState {
  return {
    status: 'idle',
    jobId: null,
    phase: 'validate',
    progress: 0,
    currentIndex: -1,
    error: null,
    resultPath: null,
    pageCount: null
  }
}

export const useImageDocumentMergeStore = create<State>((set, get) => ({
  mode: 'create',
  outputFormat: 'pdf',
  basePdf: null,
  outputPath: null,
  settings: {
    pageSize: 'a4',
    orientation: 'auto',
    margin: 'standard',
    imageFit: 'contain',
    quality: 85
  },
  queue: [],
  rejections: [],
  job: initialJob(),
  setMode: (mode) =>
    set((state) => ({
      mode,
      outputFormat: mode === 'append' ? 'pdf' : state.outputFormat,
      basePdf: mode === 'append' ? state.basePdf : null,
      outputPath: null,
      settings: {
        ...state.settings,
        pageSize: mode === 'append' ? 'a4' : state.settings.pageSize
      },
      job: initialJob()
    })),
  setOutputFormat: (outputFormat) =>
    set((state) => ({
      outputFormat,
      outputPath: null,
      settings: {
        ...state.settings,
        pageSize: outputFormat === 'docx' ? 'a4' : state.settings.pageSize
      }
    })),
  setBasePdf: (basePdf) => set({ basePdf, outputPath: null }),
  setOutputPath: (outputPath) => set({ outputPath }),
  updateSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),
  addImages: (images) => {
    const existing = new Set(get().queue.map((item) => item.path.toLowerCase()))
    let totalBytes = get().queue.reduce((sum, item) => sum + item.sizeBytes, 0)
    let totalCount = get().queue.length
    const added: DocumentMergeQueueItem[] = []
    for (const image of images) {
      const key = image.path.toLowerCase()
      if (existing.has(key)) continue
      if (totalCount >= DOCUMENT_MERGE_LIMITS.maxImages) continue
      if (totalBytes + image.sizeBytes > DOCUMENT_MERGE_LIMITS.maxTotalImageBytes) continue
      existing.add(key)
      totalCount += 1
      totalBytes += image.sizeBytes
      added.push({ ...image, localId: crypto.randomUUID(), thumbnailDataUrl: null })
    }
    if (added.length > 0) set((state) => ({ queue: [...state.queue, ...added] }))
    return added.map((item) => item.path)
  },
  setThumbnail: (path, thumbnailDataUrl) =>
    set((state) => ({
      queue: state.queue.map((item) => (item.path === path ? { ...item, thumbnailDataUrl } : item))
    })),
  removeImage: (localId) =>
    set((state) => ({ queue: state.queue.filter((item) => item.localId !== localId) })),
  clearImages: () => set({ queue: [], rejections: [] }),
  moveImage: (fromIndex, toIndex) =>
    set((state) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= state.queue.length ||
        toIndex >= state.queue.length
      ) {
        return state
      }
      const queue = [...state.queue]
      const [item] = queue.splice(fromIndex, 1)
      if (!item) return state
      queue.splice(toIndex, 0, item)
      return { ...state, queue }
    }),
  setRejections: (rejections) => set({ rejections }),
  beginJob: (jobId) => set({ job: { ...initialJob(), status: 'running', jobId } }),
  applyEvent: (event) =>
    set((state) => {
      if (state.job.jobId && event.jobId !== state.job.jobId) return state
      switch (event.type) {
        case 'started':
          return { ...state, job: { ...state.job, status: 'running', jobId: event.jobId } }
        case 'progress':
          return {
            ...state,
            job: {
              ...state.job,
              status: 'running',
              phase: event.phase,
              progress: event.ratio,
              currentIndex: event.currentIndex
            }
          }
        case 'completed':
          return {
            ...state,
            job: {
              ...state.job,
              status: 'completed',
              progress: 1,
              resultPath: event.outputPath,
              pageCount: event.pageCount
            }
          }
        case 'failed':
          return { ...state, job: { ...state.job, status: 'failed', error: event.message } }
        case 'cancelled':
          return { ...state, job: { ...state.job, status: 'cancelled' } }
        default:
          return state
      }
    }),
  resetJob: () => set({ job: initialJob() })
}))

export type { DocumentMargin, DocumentOrientation, DocumentPageSize, ImageFit }
