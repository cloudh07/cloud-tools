import { cancelWatermarkRemoveBatch } from '@/features/watermark-remove/application/start-watermark-remove.use-case'
import { resetWatermarkRemoveSession } from '@/features/watermark-remove/application/reset-watermark-remove-session'
import { useWatermarkRemoveJobStore } from '@/features/watermark-remove/application/stores/watermark-remove-job.store'
import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import { WatermarkRemoveOptionsCard } from '@/features/watermark-remove/presentation/components/watermark-remove-options-card'
import { WatermarkRemovePreviewColumn } from '@/features/watermark-remove/presentation/components/watermark-remove-preview-column'
import { WatermarkRemoveQueueCard } from '@/features/watermark-remove/presentation/components/watermark-remove-queue-card'
import { useWatermarkRemovePreview } from '@/features/watermark-remove/presentation/hooks/use-watermark-remove-preview'
import { useWatermarkRemoveRun } from '@/features/watermark-remove/presentation/hooks/use-watermark-remove-run'
import { batchStatusLabelVi } from '@/shared/i18n/vi-labels'
import { Badge } from '@/shared/presentation/components/ui/badge'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { useRouteContext } from '@tanstack/react-router'
import { Wand2 } from 'lucide-react'
import { useEffect, useMemo, type ReactElement } from 'react'
import { toast } from 'sonner'

export function WatermarkRemovePage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { watermarkRemove } = useRouteContext({ from: '/tools/watermark-remove' })
  const ui = useWatermarkRemoveUiStore()
  const job = useWatermarkRemoveJobStore()
  const run = useWatermarkRemoveRun()

  useEffect(() => {
    const prev = document.title
    document.title = `${watermarkRemove.pageTitle} | Bộ công cụ`
    return () => {
      document.title = prev
    }
  }, [watermarkRemove.pageTitle])

  useEffect(() => {
    const unsub = desktop.onWatermarkRemoveBatchEvent((ev) => {
      useWatermarkRemoveJobStore.getState().applyEvent(ev)
      if (ev.type === 'item_failed') toast.error(ev.message)
    })
    return unsub
  }, [desktop])

  useEffect(() => {
    return () => {
      const { batchId, status } = useWatermarkRemoveJobStore.getState()
      if (!batchId) return
      if (status === 'processing' || status === 'queued') {
        void cancelWatermarkRemoveBatch(batchId)
      }
    }
  }, [])

  const selected = useMemo(
    () => ui.queue.find((q) => q.localId === ui.selectedLocalId) ?? null,
    [ui.queue, ui.selectedLocalId]
  )

  const spec = useMemo(() => ui.buildSpec(), [ui])
  const preview = useWatermarkRemovePreview({
    inputPath: selected?.inputPath ?? null,
    previewTime: ui.playheadSec,
    spec,
    enabled: !run.busy
  })

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-auto p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Wand2 className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {watermarkRemove.pageTitle}
              </h1>
            </div>
            <p className="w-full max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Xóa watermark cho ảnh và video bằng inpainting offline (Telea) hoặc model AI (LaMa).
              Hỗ trợ vẽ mask bằng hình chữ nhật, cọ, đa giác, auto-detect heuristic, và keyframe cho
              video.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Badge
              variant="secondary"
              className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
            >
              {ui.isLoadingMedia ? 'Đang nhập…' : batchStatusLabelVi(job.status)}
            </Badge>
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 shadow-none ring-1 ring-white/4">
            <div className="min-w-0 space-y-5 p-5">
              <WatermarkRemoveQueueCard busy={run.busy} />
              <WatermarkRemoveOptionsCard
                canStart={run.canStart}
                busy={run.busy}
                showProgressPercent={run.showProgressPercent}
                progressPercent={run.progressPercent}
                onRun={run.runRemoval}
                onCancel={run.cancelRun}
                onResetSession={resetWatermarkRemoveSession}
              />
            </div>
          </ScrollArea>

          <WatermarkRemovePreviewColumn
            preview={preview}
            selectedInputPath={selected?.inputPath ?? null}
            busy={run.busy}
          />
        </div>
      </div>
    </div>
  )
}
