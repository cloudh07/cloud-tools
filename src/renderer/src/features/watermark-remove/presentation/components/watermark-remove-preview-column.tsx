import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { useWatermarkRemoveJobStore } from '@/features/watermark-remove/application/stores/watermark-remove-job.store'
import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import { WatermarkRemoveKeyframeTimeline } from '@/features/watermark-remove/presentation/components/watermark-remove-keyframe-timeline'
import { WatermarkRemoveMaskEditor } from '@/features/watermark-remove/presentation/components/watermark-remove-mask-editor'
import type { WatermarkRemovePreviewSlice } from '@/features/watermark-remove/presentation/hooks/use-watermark-remove-preview'
import { getDesktop } from '@/shared/lib/desktop-bridge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import { useEffect, useMemo, useState, type ReactElement } from 'react'

export type WatermarkRemovePreviewColumnProps = {
  preview: WatermarkRemovePreviewSlice
  selectedInputPath: string | null
  busy: boolean
}

export function WatermarkRemovePreviewColumn({
  preview,
  selectedInputPath,
  busy
}: WatermarkRemovePreviewColumnProps): ReactElement {
  const ui = useWatermarkRemoveUiStore()
  const job = useWatermarkRemoveJobStore()
  const [bgUrl, setBgUrl] = useState<string | null>(null)
  const selectedItem = useMemo(
    () => ui.queue.find((q) => q.localId === ui.selectedLocalId) ?? null,
    [ui.queue, ui.selectedLocalId]
  )

  useEffect(() => {
    let cancelled = false
    async function resolve(): Promise<void> {
      if (!selectedInputPath || selectedItem?.mediaKind !== 'image') {
        setBgUrl(null)
        return
      }
      try {
        const url = await getDesktop().toFileUrl(selectedInputPath)
        if (!cancelled) setBgUrl(url)
      } catch {
        if (!cancelled) setBgUrl(null)
      }
    }
    void resolve()
    return () => {
      cancelled = true
    }
  }, [selectedInputPath, selectedItem?.mediaKind])

  const editorBackground = preview.status === 'ready' && preview.dataUrl ? preview.dataUrl : bgUrl

  return (
    <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
      <div className="flex min-w-0 flex-col gap-5 p-4 pr-3">
        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Vẽ mask &amp; Xem trước</CardTitle>
            <CardDescription>
              Vẽ vùng chứa watermark. Preview sẽ render lại mỗi khi đổi mask/params (debounce).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedInputPath ? (
              <p className="min-h-40 rounded-lg border border-dashed border-border/80 p-4 text-sm text-muted-foreground">
                Chọn một mục trong hàng đợi để bắt đầu.
              </p>
            ) : (
              <>
                <WatermarkRemoveMaskEditor backgroundUrl={editorBackground} busy={busy} />

                {selectedItem?.mediaKind === 'video' &&
                selectedItem?.durationSec &&
                selectedItem.durationSec > 0 ? (
                  <WatermarkRemoveKeyframeTimeline
                    durationSec={selectedItem.durationSec}
                    busy={busy}
                  />
                ) : null}

                {preview.status === 'loading' ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Spinner className="size-3.5" />
                    <span>Đang tải preview…</span>
                  </div>
                ) : preview.status === 'error' ? (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                    {preview.message ?? 'Không tạo được xem trước.'}
                  </div>
                ) : null}
                {preview.status === 'ready' && preview.width && preview.height ? (
                  <p className="text-right text-xs text-muted-foreground tabular-nums">
                    {preview.width} × {preview.height}
                  </p>
                ) : null}
              </>
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

        <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
          <CardHeader className="space-y-1">
            <CardTitle>Logs</CardTitle>
            <CardDescription>Tiến trình từ tiến trình chính (Sharp/FFmpeg).</CardDescription>
          </CardHeader>
          <CardContent>
            <ChromaTerminalFrame title="watermark-remove · log">
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
