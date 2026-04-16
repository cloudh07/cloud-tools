import type { BrowserWindow } from 'electron'
import { existsSync, statSync } from 'fs'
import { basename, dirname, extname, join } from 'path'

import { runFfmpegWithHandlers } from '@main/infrastructure/ffmpeg/ffmpeg-process-runner'
import { probeAudioTracks } from '@main/infrastructure/ffmpeg/probe-audio-tracks'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import {
  validateAudioExtractOutputPath,
  validateCompressInputPath
} from '@main/infrastructure/fs/path-validator'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  AudioExtractJobEvent,
  StartAudioExtractBatchRequest,
  StartAudioExtractJobItem
} from '@shared/domain/audio-extract-job'
import { buildAudioExtractFfmpegArgs } from '@shared/infrastructure/ffmpeg/build-audio-extract-args'

type QueueEntry = {
  cfg: AppConfig
  item: StartAudioExtractJobItem
  batchIndex: number
  batchTotal: number
}

function allocateUnusedOutputPath(wanted: string): string {
  if (!existsSync(wanted)) return wanted
  const dir = dirname(wanted)
  const ext = extname(wanted)
  const base = basename(wanted, ext)
  for (let i = 1; i < 10_000; i++) {
    const next = join(dir, `${base}_${i}${ext}`)
    if (!existsSync(next)) return next
  }
  throw new Error('Không thể tạo tên tệp ra (quá nhiều bản trùng).')
}

export class AudioExtractJobManager {
  private readonly queue: QueueEntry[] = []
  private draining = false
  private readonly cancelledJobIds = new Set<string>()
  private activeController: AbortController | null = null
  private activeJobId: string | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: AudioExtractJobEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.AUDIO_EXTRACT_JOB_EVENT, event)
  }

  cancel(jobId: string): void {
    if (this.activeJobId === jobId && this.activeController) {
      this.activeController.abort()
      return
    }
    this.cancelledJobIds.add(jobId)
  }

  enqueue(cfg: AppConfig, request: StartAudioExtractBatchRequest): void {
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
      const validatedOut = validateAudioExtractOutputPath(item.outputPath)
      const output = allocateUnusedOutputPath(validatedOut)

      const resolver = getMediaBinaryResolver()
      const ffprobe = resolver.resolveFfprobeOrThrow(cfg)
      const ffmpeg = resolver.resolveFfmpegOrThrow(cfg)
      console.info(`[audio-extract-job] ffprobe=${ffprobe.source} ffmpeg=${ffmpeg.source}`)
      const probe = await probeAudioTracks(ffprobe.path, input)

      if (probe.tracks.length === 0) {
        throw new Error('Không có luồng âm thanh trong tệp.')
      }
      const track = probe.tracks[item.audioOrdinal]
      if (!track) {
        throw new Error(`Luồng âm thanh 0:a:${item.audioOrdinal} không tồn tại.`)
      }

      const inputBytes = statSync(input).size
      const built = buildAudioExtractFfmpegArgs({
        inputPath: input,
        outputPath: output,
        audioOrdinal: item.audioOrdinal,
        sourceCodec: track.codec,
        format: item.format,
        preferCopy: item.preferCopy
      })

      this.emit({
        type: 'log',
        jobId: item.jobId,
        line: `[audio] ${input} -> ${output} (map 0:a:${item.audioOrdinal}, ${built.usedCopy ? 'copy' : 'encode'} ${item.format})`
      })

      this.emit({ type: 'phase', jobId: item.jobId, phase: 'extract' })
      this.emit({
        type: 'command',
        jobId: item.jobId,
        phase: 'extract',
        args: [ffmpeg.path, ...built.args]
      })

      const totalDurationSec = track.durationSec ?? probe.formatDurationSec

      await runFfmpegWithHandlers(
        built.args,
        { ffmpegPath: ffmpeg.path, signal: controller.signal },
        {
          totalDurationSec,
          onLog: (line) => this.emit({ type: 'log', jobId: item.jobId, line }),
          onProgress: ({ ratio, currentTimeSec }) =>
            this.emit({
              type: 'progress',
              jobId: item.jobId,
              phase: 'extract',
              ratio,
              currentTimeSec,
              totalDurationSec
            })
        }
      )

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
        outputBytes,
        usedCopy: built.usedCopy
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
