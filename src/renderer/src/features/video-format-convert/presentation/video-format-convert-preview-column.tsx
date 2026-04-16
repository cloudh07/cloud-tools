import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { useVideoFormatConvertJobStore } from '@/features/video-format-convert/application/stores/video-format-convert-job.store'
import { useVideoFormatConvertUiStore } from '@/features/video-format-convert/application/stores/video-format-convert-ui.store'
import { formatMediaDurationSeconds } from '@/features/video-chroma/presentation/lib/format-media-time'
import { cn } from '@/shared/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import { useRouteContext } from '@tanstack/react-router'
import { useEffect, useState, type ReactElement } from 'react'

function flowStatusLabelVi(s: string): string {
  switch (s) {
    case 'idle':
      return 'Chờ tệp'
    case 'probing':
      return 'Đang probe…'
    case 'ready':
      return 'Sẵn sàng'
    case 'processing':
      return 'Đang chuyển đổi…'
    case 'completed':
      return 'Hoàn tất'
    case 'failed':
      return 'Lỗi'
    case 'cancelled':
      return 'Đã hủy'
    default:
      return s
  }
}

export function VideoFormatConvertPreviewColumn(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const ui = useVideoFormatConvertUiStore()
  const job = useVideoFormatConvertJobStore()

  const inputPath = ui.inputPath
  const probe = ui.probe
  const probeError = ui.probeError
  const flowStatus = ui.flowStatus

  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoLoadFailed, setVideoLoadFailed] = useState<boolean>(false)

  useEffect(() => {
    const p = inputPath?.trim() ?? ''
    let cancelled = false

    const reset = (): void => {
      setVideoUrl(null)
      setVideoLoadFailed(false)
    }

    if (!p) {
      queueMicrotask(() => {
        if (!cancelled) reset()
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (!cancelled) reset()
    })

    void desktop.toFileUrl(p).then(
      (u) => {
        if (!cancelled) {
          setVideoUrl(u)
          setVideoLoadFailed(false)
        }
      },
      () => {
        if (!cancelled) {
          setVideoUrl(null)
          setVideoLoadFailed(true)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [desktop, inputPath])

  return (
    <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
      <div className="flex min-w-0 flex-col gap-5 p-4 pr-3">
        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div className="space-y-1">
              <CardTitle>Metadata (ffprobe)</CardTitle>
              <CardDescription>
                Phân tích luồng từ tiến trình chính; trạng thái luồng làm việc hiển thị bên phải.
              </CardDescription>
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {flowStatusLabelVi(flowStatus)}
            </span>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!inputPath ? (
              <p className="text-muted-foreground">Thêm một video để xem metadata.</p>
            ) : flowStatus === 'probing' && !probe && !probeError ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner className="size-4" />
                Đang đọc…
              </div>
            ) : probeError ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {probeError}
              </div>
            ) : probe ? (
              <div className="space-y-3">
                <div className="break-all font-mono text-[11px] text-foreground/90">
                  {inputPath}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                  <dt>Container</dt>
                  <dd className="col-span-1 font-mono text-[11px] sm:col-span-2">
                    {probe.containerFormat ?? '-'}
                  </dd>
                  <dt>Thời lượng</dt>
                  <dd className="col-span-1 sm:col-span-2">
                    {probe.durationSec != null
                      ? formatMediaDurationSeconds(probe.durationSec)
                      : '-'}
                  </dd>
                  <dt>Độ phân giải</dt>
                  <dd className="col-span-1 sm:col-span-2">
                    {probe.width && probe.height ? `${probe.width}×${probe.height}` : '-'}
                  </dd>
                  <dt>FPS</dt>
                  <dd className="col-span-1 sm:col-span-2">
                    {probe.fps != null ? probe.fps.toFixed(3) : '-'}
                  </dd>
                  <dt>Video codec</dt>
                  <dd className="col-span-1 font-mono text-[11px] sm:col-span-2">
                    {probe.videoCodec ?? '-'}
                  </dd>
                  <dt>Audio codec</dt>
                  <dd className="col-span-1 font-mono text-[11px] sm:col-span-2">
                    {probe.audioCodec ?? '-'}
                  </dd>
                  <dt>Track âm thanh</dt>
                  <dd className="col-span-1 sm:col-span-2">{probe.audioTrackCount}</dd>
                  <dt>Pixel format</dt>
                  <dd className="col-span-1 font-mono text-[11px] sm:col-span-2">
                    {probe.pixelFormat ?? '-'}
                  </dd>
                </dl>
              </div>
            ) : (
              <p className="text-muted-foreground">Chưa có dữ liệu probe.</p>
            )}
          </CardContent>
        </Card>

        {inputPath ? (
          <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
            <CardHeader className="space-y-1">
              <CardTitle>Xem trước</CardTitle>
              <CardDescription>
                Luồng qua URL tệp nội bộ (IPC). Có thể tua và kiểm tra nhanh.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className={cn(
                    'block h-auto max-h-[min(52vh,520px)] w-full rounded-lg border border-border/80 bg-black object-contain'
                  )}
                  aria-label="Xem trước video đầu vào"
                />
              ) : videoLoadFailed ? (
                <p className="min-h-40 rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                  Không tạo được URL xem trước cho tệp này.
                </p>
              ) : (
                <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Đang tải xem trước…</span>
                  <Spinner className="size-4" />
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Lệnh ffmpeg (preview)</CardTitle>
            <CardDescription>Khớp bước encode khi đường dẫn đầu ra hợp lệ.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChromaTerminalFrame title="ffmpeg · preview">
              <ScrollArea className="max-h-40 min-h-24">
                <pre className="whitespace-pre-wrap wrap-break-word p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                  {ui.previewCommand ?? '-'}
                </pre>
              </ScrollArea>
            </ChromaTerminalFrame>
          </CardContent>
        </Card>

        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Logs</CardTitle>
            <CardDescription>Tiến trình ffmpeg từ tiến trình chính.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChromaTerminalFrame title="ffmpeg · log">
              <ScrollArea className="h-[min(18rem,36vh)] min-h-36">
                <pre className="whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed text-zinc-400">
                  {job.logs.length === 0 ? '-' : job.logs.join('\n')}
                </pre>
              </ScrollArea>
            </ChromaTerminalFrame>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
