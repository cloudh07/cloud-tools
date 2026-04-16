import type { BrowserWindow } from 'electron'
import { statSync } from 'fs'

import { runFfmpegWithHandlers } from '@main/infrastructure/ffmpeg/ffmpeg-process-runner'
import { probeVideoFile } from '@main/infrastructure/ffmpeg/ffprobe-service'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import {
  validateCompressInputPath,
  validateCompressOutputPath
} from '@main/infrastructure/fs/path-validator'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  CompressJobEvent,
  StartCompressBatchRequest,
  StartCompressJobItem
} from '@shared/domain/compress-job'
import {
  buildCompressTranscodeArgs,
  buildCompressWebpAnimCommand
} from '@shared/infrastructure/ffmpeg/video-compress-command-builder'
import { resolveCompressEncodingPlan } from '@shared/infrastructure/ffmpeg/video-compress-plan'

type QueueEntry = {
  cfg: AppConfig
  item: StartCompressJobItem
  batchIndex: number
  batchTotal: number
}

export class CompressJobManager {
  private readonly queue: QueueEntry[] = []
  private draining = false
  private readonly cancelledJobIds = new Set<string>()
  private activeController: AbortController | null = null
  private activeJobId: string | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: CompressJobEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.COMPRESS_JOB_EVENT, event)
  }

  cancel(jobId: string): void {
    if (this.activeJobId === jobId && this.activeController) {
      this.activeController.abort()
      return
    }
    this.cancelledJobIds.add(jobId)
  }

  enqueue(cfg: AppConfig, request: StartCompressBatchRequest): void {
    const batchTotal = request.items.length
    request.items.forEach((item, batchIndex) => {
      this.queue.push({ cfg, item, batchIndex, batchTotal })
    })
    if (!this.draining) void this.drain()
  }

  private async drain(): Promise<void> {
    this.draining = true
    try {
      while (this.queue.length > 0) {
        const next = this.queue.shift()
        if (!next) break
        if (this.cancelledJobIds.has(next.item.jobId)) {
          this.cancelledJobIds.delete(next.item.jobId)
          this.emit({ type: 'cancelled', jobId: next.item.jobId })
          continue
        }
        await this.runOne(next)
      }
    } finally {
      this.draining = false
    }
  }

  private async runOne(entry: QueueEntry): Promise<void> {
    const { cfg, item } = entry
    const controller = new AbortController()
    this.activeController = controller
    this.activeJobId = item.jobId

    try {
      this.emit({
        type: 'item_started',
        jobId: item.jobId,
        index: entry.batchIndex,
        total: entry.batchTotal
      })

      const input = validateCompressInputPath(item.inputPath)
      const output = validateCompressOutputPath(item.outputPath)

      const resolver = getMediaBinaryResolver()
      const ffprobe = resolver.resolveFfprobeOrThrow(cfg)
      const ffmpeg = resolver.resolveFfmpegOrThrow(cfg)
      console.info(`[compress-job] ffprobe=${ffprobe.source} ffmpeg=${ffmpeg.source}`)
      const probe = await probeVideoFile(ffprobe.path, input)

      if (!probe.hasVideo) {
        throw new Error('Không tìm thấy luồng video trong tệp nguồn.')
      }

      const plan = resolveCompressEncodingPlan({
        probe,
        quality: item.quality,
        profile: item.profile,
        overrides: item.overrides
      })

      const inputBytes = statSync(input).size

      this.emit({
        type: 'log',
        jobId: item.jobId,
        line: `[compress] ${input} -> ${output} (${plan.ffmpegVideoCodec}, ${plan.outputKind})`
      })
      for (const w of plan.warnings) {
        this.emit({ type: 'log', jobId: item.jobId, line: `[compress] note: ${w}` })
      }

      this.emit({ type: 'phase', jobId: item.jobId, phase: 'encode' })

      if (plan.outputKind === 'animated_webp') {
        const built = buildCompressWebpAnimCommand({ inputPath: input, outputPath: output, plan })
        this.emit({
          type: 'command',
          jobId: item.jobId,
          phase: 'encode',
          args: [ffmpeg.path, ...built.args]
        })
        await runFfmpegWithHandlers(
          built.args,
          { ffmpegPath: ffmpeg.path, signal: controller.signal },
          {
            totalDurationSec: probe.durationSec,
            onLog: (line) => this.emit({ type: 'log', jobId: item.jobId, line }),
            onProgress: ({ ratio, currentTimeSec }) =>
              this.emit({
                type: 'progress',
                jobId: item.jobId,
                phase: 'encode',
                ratio,
                currentTimeSec,
                totalDurationSec: probe.durationSec
              })
          }
        )
      } else {
        const built = buildCompressTranscodeArgs({
          inputPath: input,
          outputPath: output,
          plan,
          hasAudio: probe.hasAudio
        })
        this.emit({
          type: 'command',
          jobId: item.jobId,
          phase: 'encode',
          args: [ffmpeg.path, ...built.args]
        })
        await runFfmpegWithHandlers(
          built.args,
          { ffmpegPath: ffmpeg.path, signal: controller.signal },
          {
            totalDurationSec: probe.durationSec,
            onLog: (line) => this.emit({ type: 'log', jobId: item.jobId, line }),
            onProgress: ({ ratio, currentTimeSec }) =>
              this.emit({
                type: 'progress',
                jobId: item.jobId,
                phase: 'encode',
                ratio,
                currentTimeSec,
                totalDurationSec: probe.durationSec
              })
          }
        )
      }

      if (controller.signal.aborted) {
        this.emit({ type: 'cancelled', jobId: item.jobId })
        return
      }

      const outputBytes = statSync(output).size
      this.emit({
        type: 'completed',
        jobId: item.jobId,
        inputPath: input,
        outputPath: output,
        inputBytes,
        outputBytes
      })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      if (message === 'Cancelled') {
        this.emit({ type: 'cancelled', jobId: item.jobId })
      } else {
        this.emit({ type: 'failed', jobId: item.jobId, message, detail: String(e) })
      }
    } finally {
      this.cancelledJobIds.delete(item.jobId)
      this.activeController = null
      this.activeJobId = null
    }
  }
}
