import type { BrowserWindow } from 'electron'
import { runFfmpegWithHandlers } from '@main/infrastructure/ffmpeg/ffmpeg-process-runner'
import { probeVideoForFormatConvert } from '@main/infrastructure/ffmpeg/ffprobe-service'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import {
  validateVideoFormatConvertInputPath,
  validateVideoFormatConvertOutputPath
} from '@main/infrastructure/fs/path-validator'
import { IpcChannels } from '@shared/constants/ipc-channels'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  StartVideoFormatConvertJobRequest,
  VideoFormatConvertJobEvent
} from '@shared/domain/video-format-convert'
import {
  previewFfmpegCommandLine,
  resolveVideoFormatConversion
} from '@shared/infrastructure/ffmpeg/video-format-convert-plan'

export class VideoFormatConvertManager {
  private activeController: AbortController | null = null
  private activeJobId: string | null = null

  constructor(private readonly getWindow: () => BrowserWindow | null) {}

  private emit(event: VideoFormatConvertJobEvent): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed()) return
    win.webContents.send(IpcChannels.VIDEO_FORMAT_CONVERT_EVENT, event)
  }

  cancel(jobId: string): void {
    if (this.activeJobId === jobId && this.activeController) {
      this.activeController.abort()
    }
  }

  async start(cfg: AppConfig, req: StartVideoFormatConvertJobRequest): Promise<void> {
    if (this.activeJobId != null) {
      this.emit({
        type: 'failed',
        jobId: req.jobId,
        message: 'Đang có tác vụ chuyển đổi khác. Hãy hủy trước hoặc đợi hoàn tất.'
      })
      return
    }

    const controller = new AbortController()
    this.activeController = controller
    this.activeJobId = req.jobId

    try {
      const input = validateVideoFormatConvertInputPath(req.inputPath)
      const output = validateVideoFormatConvertOutputPath(req.outputPath, req.target)

      const resolver = getMediaBinaryResolver()
      const ffprobe = resolver.resolveFfprobeOrThrow(cfg)
      const ffmpeg = resolver.resolveFfmpegOrThrow(cfg)

      this.emit({ type: 'log', jobId: req.jobId, line: `[probe] ${ffprobe.source} ${input}` })
      const probe = await probeVideoForFormatConvert(ffprobe.path, input)

      const plan = resolveVideoFormatConversion({
        probe,
        target: req.target,
        inputPath: input,
        outputPath: output
      })

      if (!plan.ok) {
        this.emit({ type: 'failed', jobId: req.jobId, message: plan.reason })
        return
      }

      for (const w of plan.warnings) {
        this.emit({ type: 'log', jobId: req.jobId, line: `[note] ${w}` })
      }

      this.emit({
        type: 'log',
        jobId: req.jobId,
        line: `[plan] ${plan.summary}${plan.streamCopy ? ' (stream copy)' : ' (transcode)'}`
      })

      const preview = previewFfmpegCommandLine(ffmpeg.path, plan.args)
      this.emit({ type: 'log', jobId: req.jobId, line: preview })

      this.emit({ type: 'command', jobId: req.jobId, args: [ffmpeg.path, ...plan.args] })

      await runFfmpegWithHandlers(
        plan.args,
        { ffmpegPath: ffmpeg.path, signal: controller.signal },
        {
          totalDurationSec: probe.durationSec,
          onLog: (line) => this.emit({ type: 'log', jobId: req.jobId, line }),
          onProgress: ({ ratio, currentTimeSec }) =>
            this.emit({
              type: 'progress',
              jobId: req.jobId,
              ratio,
              percent: Math.round(ratio * 100),
              currentTimeSec,
              totalDurationSec: probe.durationSec
            })
        }
      )

      if (controller.signal.aborted) {
        this.emit({ type: 'cancelled', jobId: req.jobId })
        return
      }

      this.emit({ type: 'completed', jobId: req.jobId, outputPath: output })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      if (message === 'Cancelled') {
        this.emit({ type: 'cancelled', jobId: req.jobId })
      } else {
        this.emit({ type: 'failed', jobId: req.jobId, message })
      }
    } finally {
      this.activeController = null
      this.activeJobId = null
    }
  }
}
