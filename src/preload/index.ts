import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { GetPathForLocalFileResult } from '@shared/domain/local-file-drop-path'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  StartAudioExtractBatchRequest,
  AudioExtractJobEvent
} from '@shared/domain/audio-extract-job'
import type { StartCompressBatchRequest, CompressJobEvent } from '@shared/domain/compress-job'
import type { FolderDropScanResult } from '@shared/domain/folder-drop-scan'
import type {
  ImageSmartCropJobEvent,
  ImageSmartCropOutputFormat,
  SmartCropAnalyzeRequest,
  StartImageSmartCropJobRequest
} from '@shared/domain/image-smart-crop'
import type {
  ImageFormatConvertBatchEvent,
  ImageFormatProbeResult,
  StartImageFormatConvertBatchRequest
} from '@shared/domain/image-format-convert'
import type {
  ImageWatermarkBatchEvent,
  ImageWatermarkPreviewRequest,
  ImageWatermarkPreviewResult,
  StartImageWatermarkBatchRequest
} from '@shared/domain/image-watermark'
import type {
  StartWatermarkRemoveBatchRequest,
  WatermarkRemoveAutoDetectRequest,
  WatermarkRemoveAutoDetectResult,
  WatermarkRemoveBatchEvent,
  WatermarkRemoveModelEvent,
  WatermarkRemoveModelId,
  WatermarkRemoveModelStatus,
  WatermarkRemovePreviewRequest,
  WatermarkRemovePreviewResult,
  WatermarkRemoveProbeResult
} from '@shared/domain/watermark-remove'
import type {
  ImageSmartCropBatchEvent,
  StartImageSmartCropBatchRequest
} from '@shared/domain/image-smart-crop-batch'
import type {
  StartVideoJobRequest,
  VideoJobEvent,
  VideoProbeResult
} from '@shared/domain/video-job'
import type { AppUpdateEvent } from '@shared/domain/app-update'
import type {
  StartVideoFormatConvertJobRequest,
  VideoFormatConvertJobEvent,
  VideoFormatConvertProbeResult,
  VideoFormatTarget
} from '@shared/domain/video-format-convert'

const shellOpenPath = (filePath: string): Promise<void> =>
  ipcRenderer.invoke(IpcChannels.SHELL_OPEN_EXISTING_FILE, filePath)

const shellOpenDirectory = (dirPath: string): Promise<void> =>
  ipcRenderer.invoke(IpcChannels.SHELL_OPEN_DIRECTORY, dirPath)

const shellRevealFile = (filePath: string): Promise<void> =>
  ipcRenderer.invoke(IpcChannels.SHELL_REVEAL_FILE, filePath)

const isPreloadDebug =
  typeof process !== 'undefined' && process.env && process.env['NODE_ENV'] !== 'production'

const getPathForLocalFile = (file: File): GetPathForLocalFileResult => {
  try {
    if (!(file instanceof File)) {
      const msg = `Expected File, got ${Object.prototype.toString.call(file)}`
      if (isPreloadDebug) console.warn('[preload getPathForLocalFile]', msg)
      return { ok: false, code: 'not_file', message: msg }
    }
    let p: string
    try {
      p = webUtils.getPathForFile(file)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (isPreloadDebug)
        console.warn('[preload getPathForLocalFile] webUtils threw', file.name, msg)
      return { ok: false, code: 'webutils_threw', message: msg }
    }
    if (typeof p !== 'string' || !p.trim()) {
      const msg =
        'webUtils.getPathForFile returned empty (File is often not backed by a real path - e.g. from FileSystemHandle.getFile()).'
      if (isPreloadDebug) {
        console.warn('[preload getPathForLocalFile]', msg, {
          name: file.name,
          size: file.size,
          type: file.type
        })
      }
      return { ok: false, code: 'webutils_empty', message: msg }
    }
    const path = p.trim()
    if (isPreloadDebug) {
      console.debug('[preload getPathForLocalFile] ok', { name: file.name, path })
    }
    return { ok: true, path }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (isPreloadDebug) console.warn('[preload getPathForLocalFile] unknown', msg)
    return { ok: false, code: 'unknown', message: msg }
  }
}

const desktopApi = {
  checkForAppUpdate: () => ipcRenderer.invoke(IpcChannels.APP_UPDATE_CHECK),
  installAppUpdate: () => ipcRenderer.invoke(IpcChannels.APP_UPDATE_INSTALL),
  onAppUpdateEvent: (cb: (event: AppUpdateEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: AppUpdateEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.APP_UPDATE_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.APP_UPDATE_EVENT, listener)
    }
  },
  getConfig: (): Promise<AppConfig> => ipcRenderer.invoke(IpcChannels.CONFIG_GET),
  setConfig: (partial: Partial<AppConfig>): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannels.CONFIG_SET, partial),
  pickMp4: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_MP4),
  pickVideoFiles: (): Promise<string[]> => ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_VIDEOS),
  pickOutputFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_FOLDER),
  getPathForLocalFile,
  scanFolderForDrop: (folderPath: string): Promise<FolderDropScanResult> =>
    ipcRenderer.invoke(IpcChannels.FS_SCAN_FOLDER_FOR_DROP, folderPath),
  pickSavePath: (payload: {
    defaultPath: string
    mode: 'green_screen' | 'alpha_mov' | 'webp'
  }): Promise<string | null> => ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_SAVE, payload),
  probeVideo: (filePath: string): Promise<VideoProbeResult> =>
    ipcRenderer.invoke(IpcChannels.VIDEO_PROBE, filePath),
  probeCompressVideo: (filePath: string): Promise<VideoProbeResult> =>
    ipcRenderer.invoke(IpcChannels.COMPRESS_PROBE, filePath),
  toFileUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.MEDIA_TO_FILE_URL, filePath),
  shellOpenPath,
  shellOpenDirectory,
  shellRevealFile,
  startVideoJob: (req: StartVideoJobRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.VIDEO_START_JOB, req),
  cancelVideoJob: (jobId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.VIDEO_CANCEL_JOB, jobId),
  onVideoJobEvent: (cb: (event: VideoJobEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: VideoJobEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.VIDEO_JOB_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.VIDEO_JOB_EVENT, listener)
    }
  },
  startCompressBatch: (req: StartCompressBatchRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.COMPRESS_START_BATCH, req),
  cancelCompressJob: (jobId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.COMPRESS_CANCEL_JOB, jobId),
  onCompressJobEvent: (cb: (event: CompressJobEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: CompressJobEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.COMPRESS_JOB_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.COMPRESS_JOB_EVENT, listener)
    }
  },
  probeAudioExtract: (filePath: string) =>
    ipcRenderer.invoke(IpcChannels.AUDIO_EXTRACT_PROBE, filePath),
  startAudioExtractBatch: (req: StartAudioExtractBatchRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.AUDIO_EXTRACT_START_BATCH, req),
  cancelAudioExtractJob: (jobId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.AUDIO_EXTRACT_CANCEL_JOB, jobId),
  onAudioExtractJobEvent: (cb: (event: AudioExtractJobEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: AudioExtractJobEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.AUDIO_EXTRACT_JOB_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.AUDIO_EXTRACT_JOB_EVENT, listener)
    }
  },
  pickImageFile: (): Promise<string | null> => ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_IMAGE),
  pickImageFiles: (): Promise<string[]> => ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_IMAGES),
  pickImageSavePath: (payload: {
    defaultPath: string
    format: ImageSmartCropOutputFormat
  }): Promise<string | null> => ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_IMAGE_SAVE, payload),
  analyzeImageSmartCrop: (req: SmartCropAnalyzeRequest) =>
    ipcRenderer.invoke(IpcChannels.IMAGE_SMART_CROP_ANALYZE, req),
  startImageSmartCropJob: (req: StartImageSmartCropJobRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_SMART_CROP_START_JOB, req),
  cancelImageSmartCropJob: (jobId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_SMART_CROP_CANCEL_JOB, jobId),
  onImageSmartCropJobEvent: (cb: (event: ImageSmartCropJobEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: ImageSmartCropJobEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.IMAGE_SMART_CROP_JOB_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.IMAGE_SMART_CROP_JOB_EVENT, listener)
    }
  },
  scanImageSmartCropFolder: (folderPath: string): Promise<string[]> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_SMART_CROP_BATCH_SCAN_FOLDER, folderPath),
  startImageSmartCropBatch: (req: StartImageSmartCropBatchRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_SMART_CROP_BATCH_START, req),
  cancelImageSmartCropBatch: (batchId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_SMART_CROP_BATCH_CANCEL, batchId),
  onImageSmartCropBatchEvent: (cb: (event: ImageSmartCropBatchEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: ImageSmartCropBatchEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.IMAGE_SMART_CROP_BATCH_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.IMAGE_SMART_CROP_BATCH_EVENT, listener)
    }
  },
  probeImageFormat: (inputPath: string): Promise<ImageFormatProbeResult> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_FORMAT_PROBE, inputPath),
  startImageFormatConvertBatch: (req: StartImageFormatConvertBatchRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_FORMAT_CONVERT_START, req),
  cancelImageFormatConvertBatch: (batchId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_FORMAT_CONVERT_CANCEL, batchId),
  onImageFormatConvertBatchEvent: (
    cb: (event: ImageFormatConvertBatchEvent) => void
  ): (() => void) => {
    const listener = (_event: unknown, data: ImageFormatConvertBatchEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.IMAGE_FORMAT_CONVERT_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.IMAGE_FORMAT_CONVERT_EVENT, listener)
    }
  },
  probeVideoFormatConvert: (inputPath: string): Promise<VideoFormatConvertProbeResult> =>
    ipcRenderer.invoke(IpcChannels.VIDEO_FORMAT_CONVERT_PROBE, inputPath),
  startVideoFormatConvertJob: (req: StartVideoFormatConvertJobRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.VIDEO_FORMAT_CONVERT_START, req),
  cancelVideoFormatConvertJob: (jobId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.VIDEO_FORMAT_CONVERT_CANCEL, jobId),
  onVideoFormatConvertJobEvent: (cb: (event: VideoFormatConvertJobEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: VideoFormatConvertJobEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.VIDEO_FORMAT_CONVERT_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.VIDEO_FORMAT_CONVERT_EVENT, listener)
    }
  },
  pickVideoFormatSavePath: (payload: {
    defaultPath: string
    format: VideoFormatTarget
  }): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_VIDEO_FORMAT_SAVE, payload),
  pickWatermarkLogoFile: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.DIALOG_SELECT_WATERMARK_LOGO),
  probeImageWatermark: (inputPath: string): Promise<ImageFormatProbeResult> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_WATERMARK_PROBE, inputPath),
  renderImageWatermarkPreview: (
    req: ImageWatermarkPreviewRequest
  ): Promise<ImageWatermarkPreviewResult> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_WATERMARK_PREVIEW, req),
  startImageWatermarkBatch: (req: StartImageWatermarkBatchRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_WATERMARK_START, req),
  cancelImageWatermarkBatch: (batchId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.IMAGE_WATERMARK_CANCEL, batchId),
  onImageWatermarkBatchEvent: (cb: (event: ImageWatermarkBatchEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: ImageWatermarkBatchEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.IMAGE_WATERMARK_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.IMAGE_WATERMARK_EVENT, listener)
    }
  },
  listSystemFonts: (refresh?: boolean): Promise<string[]> =>
    ipcRenderer.invoke(IpcChannels.FONTS_LIST_INSTALLED, { refresh: refresh === true }),
  pickWatermarkRemoveMedia: (kind: 'image' | 'video'): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_PICK_MEDIA, kind),
  probeWatermarkRemoveMedia: (inputPath: string): Promise<WatermarkRemoveProbeResult> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_PROBE, inputPath),
  renderWatermarkRemovePreview: (
    req: WatermarkRemovePreviewRequest
  ): Promise<WatermarkRemovePreviewResult> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_PREVIEW, req),
  autoDetectWatermark: (
    req: WatermarkRemoveAutoDetectRequest
  ): Promise<WatermarkRemoveAutoDetectResult> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_AUTO_DETECT, req),
  startWatermarkRemoveBatch: (req: StartWatermarkRemoveBatchRequest): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_START_BATCH, req),
  cancelWatermarkRemoveBatch: (batchId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_CANCEL, batchId),
  onWatermarkRemoveBatchEvent: (cb: (event: WatermarkRemoveBatchEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: WatermarkRemoveBatchEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.WATERMARK_REMOVE_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.WATERMARK_REMOVE_EVENT, listener)
    }
  },
  getWatermarkRemoveModelStatus: (
    id: WatermarkRemoveModelId
  ): Promise<WatermarkRemoveModelStatus> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_MODEL_STATUS, id),
  downloadWatermarkRemoveModel: (id: WatermarkRemoveModelId): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_MODEL_DOWNLOAD, id),
  deleteWatermarkRemoveModel: (id: WatermarkRemoveModelId): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IpcChannels.WATERMARK_REMOVE_MODEL_DELETE, id),
  onWatermarkRemoveModelEvent: (cb: (event: WatermarkRemoveModelEvent) => void): (() => void) => {
    const listener = (_event: unknown, data: WatermarkRemoveModelEvent): void => cb(data)
    ipcRenderer.on(IpcChannels.WATERMARK_REMOVE_MODEL_EVENT, listener)
    return () => {
      ipcRenderer.removeListener(IpcChannels.WATERMARK_REMOVE_MODEL_EVENT, listener)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('desktop', desktopApi)
    contextBridge.exposeInMainWorld('shellOpenPath', shellOpenPath)
    contextBridge.exposeInMainWorld('shellOpenDirectory', shellOpenDirectory)
    contextBridge.exposeInMainWorld('shellRevealFile', shellRevealFile)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.desktop = desktopApi
  // @ts-expect-error (define in dts)
  window.shellOpenPath = shellOpenPath
  // @ts-expect-error (define in dts)
  window.shellOpenDirectory = shellOpenDirectory
  // @ts-expect-error (define in dts)
  window.shellRevealFile = shellRevealFile
}
