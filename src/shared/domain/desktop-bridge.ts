import type {
  AudioExtractJobEvent,
  AudioExtractProbeResult,
  StartAudioExtractBatchRequest
} from './audio-extract-job'
import type { AppUpdateCheckResult, AppUpdateEvent, AppUpdateInstallResult } from './app-update'
import type { AppConfig } from './app-config'
import type { FolderDropScanResult } from './folder-drop-scan'
import type { StartCompressBatchRequest, CompressJobEvent } from './compress-job'
import type {
  ImageSmartCropJobEvent,
  ImageSmartCropOutputFormat,
  SmartCropAnalysisResult,
  SmartCropAnalyzeRequest,
  StartImageSmartCropJobRequest
} from './image-smart-crop'
import type {
  ImageFormatConvertBatchEvent,
  ImageFormatProbeResult,
  StartImageFormatConvertBatchRequest
} from './image-format-convert'
import type {
  ImageSmartCropBatchEvent,
  StartImageSmartCropBatchRequest
} from './image-smart-crop-batch'
import type { StartVideoJobRequest, VideoJobEvent, VideoProbeResult } from './video-job'
import type {
  StartVideoFormatConvertJobRequest,
  VideoFormatConvertJobEvent,
  VideoFormatConvertProbeResult,
  VideoFormatTarget
} from './video-format-convert'
import type { GetPathForLocalFileResult } from './local-file-drop-path'

export type DesktopBridge = {
  checkForAppUpdate: () => Promise<AppUpdateCheckResult>
  installAppUpdate: () => Promise<AppUpdateInstallResult>
  onAppUpdateEvent: (cb: (event: AppUpdateEvent) => void) => () => void
  getPathForLocalFile: (file: File) => GetPathForLocalFileResult
  getConfig: () => Promise<AppConfig>
  setConfig: (partial: Partial<AppConfig>) => Promise<AppConfig>
  pickMp4: () => Promise<string | null>
  pickVideoFiles: () => Promise<string[]>
  pickOutputFolder: () => Promise<string | null>
  scanFolderForDrop: (folderPath: string) => Promise<FolderDropScanResult>
  pickSavePath: (payload: {
    defaultPath: string
    mode: 'green_screen' | 'alpha_mov' | 'webp'
  }) => Promise<string | null>
  probeVideo: (filePath: string) => Promise<VideoProbeResult>
  probeCompressVideo: (filePath: string) => Promise<VideoProbeResult>
  toFileUrl: (filePath: string) => Promise<string>
  shellOpenPath: (filePath: string) => Promise<void>
  shellOpenDirectory: (dirPath: string) => Promise<void>
  shellRevealFile: (filePath: string) => Promise<void>
  startVideoJob: (req: StartVideoJobRequest) => Promise<{ ok: true }>
  cancelVideoJob: (jobId: string) => Promise<{ ok: true }>
  onVideoJobEvent: (cb: (event: VideoJobEvent) => void) => () => void
  startCompressBatch: (req: StartCompressBatchRequest) => Promise<{ ok: true }>
  cancelCompressJob: (jobId: string) => Promise<{ ok: true }>
  onCompressJobEvent: (cb: (event: CompressJobEvent) => void) => () => void
  probeAudioExtract: (filePath: string) => Promise<AudioExtractProbeResult>
  startAudioExtractBatch: (req: StartAudioExtractBatchRequest) => Promise<{ ok: true }>
  cancelAudioExtractJob: (jobId: string) => Promise<{ ok: true }>
  onAudioExtractJobEvent: (cb: (event: AudioExtractJobEvent) => void) => () => void
  pickImageFile: () => Promise<string | null>
  pickImageFiles: () => Promise<string[]>
  pickImageSavePath: (payload: {
    defaultPath: string
    format: ImageSmartCropOutputFormat
  }) => Promise<string | null>
  analyzeImageSmartCrop: (req: SmartCropAnalyzeRequest) => Promise<SmartCropAnalysisResult>
  startImageSmartCropJob: (req: StartImageSmartCropJobRequest) => Promise<{ ok: true }>
  cancelImageSmartCropJob: (jobId: string) => Promise<{ ok: true }>
  onImageSmartCropJobEvent: (cb: (event: ImageSmartCropJobEvent) => void) => () => void
  scanImageSmartCropFolder: (folderPath: string) => Promise<string[]>
  startImageSmartCropBatch: (req: StartImageSmartCropBatchRequest) => Promise<{ ok: true }>
  cancelImageSmartCropBatch: (batchId: string) => Promise<{ ok: true }>
  onImageSmartCropBatchEvent: (cb: (event: ImageSmartCropBatchEvent) => void) => () => void
  probeImageFormat: (inputPath: string) => Promise<ImageFormatProbeResult>
  startImageFormatConvertBatch: (req: StartImageFormatConvertBatchRequest) => Promise<{ ok: true }>
  cancelImageFormatConvertBatch: (batchId: string) => Promise<{ ok: true }>
  onImageFormatConvertBatchEvent: (cb: (event: ImageFormatConvertBatchEvent) => void) => () => void
  probeVideoFormatConvert: (inputPath: string) => Promise<VideoFormatConvertProbeResult>
  startVideoFormatConvertJob: (req: StartVideoFormatConvertJobRequest) => Promise<{ ok: true }>
  cancelVideoFormatConvertJob: (jobId: string) => Promise<{ ok: true }>
  onVideoFormatConvertJobEvent: (cb: (event: VideoFormatConvertJobEvent) => void) => () => void
  pickVideoFormatSavePath: (payload: {
    defaultPath: string
    format: VideoFormatTarget
  }) => Promise<string | null>
}
