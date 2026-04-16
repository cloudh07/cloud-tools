import type { BrowserWindow } from 'electron'
import { existsSync, renameSync, unlinkSync } from 'fs'
import { runFfmpegWithHandlers } from '@main/infrastructure/ffmpeg/ffmpeg-process-runner'
import { probeVideoFile } from '@main/infrastructure/ffmpeg/ffprobe-service'
import {
  buildChromaEnhancePartialVideoPath,
  buildChromaStagingVideoPath,
  validateKeyColor,
  validateMp4InputPath,
  validateOutputVideoPath,
  validateWebpOutputPath
} from '@main/infrastructure/fs/path-validator'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/domain/app-config'
import type { StartVideoJobRequest, VideoJobEvent } from '@shared/domain/video-job'
import { describeChromaEnhancePreset } from '@shared/infrastructure/ffmpeg/chroma-enhance-params'
import { buildChromaPostEnhanceCommand } from '@shared/infrastructure/ffmpeg/chroma-post-enhance-command'
import {
  buildTranscodeCommand,
  buildWebpCommand
} from '@shared/infrastructure/ffmpeg/ffmpeg-command-builder'

function replaceFileWith(destPath: string, srcPath: string): void {
  if (existsSync(destPath)) unlinkSync(destPath)
  renameSync(srcPath, destPath)
}

type ActiveJob = {
  controller: AbortController
}

const MAX_CONCURRENT_VIDEO_JOBS = 2

export class VideoJobManager {
  private readonly jobs = new Map<string, ActiveJob>()

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return
    job.controller.abort()
  }

  private emit(event: VideoJobEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.VIDEO_JOB_EVENT, event)
  }

  async start(cfg: AppConfig, request: StartVideoJobRequest): Promise<void> {
    if (this.jobs.has(request.jobId)) {
      this.emit({ type: 'failed', jobId: request.jobId, message: 'Job id already exists' })
      return
    }
    if (this.jobs.size >= MAX_CONCURRENT_VIDEO_JOBS) {
      this.emit({
        type: 'failed',
        jobId: request.jobId,
        message: `Too many concurrent video jobs (maximum ${MAX_CONCURRENT_VIDEO_JOBS}). Please wait for one to finish.`
      })
      return
    }

    const controller = new AbortController()
    this.jobs.set(request.jobId, { controller })

    const finish = (): void => {
      this.jobs.delete(request.jobId)
    }

    try {
      const input = validateMp4InputPath(request.inputPath)
      const key = validateKeyColor(request.keyColor)
      const userOutput = validateOutputVideoPath(request.outputPath, request.mode)
      const chromaOut = request.autoEnhanceOutput
        ? buildChromaStagingVideoPath(userOutput, request.jobId)
        : userOutput

      const webpOut =
        request.exportWebp && request.webpOutputPath
          ? validateWebpOutputPath(request.webpOutputPath)
          : undefined

      if (request.exportWebp && !webpOut) {
        throw new Error('WebP export was enabled but webpOutputPath is missing')
      }

      const resolver = getMediaBinaryResolver()
      const ffprobe = resolver.resolveFfprobeOrThrow(cfg)
      const ffmpeg = resolver.resolveFfmpegOrThrow(cfg)
      console.info(`[video-job] ffprobe=${ffprobe.source} ffmpeg=${ffmpeg.source}`)
      const probe = await probeVideoFile(ffprobe.path, input)

      if (!probe.hasVideo) {
        throw new Error('No video stream found. Please choose a valid MP4 file.')
      }
      if (!probe.width || !probe.height) {
        throw new Error('Could not read video resolution from ffprobe output.')
      }

      const fps = probe.fps && probe.fps > 0 ? probe.fps : 30

      const transcode = buildTranscodeCommand({
        inputPath: input,
        outputPath: chromaOut,
        mode: request.mode,
        preset: request.preset,
        keyingKind: request.keyingKind,
        keyColor: key,
        similarity: request.similarity,
        blend: request.blend,
        width: probe.width,
        height: probe.height,
        fps,
        durationSec: probe.durationSec
      })

      this.emit({
        type: 'log',
        jobId: request.jobId,
        line: `[chroma] input=${input} chroma_out=${chromaOut} final_target=${userOutput} keyingKind=${request.keyingKind} mode=${request.mode} auto_enhance=${request.autoEnhanceOutput}`
      })
      this.emit({
        type: 'log',
        jobId: request.jobId,
        line: `[chroma] filter_graph=${transcode.filterDescription}`
      })

      this.emit({ type: 'phase', jobId: request.jobId, phase: 'transcode' })
      this.emit({
        type: 'command',
        jobId: request.jobId,
        phase: 'transcode',
        args: [ffmpeg.path, ...transcode.args]
      })

      await runFfmpegWithHandlers(
        transcode.args,
        { ffmpegPath: ffmpeg.path, signal: controller.signal },
        {
          totalDurationSec: probe.durationSec,
          onLog: (line) => this.emit({ type: 'log', jobId: request.jobId, line }),
          onProgress: ({ ratio, currentTimeSec }) =>
            this.emit({
              type: 'progress',
              jobId: request.jobId,
              phase: 'transcode',
              ratio,
              currentTimeSec,
              totalDurationSec: probe.durationSec
            })
        }
      )

      if (controller.signal.aborted) {
        if (request.autoEnhanceOutput && existsSync(chromaOut)) unlinkSync(chromaOut)
        this.emit({ type: 'cancelled', jobId: request.jobId })
        return
      }

      if (request.autoEnhanceOutput) {
        const partialPath = buildChromaEnhancePartialVideoPath(userOutput, request.jobId)
        const enhance = buildChromaPostEnhanceCommand({
          inputPath: chromaOut,
          outputPath: partialPath,
          mode: request.mode,
          qualityPreset: request.preset,
          enhancePreset: request.chromaEnhancePreset
        })
        this.emit({
          type: 'log',
          jobId: request.jobId,
          line: `[enhance] preset=${request.chromaEnhancePreset} - ${describeChromaEnhancePreset(request.chromaEnhancePreset)}`
        })
        this.emit({
          type: 'log',
          jobId: request.jobId,
          line: `[enhance] filter=${enhance.filterDescription}`
        })
        this.emit({ type: 'phase', jobId: request.jobId, phase: 'enhance' })
        this.emit({
          type: 'command',
          jobId: request.jobId,
          phase: 'enhance',
          args: [ffmpeg.path, ...enhance.args]
        })
        try {
          await runFfmpegWithHandlers(
            enhance.args,
            { ffmpegPath: ffmpeg.path, signal: controller.signal },
            {
              totalDurationSec: probe.durationSec,
              onLog: (line) =>
                this.emit({ type: 'log', jobId: request.jobId, line: `[enhance] ${line}` }),
              onProgress: ({ ratio, currentTimeSec }) =>
                this.emit({
                  type: 'progress',
                  jobId: request.jobId,
                  phase: 'enhance',
                  ratio,
                  currentTimeSec,
                  totalDurationSec: probe.durationSec
                })
            }
          )
          replaceFileWith(userOutput, partialPath)
          if (existsSync(chromaOut)) unlinkSync(chromaOut)
        } catch (ee) {
          const msg = ee instanceof Error ? ee.message : String(ee)
          if (existsSync(partialPath)) unlinkSync(partialPath)
          if (msg === 'Cancelled' || msg === 'Aborted') {
            if (existsSync(chromaOut)) replaceFileWith(userOutput, chromaOut)
            throw ee
          }
          if (existsSync(chromaOut)) replaceFileWith(userOutput, chromaOut)
          this.emit({ type: 'enhance_failed', jobId: request.jobId, message: msg })
        }
      }

      if (controller.signal.aborted) {
        this.emit({ type: 'cancelled', jobId: request.jobId })
        return
      }

      let webpPath: string | undefined
      if (webpOut) {
        this.emit({ type: 'phase', jobId: request.jobId, phase: 'webp' })
        const webp = buildWebpCommand({
          inputPath: userOutput,
          outputPath: webpOut,
          quality: 82,
          maxWidth: 1280
        })
        this.emit({
          type: 'command',
          jobId: request.jobId,
          phase: 'webp',
          args: [ffmpeg.path, ...webp.args]
        })

        await runFfmpegWithHandlers(
          webp.args,
          { ffmpegPath: ffmpeg.path, signal: controller.signal },
          {
            totalDurationSec: probe.durationSec,
            onLog: (line) => this.emit({ type: 'log', jobId: request.jobId, line }),
            onProgress: ({ ratio, currentTimeSec }) =>
              this.emit({
                type: 'progress',
                jobId: request.jobId,
                phase: 'webp',
                ratio,
                currentTimeSec,
                totalDurationSec: probe.durationSec
              })
          }
        )
        webpPath = webpOut
      }

      if (controller.signal.aborted) {
        this.emit({ type: 'cancelled', jobId: request.jobId })
        return
      }

      this.emit({
        type: 'completed',
        jobId: request.jobId,
        mode: request.mode,
        outputs: { video: userOutput, webp: webpPath }
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      if (message === 'Cancelled') {
        this.emit({ type: 'cancelled', jobId: request.jobId })
      } else {
        this.emit({ type: 'failed', jobId: request.jobId, message, detail: String(e) })
      }
    } finally {
      finish()
    }
  }
}
