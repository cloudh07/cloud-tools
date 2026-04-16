import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import type { ImageFormatConvertProbeSlice } from '@/features/image-format-convert/presentation/hooks/use-image-format-convert-probe'
import { SMART_CROP_PREVIEW_CHECKER_SURFACE } from '@/features/image-smart-crop/presentation/lib/smart-crop-preview-helpers'
import { useImageFormatConvertJobStore } from '@/features/image-format-convert/application/stores/image-format-convert-job.store'
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import { cn } from '@/shared/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { Button } from '@/shared/presentation/components/ui/button'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import { useRouteContext } from '@tanstack/react-router'
import { useEffect, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

export type ImageFormatConvertPreviewColumnProps = {
  probe: ImageFormatConvertProbeSlice
  selectedInputPath: string | null
  emptySelectionMessage: string
}

export function ImageFormatConvertPreviewColumn({
  probe,
  selectedInputPath,
  emptySelectionMessage
}: ImageFormatConvertPreviewColumnProps): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const job = useImageFormatConvertJobStore()
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null)
  const [previewLoadFailed, setPreviewLoadFailed] = useState(false)

  useEffect(() => {
    const p = selectedInputPath?.trim() ?? ''
    let cancelled = false

    const resetPreview = (): void => {
      setInputPreviewUrl(null)
      setPreviewLoadFailed(false)
    }

    if (!p) {
      queueMicrotask(() => {
        if (!cancelled) resetPreview()
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (!cancelled) resetPreview()
    })

    void desktop.toFileUrl(p).then(
      (u) => {
        if (!cancelled) {
          setInputPreviewUrl(u)
          setPreviewLoadFailed(false)
        }
      },
      () => {
        if (!cancelled) {
          setInputPreviewUrl(null)
          setPreviewLoadFailed(true)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [desktop, selectedInputPath])

  return (
    <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
      <div className="flex min-w-0 flex-col gap-5 p-4 pr-3">
        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Metadata (probe)</CardTitle>
            <CardDescription>
              Nhận đường dẫn tuyệt đối từ IPC, kèm kích thước tệp trên đĩa và metadata từ Sharp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!selectedInputPath ? (
              <p className="text-muted-foreground">{emptySelectionMessage}</p>
            ) : probe.status === 'loading' ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Spinner className="size-4" />
                Đang đọc…
              </div>
            ) : probe.status === 'error' ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {probe.message}
              </div>
            ) : probe.data ? (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <div className="col-span-2 break-all font-mono text-[11px] text-foreground/90">
                  {selectedInputPath}
                </div>
                <div>
                  Kích thước: {probe.data.width}×{probe.data.height}
                </div>
                <div>Định dạng: {probe.data.format}</div>
                <div>Alpha: {probe.data.hasAlpha ? 'có' : 'không'}</div>
                <div>
                  EXIF orient: {probe.data.orientation != null ? probe.data.orientation : '-'}
                </div>
                <div className="col-span-2 tabular-nums">
                  Dung lượng: {(probe.data.fileSizeBytes / 1024).toFixed(1)} KiB
                </div>
                {probe.data.pages != null ? (
                  <div className="col-span-2">Khung/trang: {probe.data.pages}</div>
                ) : null}
                {probe.data.hint ? (
                  <p className="col-span-2 text-amber-700/90">{probe.data.hint}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">Chưa có dữ liệu.</p>
            )}
          </CardContent>
        </Card>

        {selectedInputPath ? (
          <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
            <CardHeader className="space-y-1">
              <CardTitle>Xem trước</CardTitle>
              <CardDescription>
                Ảnh gốc qua URL tệp nội bộ (IPC) - nền caro khi có alpha.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inputPreviewUrl ? (
                <div
                  className={cn(
                    'relative w-full overflow-hidden rounded-lg border border-border/80',
                    SMART_CROP_PREVIEW_CHECKER_SURFACE
                  )}
                >
                  <img
                    src={inputPreviewUrl}
                    alt="Ảnh đang chọn"
                    className="relative z-0 block h-auto max-h-[min(52vh,520px)] w-full object-contain"
                  />
                </div>
              ) : previewLoadFailed ? (
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

        {job.summary ? (
          <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
            <CardHeader>
              <CardTitle className="text-base">Tổng kết</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Thành công:{' '}
                <span className="font-medium tabular-nums">{job.summary.successCount}</span>
              </p>
              <p>
                Lỗi: <span className="font-medium tabular-nums">{job.summary.failCount}</span>
              </p>
            </CardContent>
          </Card>
        ) : null}

        {job.zip.status === 'completed' && job.zip.result ? (
          <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base">ZIP</CardTitle>
              <CardDescription>Đã đóng gói các tệp thành công.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="break-all font-mono text-xs text-muted-foreground">
                {job.zip.result.zipPath}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await shellOpenPath(job.zip.result!.zipPath)
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Không mở được ZIP')
                    }
                  }}
                >
                  Mở ZIP
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await shellRevealFile(job.zip.result!.zipPath)
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Không mở thư mục')
                    }
                  }}
                >
                  Thư mục
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : job.zip.status === 'running' ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            <span>Đang tạo ZIP…</span>
          </div>
        ) : job.zip.status === 'failed' ? (
          <div className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-foreground">
            ZIP lỗi: {job.zip.error}
          </div>
        ) : null}

        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Logs</CardTitle>
            <CardDescription>Tiến trình từ tiến trình chính (Sharp).</CardDescription>
          </CardHeader>
          <CardContent>
            <ChromaTerminalFrame title="convert · log">
              <ScrollArea className="h-[min(18rem,36vh)] min-h-36">
                <pre className="whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed text-zinc-400">
                  {job.logs.join('\n')}
                </pre>
              </ScrollArea>
            </ChromaTerminalFrame>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  )
}
