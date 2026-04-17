import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { useImageWatermarkJobStore } from '@/features/image-watermark/application/stores/image-watermark-job.store'
import type { ImageWatermarkPreviewSlice } from '@/features/image-watermark/presentation/hooks/use-image-watermark-preview'
import { SMART_CROP_PREVIEW_CHECKER_SURFACE } from '@/features/image-smart-crop/presentation/lib/smart-crop-preview-helpers'
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import type { ReactElement } from 'react'
import { toast } from 'sonner'

export type ImageWatermarkPreviewColumnProps = {
  preview: ImageWatermarkPreviewSlice
  selectedInputPath: string | null
}

export function ImageWatermarkPreviewColumn({
  preview,
  selectedInputPath
}: ImageWatermarkPreviewColumnProps): ReactElement {
  const job = useImageWatermarkJobStore()

  return (
    <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
      <div className="flex min-w-0 flex-col gap-5 p-4 pr-3">
        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Xem trước watermark</CardTitle>
            <CardDescription>
              Ảnh render lại ở kích thước nhỏ (tối đa 1200px). Debounce ~220ms khi đổi tham số.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedInputPath ? (
              <p className="min-h-40 rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                Chọn một ảnh trong hàng đợi để xem trước.
              </p>
            ) : preview.status === 'loading' ? (
              <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                <span>Đang tải xem trước…</span>
              </div>
            ) : preview.status === 'error' ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                {preview.message ?? 'Không tạo được xem trước.'}
              </div>
            ) : preview.status === 'ready' && preview.dataUrl ? (
              <div className="space-y-2">
                <div
                  className={cn(
                    'relative w-full overflow-hidden rounded-lg border border-border/80',
                    SMART_CROP_PREVIEW_CHECKER_SURFACE
                  )}
                >
                  <img
                    src={preview.dataUrl}
                    alt="Xem trước watermark"
                    className="relative z-0 block h-auto max-h-[min(60vh,640px)] w-full object-contain"
                  />
                </div>
                {preview.width && preview.height ? (
                  <p className="text-right text-xs text-muted-foreground tabular-nums">
                    {preview.width} × {preview.height}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="min-h-40 rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                Chưa có dữ liệu xem trước.
              </p>
            )}
          </CardContent>
        </Card>

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
            <ChromaTerminalFrame title="watermark · log">
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
