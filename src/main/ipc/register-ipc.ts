import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { ImageFormatConvertManager } from '@main/application/image/image-format-convert-manager'
import { ImageDocumentMergeManager } from '@main/application/document/image-document-merge-manager'
import { ImageWatermarkManager } from '@main/application/image/image-watermark-manager'
import { SmartCropBatchManager } from '@main/application/image/smart-crop-batch-manager'
import { SmartCropJobManager } from '@main/application/image/smart-crop-job-manager'
import {
  parseImageSmartCropJobId,
  parseSmartCropAnalyzePayload,
  parseStartImageSmartCropJobPayload
} from '@main/application/security/image-smart-crop.validation'
import {
  parseAudioExtractJobId,
  parseStartAudioExtractBatchPayload
} from '@main/application/security/start-audio-extract-job.validation'
import {
  parseCompressJobId,
  parseStartCompressBatchPayload
} from '@main/application/security/start-compress-job.validation'
import {
  parseJobId,
  parseStartVideoJobPayload
} from '@main/application/security/start-video-job.validation'
import {
  assertSafeOptionalToolPath,
  assertSafeToolPath
} from '@main/application/security/tool-path.validation'
import { AudioExtractJobManager } from '@main/application/video/audio-extract-job-manager'
import { CompressJobManager } from '@main/application/video/compress-job-manager'
import {
  probeVideoForApp,
  probeAudioStreamsForApp
} from '@main/application/video/media-probe.use-case'
import { VideoJobManager } from '@main/application/video/video-job-manager'
import { VideoFormatConvertManager } from '@main/application/video/video-format-convert-manager'
import {
  parseStartVideoFormatConvertJobPayload,
  parseVideoFormatConvertJobId
} from '@main/application/security/video-format-convert.validation'
import { AppConfigStore } from '@main/infrastructure/config/app-config-store'
import {
  probeVideoForFormatConvert,
  toFileUrlForMedia
} from '@main/infrastructure/ffmpeg/ffprobe-service'
import {
  getMediaBinaryResolver,
  invalidateMediaBinaryResolverCache
} from '@main/infrastructure/media/media-binary-resolver'
import { listInstalledFontFamilies } from '@main/infrastructure/fonts/system-fonts-service'
import { probeImageForFormatConvert } from '@main/infrastructure/image/image-format-convert-sharp-service'
import {
  probeImageForWatermark,
  renderImageWatermarkPreview
} from '@main/infrastructure/image/image-watermark-sharp-service'
import { analyzeSmartCropImage } from '@main/infrastructure/image/smart-crop-sharp-service'
import { scanFolderForDrop } from '@main/infrastructure/fs/scan-folder-for-drop'
import { scanImageFolderForSmartCrop } from '@main/infrastructure/fs/scan-image-folder'
import {
  validateCompressInputPath,
  validateExistingDirectoryPath,
  validateExistingFilePath,
  validateMp4InputPath,
  validateOutputDirectoryPath,
  validateVideoFormatConvertInputPath
} from '@main/infrastructure/fs/path-validator'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/domain/app-config'
import type { VideoFormatTarget } from '@shared/domain/video-format-convert'
import type { FolderDropScanResult } from '@shared/domain/folder-drop-scan'
import type { ImageSmartCropOutputFormat } from '@shared/domain/image-smart-crop'
import {
  parseImageFormatConvertBatchId,
  parseStartImageFormatConvertBatchPayload
} from '@main/application/security/image-format-convert.validation'
import {
  parseDocumentImagePaths,
  parseDocumentMergeJobId,
  parseDocumentPath,
  parseStartDocumentMergeRequest
} from '@main/application/security/image-document-merge.validation'
import {
  createDocumentImageThumbnail,
  inspectDocumentImages
} from '@main/infrastructure/document/document-image-inspector'
import { inspectDocumentPdf } from '@main/infrastructure/document/document-pdf-inspector'
import type { DocumentOutputFormat } from '@shared/domain/image-document-merge'
import {
  parseImageSmartCropBatchId,
  parseStartImageSmartCropBatchPayload
} from '@main/application/security/image-smart-crop-batch.validation'
import {
  parseImageWatermarkBatchId,
  parseImageWatermarkPreviewPayload,
  parseStartImageWatermarkBatchPayload
} from '@main/application/security/image-watermark.validation'
import {
  parseStartWatermarkRemoveBatchPayload,
  parseWatermarkRemoveAutoDetectPayload,
  parseWatermarkRemoveBatchId,
  parseWatermarkRemoveMediaKind,
  parseWatermarkRemoveModelId,
  parseWatermarkRemovePreviewPayload
} from '@main/application/security/watermark-remove.validation'
import { WatermarkRemoveManager } from '@main/application/watermark-remove/watermark-remove-manager'
import { autoDetectWatermark } from '@main/infrastructure/watermark-remove/auto-detect'
import { renderWatermarkRemovePreview } from '@main/infrastructure/watermark-remove/watermark-remove-preview'
import { probeWatermarkRemoveMedia } from '@main/infrastructure/watermark-remove/watermark-remove-probe'
import {
  configureModelManager,
  deleteModel as deleteWatermarkRemoveModel,
  getModelStatus as getWatermarkRemoveModelStatus,
  startModelDownload as startWatermarkRemoveModelDownload
} from '@main/infrastructure/models/model-manager'

export function registerIpcHandlers(params: {
  getMainWindow: () => BrowserWindow | null
  configStore: AppConfigStore
}): void {
  const jobManager = new VideoJobManager(() => params.getMainWindow())
  const compressManager = new CompressJobManager(() => params.getMainWindow())
  const audioExtractManager = new AudioExtractJobManager(() => params.getMainWindow())
  const smartCropManager = new SmartCropJobManager(() => params.getMainWindow())
  const smartCropBatchManager = new SmartCropBatchManager(() => params.getMainWindow())
  const imageFormatConvertManager = new ImageFormatConvertManager(() => params.getMainWindow())
  const imageDocumentMergeManager = new ImageDocumentMergeManager(() => params.getMainWindow())
  const imageWatermarkManager = new ImageWatermarkManager(() => params.getMainWindow())
  const videoFormatConvertManager = new VideoFormatConvertManager(() => params.getMainWindow())
  const watermarkRemoveManager = new WatermarkRemoveManager(() => params.getMainWindow())
  configureModelManager(() => params.getMainWindow())

  ipcMain.handle(IpcChannels.CONFIG_GET, () => {
    return params.configStore.read()
  })

  ipcMain.handle(IpcChannels.CONFIG_SET, (_event, partial: unknown) => {
    if (!partial || typeof partial !== 'object') {
      throw new Error('Invalid config payload')
    }
    const p = partial as Record<string, unknown>
    const next: Partial<AppConfig> = {}
    if (typeof p.ffmpegPath === 'string') {
      next.ffmpegPath = assertSafeToolPath('ffmpegPath', p.ffmpegPath)
    }
    if (typeof p.ffprobePath === 'string') {
      next.ffprobePath = assertSafeOptionalToolPath('ffprobePath', p.ffprobePath)
    }
    const written = params.configStore.write(next)
    invalidateMediaBinaryResolverCache()
    return written
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_VIDEOS, async () => {
    const win = params.getMainWindow()
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Video',
          extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v']
        }
      ]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle(IpcChannels.FS_SCAN_FOLDER_FOR_DROP, async (_event, raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error('Invalid folder path')
    }
    const abs = validateExistingDirectoryPath(raw.trim())
    const scan: FolderDropScanResult = await scanFolderForDrop(abs)
    return scan
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_FOLDER, async () => {
    const win = params.getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    try {
      return validateOutputDirectoryPath(result.filePaths[0])
    } catch {
      return null
    }
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_IMAGE, async () => {
    const win = params.getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        {
          name: 'Images',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'webp',
            'gif',
            'tif',
            'tiff',
            'avif',
            'bmp',
            'heic',
            'heif',
            'jxl',
            'svg'
          ]
        }
      ]
    })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_IMAGES, async () => {
    const win = params.getMainWindow()
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Images',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'webp',
            'gif',
            'tif',
            'tiff',
            'avif',
            'bmp',
            'heic',
            'heif',
            'jxl',
            'svg'
          ]
        }
      ]
    })
    if (result.canceled) return []
    return result.filePaths
  })

  ipcMain.handle(
    IpcChannels.DIALOG_SELECT_IMAGE_SAVE,
    async (_event, payload: { defaultPath: string; format: ImageSmartCropOutputFormat }) => {
      const win = params.getMainWindow()
      if (!win) return null
      const ext =
        payload.format === 'jpeg' ? 'jpg' : payload.format === 'tiff' ? 'tif' : payload.format
      const label =
        payload.format === 'jpeg'
          ? 'JPEG'
          : payload.format === 'png'
            ? 'PNG'
            : payload.format === 'webp'
              ? 'WebP'
              : payload.format === 'avif'
                ? 'AVIF'
                : 'TIFF'
      const result = await dialog.showSaveDialog(win, {
        defaultPath: payload.defaultPath,
        filters: [{ name: label, extensions: [ext] }]
      })
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  ipcMain.handle(IpcChannels.DIALOG_SELECT_MP4, async () => {
    const win = params.getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'MP4', extensions: ['mp4'] }]
    })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(
    IpcChannels.DIALOG_SELECT_SAVE,
    async (
      _event,
      payload: { defaultPath: string; mode: 'green_screen' | 'alpha_mov' | 'webp' }
    ) => {
      const win = params.getMainWindow()
      if (!win) return null
      const filters =
        payload.mode === 'green_screen'
          ? [{ name: 'MP4', extensions: ['mp4'] }]
          : payload.mode === 'alpha_mov'
            ? [{ name: 'MOV', extensions: ['mov'] }]
            : [{ name: 'WebP', extensions: ['webp'] }]

      const result = await dialog.showSaveDialog(win, {
        defaultPath: payload.defaultPath,
        filters
      })
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  ipcMain.handle(IpcChannels.AUDIO_EXTRACT_PROBE, async (_event, filePath: string) => {
    const cfg = params.configStore.read()
    const input = validateCompressInputPath(filePath)
    return probeAudioStreamsForApp(cfg, input)
  })

  ipcMain.handle(IpcChannels.COMPRESS_PROBE, async (_event, filePath: string) => {
    const cfg = params.configStore.read()
    const input = validateCompressInputPath(filePath)
    return probeVideoForApp(cfg, input)
  })

  ipcMain.handle(IpcChannels.VIDEO_PROBE, async (_event, filePath: string) => {
    const cfg = params.configStore.read()
    const input = validateMp4InputPath(filePath)
    return probeVideoForApp(cfg, input)
  })

  ipcMain.handle(IpcChannels.MEDIA_TO_FILE_URL, (_event, filePath: string) => {
    const abs = validateExistingFilePath(filePath)
    return toFileUrlForMedia(abs)
  })

  ipcMain.handle(IpcChannels.SHELL_OPEN_EXISTING_FILE, async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Invalid file path')
    }
    const abs = validateExistingFilePath(filePath.trim())
    const err = await shell.openPath(abs)
    if (err) throw new Error(err)
  })

  ipcMain.handle(IpcChannels.SHELL_OPEN_DIRECTORY, async (_event, dirPath: unknown) => {
    if (typeof dirPath !== 'string' || !dirPath.trim()) {
      throw new Error('Invalid directory path')
    }
    const abs = validateExistingDirectoryPath(dirPath.trim())
    const err = await shell.openPath(abs)
    if (err) throw new Error(err)
  })

  ipcMain.handle(IpcChannels.SHELL_REVEAL_FILE, async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string' || !filePath.trim()) {
      throw new Error('Invalid file path')
    }
    const abs = validateExistingFilePath(filePath.trim())
    shell.showItemInFolder(abs)
  })

  ipcMain.handle(IpcChannels.VIDEO_START_JOB, async (_event, req: unknown) => {
    const parsed = parseStartVideoJobPayload(req)
    const cfg = params.configStore.read()
    void jobManager.start(cfg, parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.VIDEO_CANCEL_JOB, (_event, jobId: unknown) => {
    jobManager.cancel(parseJobId(jobId))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.COMPRESS_START_BATCH, (_event, req: unknown) => {
    const parsed = parseStartCompressBatchPayload(req)
    const cfg = params.configStore.read()
    compressManager.enqueue(cfg, parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.COMPRESS_CANCEL_JOB, (_event, jobId: unknown) => {
    compressManager.cancel(parseCompressJobId(jobId))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.AUDIO_EXTRACT_START_BATCH, (_event, req: unknown) => {
    const parsed = parseStartAudioExtractBatchPayload(req)
    const cfg = params.configStore.read()
    audioExtractManager.enqueue(cfg, parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.AUDIO_EXTRACT_CANCEL_JOB, (_event, jobId: unknown) => {
    audioExtractManager.cancel(parseAudioExtractJobId(jobId))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_SMART_CROP_ANALYZE, async (_event, raw: unknown) => {
    const parsed = parseSmartCropAnalyzePayload(raw)
    return analyzeSmartCropImage(parsed)
  })

  ipcMain.handle(IpcChannels.IMAGE_SMART_CROP_START_JOB, async (_event, raw: unknown) => {
    const parsed = parseStartImageSmartCropJobPayload(raw)
    void smartCropManager.start(parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_SMART_CROP_CANCEL_JOB, (_event, jobId: unknown) => {
    smartCropManager.cancel(parseImageSmartCropJobId(jobId))
    return { ok: true as const }
  })

  ipcMain.handle(
    IpcChannels.IMAGE_SMART_CROP_BATCH_SCAN_FOLDER,
    async (_event, folderPath: unknown) => {
      if (typeof folderPath !== 'string' || !folderPath.trim()) return []
      return scanImageFolderForSmartCrop(folderPath.trim())
    }
  )

  ipcMain.handle(IpcChannels.IMAGE_SMART_CROP_BATCH_START, async (_event, raw: unknown) => {
    const parsed = parseStartImageSmartCropBatchPayload(raw)
    smartCropBatchManager.enqueue(parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_SMART_CROP_BATCH_CANCEL, (_event, batchId: unknown) => {
    smartCropBatchManager.cancel(parseImageSmartCropBatchId(batchId))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_FORMAT_PROBE, async (_event, raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error('Đường dẫn ảnh không hợp lệ')
    }
    return probeImageForFormatConvert(raw.trim())
  })

  ipcMain.handle(IpcChannels.IMAGE_FORMAT_CONVERT_START, async (_event, raw: unknown) => {
    const parsed = parseStartImageFormatConvertBatchPayload(raw)
    imageFormatConvertManager.enqueue(parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_FORMAT_CONVERT_CANCEL, (_event, batchId: unknown) => {
    imageFormatConvertManager.cancel(parseImageFormatConvertBatchId(batchId))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_DOCUMENT_IMAGES, async () => {
    const win = params.getMainWindow()
    if (!win) return []
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Static images',
          extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff']
        }
      ]
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_DOCUMENT_PDF, async () => {
    const win = params.getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'PDF document', extensions: ['pdf'] }]
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })

  ipcMain.handle(IpcChannels.DIALOG_SELECT_DOCUMENT_SAVE, async (_event, raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid save dialog payload.')
    const payload = raw as { defaultPath?: unknown; format?: unknown }
    if (typeof payload.defaultPath !== 'string' || !payload.defaultPath.trim()) {
      throw new Error('Invalid default output path.')
    }
    if (payload.format !== 'pdf' && payload.format !== 'docx') {
      throw new Error('Invalid document output format.')
    }
    const format = payload.format as DocumentOutputFormat
    const win = params.getMainWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      defaultPath: payload.defaultPath,
      filters: [
        format === 'pdf'
          ? { name: 'PDF document', extensions: ['pdf'] }
          : { name: 'Word document', extensions: ['docx'] }
      ]
    })
    return result.canceled ? null : (result.filePath ?? null)
  })

  ipcMain.handle(IpcChannels.IMAGE_DOCUMENT_INSPECT_IMAGES, (_event, raw: unknown) => {
    return inspectDocumentImages(parseDocumentImagePaths(raw))
  })

  ipcMain.handle(IpcChannels.IMAGE_DOCUMENT_THUMBNAIL, (_event, raw: unknown) => {
    return createDocumentImageThumbnail(parseDocumentPath(raw))
  })

  ipcMain.handle(IpcChannels.IMAGE_DOCUMENT_PROBE_PDF, (_event, raw: unknown) => {
    return inspectDocumentPdf(parseDocumentPath(raw))
  })

  ipcMain.handle(IpcChannels.IMAGE_DOCUMENT_MERGE_START, async (_event, raw: unknown) => {
    await imageDocumentMergeManager.start(parseStartDocumentMergeRequest(raw))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_DOCUMENT_MERGE_CANCEL, async (_event, raw: unknown) => {
    await imageDocumentMergeManager.cancel(parseDocumentMergeJobId(raw))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.VIDEO_FORMAT_CONVERT_PROBE, async (_event, raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error('Đường dẫn video không hợp lệ')
    }
    const cfg = params.configStore.read()
    const input = validateVideoFormatConvertInputPath(raw.trim())
    const resolver = getMediaBinaryResolver()
    const ffprobe = resolver.resolveFfprobeOrThrow(cfg)
    return probeVideoForFormatConvert(ffprobe.path, input)
  })

  ipcMain.handle(IpcChannels.VIDEO_FORMAT_CONVERT_START, async (_event, raw: unknown) => {
    const parsed = parseStartVideoFormatConvertJobPayload(raw)
    const cfg = params.configStore.read()
    void videoFormatConvertManager.start(cfg, parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.VIDEO_FORMAT_CONVERT_CANCEL, (_event, jobId: unknown) => {
    videoFormatConvertManager.cancel(parseVideoFormatConvertJobId(jobId))
    return { ok: true as const }
  })

  ipcMain.handle(
    IpcChannels.DIALOG_SELECT_VIDEO_FORMAT_SAVE,
    async (_event, payload: { defaultPath: string; format: VideoFormatTarget }) => {
      const win = params.getMainWindow()
      if (!win) return null
      const ext =
        payload.format === 'webp_anim' ? 'webp' : payload.format === 'mov' ? 'mov' : payload.format
      const label = payload.format === 'webp_anim' ? 'WebP động' : payload.format.toUpperCase()
      const result = await dialog.showSaveDialog(win, {
        defaultPath: payload.defaultPath,
        filters: [{ name: label, extensions: [ext] }]
      })
      if (result.canceled || !result.filePath) return null
      return result.filePath
    }
  )

  ipcMain.handle(IpcChannels.DIALOG_SELECT_WATERMARK_LOGO, async () => {
    const win = params.getMainWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Logo', extensions: ['png', 'svg', 'webp'] }]
    })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IpcChannels.IMAGE_WATERMARK_PROBE, async (_event, raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error('Đường dẫn ảnh không hợp lệ')
    }
    return probeImageForWatermark(raw.trim())
  })

  ipcMain.handle(IpcChannels.IMAGE_WATERMARK_PREVIEW, async (_event, raw: unknown) => {
    const parsed = parseImageWatermarkPreviewPayload(raw)
    return renderImageWatermarkPreview(parsed)
  })

  ipcMain.handle(IpcChannels.IMAGE_WATERMARK_START, async (_event, raw: unknown) => {
    const parsed = parseStartImageWatermarkBatchPayload(raw)
    imageWatermarkManager.enqueue(parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.IMAGE_WATERMARK_CANCEL, (_event, batchId: unknown) => {
    imageWatermarkManager.cancel(parseImageWatermarkBatchId(batchId))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_PICK_MEDIA, async (_event, raw: unknown) => {
    const win = params.getMainWindow()
    if (!win) return null
    const kind = parseWatermarkRemoveMediaKind(raw)
    const filters =
      kind === 'image'
        ? [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }]
        : [{ name: 'Videos', extensions: ['mp4', 'mov', 'webm', 'mkv', 'm4v'] }]
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters })
    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_PROBE, async (_event, raw: unknown) => {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new Error('Đường dẫn không hợp lệ')
    }
    const cfg = params.configStore.read()
    return probeWatermarkRemoveMedia(cfg, raw.trim())
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_PREVIEW, async (_event, raw: unknown) => {
    const parsed = parseWatermarkRemovePreviewPayload(raw)
    const cfg = params.configStore.read()
    return renderWatermarkRemovePreview(cfg, parsed)
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_AUTO_DETECT, async (_event, raw: unknown) => {
    const parsed = parseWatermarkRemoveAutoDetectPayload(raw)
    const cfg = params.configStore.read()
    return autoDetectWatermark(cfg, parsed)
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_START_BATCH, (_event, raw: unknown) => {
    const parsed = parseStartWatermarkRemoveBatchPayload(raw)
    const cfg = params.configStore.read()
    watermarkRemoveManager.enqueue(cfg, parsed)
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_CANCEL, (_event, raw: unknown) => {
    watermarkRemoveManager.cancel(parseWatermarkRemoveBatchId(raw))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_MODEL_STATUS, async (_event, raw: unknown) => {
    return getWatermarkRemoveModelStatus(parseWatermarkRemoveModelId(raw))
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_MODEL_DOWNLOAD, async (_event, raw: unknown) => {
    const id = parseWatermarkRemoveModelId(raw)
    startWatermarkRemoveModelDownload(id).catch(() => {})
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.WATERMARK_REMOVE_MODEL_DELETE, async (_event, raw: unknown) => {
    await deleteWatermarkRemoveModel(parseWatermarkRemoveModelId(raw))
    return { ok: true as const }
  })

  ipcMain.handle(IpcChannels.FONTS_LIST_INSTALLED, async (_event, payload: unknown) => {
    const refresh =
      typeof payload === 'object' &&
      payload !== null &&
      (payload as { refresh?: unknown }).refresh === true
    return listInstalledFontFamilies(refresh)
  })
}
