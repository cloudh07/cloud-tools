import { cancelImageWatermarkBatch } from '@/features/image-watermark/application/start-image-watermark.use-case'
import { resetImageWatermarkSession } from '@/features/image-watermark/application/reset-image-watermark-session'
import { useImageWatermarkJobStore } from '@/features/image-watermark/application/stores/image-watermark-job.store'
import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'
import { ImageWatermarkLayoutCard } from '@/features/image-watermark/presentation/components/image-watermark-layout-card'
import { ImageWatermarkOptionsCard } from '@/features/image-watermark/presentation/components/image-watermark-options-card'
import { ImageWatermarkPreviewColumn } from '@/features/image-watermark/presentation/components/image-watermark-preview-column'
import { ImageWatermarkQueueCard } from '@/features/image-watermark/presentation/components/image-watermark-queue-card'
import { ImageWatermarkSourceCard } from '@/features/image-watermark/presentation/components/image-watermark-source-card'
import { useImageWatermarkPreview } from '@/features/image-watermark/presentation/hooks/use-image-watermark-preview'
import { useImageWatermarkRun } from '@/features/image-watermark/presentation/hooks/use-image-watermark-run'
import { batchStatusLabelVi } from '@/shared/i18n/vi-labels'
import { Badge } from '@/shared/presentation/components/ui/badge'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { useRouteContext } from '@tanstack/react-router'
import { Stamp } from 'lucide-react'
import { useEffect, useMemo, type ReactElement } from 'react'
import { toast } from 'sonner'

export function ImageWatermarkPage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { imageWatermark } = useRouteContext({ from: '/tools/image-watermark' })
  const ui = useImageWatermarkUiStore()
  const job = useImageWatermarkJobStore()
  const run = useImageWatermarkRun()

  useEffect(() => {
    const prev = document.title
    document.title = `${imageWatermark.pageTitle} | Bộ công cụ`
    return () => {
      document.title = prev
    }
  }, [imageWatermark.pageTitle])

  useEffect(() => {
    const unsub = desktop.onImageWatermarkBatchEvent((ev) => {
      useImageWatermarkJobStore.getState().applyEvent(ev)
      if (ev.type === 'item_failed') toast.error(ev.message)
      if (ev.type === 'zip_failed') toast.error(ev.message)
    })
    return unsub
  }, [desktop])

  useEffect(() => {
    return () => {
      const { batchId, status } = useImageWatermarkJobStore.getState()
      if (!batchId) return
      if (status === 'processing' || status === 'queued') {
        void cancelImageWatermarkBatch(batchId)
      }
    }
  }, [])

  const selected = useMemo(
    () => ui.queue.find((q) => q.localId === ui.selectedLocalId) ?? null,
    [ui.queue, ui.selectedLocalId]
  )

  const spec = useMemo(() => ui.buildSpec(), [ui])
  const preview = useImageWatermarkPreview({
    inputPath: selected?.inputPath ?? null,
    spec,
    enabled: !run.busy
  })

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-auto p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Stamp className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {imageWatermark.pageTitle}
              </h1>
            </div>
            <p className="w-full max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Gắn watermark hàng loạt - hỗ trợ logo PNG/SVG có alpha hoặc chuỗi văn bản. Đặt ở 1 vị
              trí (anchor) hoặc lặp lại theo lưới (tile). Xuất giữ định dạng gốc hoặc chuyển sang
              JPEG/PNG/WebP, có thể đóng gói ZIP sau batch.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Badge
              variant="secondary"
              className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
            >
              {ui.isScanningFolder ? 'Đang nhập…' : batchStatusLabelVi(job.status)}
            </Badge>
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 shadow-none ring-1 ring-white/4">
            <div className="min-w-0 space-y-5 p-5">
              <ImageWatermarkQueueCard busy={run.busy} />
              <ImageWatermarkSourceCard busy={run.busy} />
              <ImageWatermarkLayoutCard busy={run.busy} />
              <ImageWatermarkOptionsCard
                canStart={run.canStart}
                busy={run.busy}
                showProgressPercent={run.showProgressPercent}
                progressPercent={run.progressPercent}
                onRun={run.runWatermark}
                onCancel={run.cancelRun}
                onResetSession={resetImageWatermarkSession}
              />
            </div>
          </ScrollArea>

          <ImageWatermarkPreviewColumn
            preview={preview}
            selectedInputPath={selected?.inputPath ?? null}
          />
        </div>
      </div>
    </div>
  )
}
