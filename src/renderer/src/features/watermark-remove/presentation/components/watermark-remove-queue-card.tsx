import { useWatermarkRemoveJobStore } from '@/features/watermark-remove/application/stores/watermark-remove-job.store'
import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { Label } from '@/shared/presentation/components/ui/label'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import { useRouteContext } from '@tanstack/react-router'
import { FolderOpen, FilePlus, FileVideo, Trash2 } from 'lucide-react'
import { useCallback, type ReactElement } from 'react'
import { toast } from 'sonner'

export type WatermarkRemoveQueueCardProps = {
  busy: boolean
}

export function WatermarkRemoveQueueCard({ busy }: WatermarkRemoveQueueCardProps): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const ui = useWatermarkRemoveUiStore()
  const job = useWatermarkRemoveJobStore()

  const addMedia = useCallback(
    async (kind: 'image' | 'video') => {
      const p = await desktop.pickWatermarkRemoveMedia(kind)
      if (!p) return
      ui.setIsLoadingMedia(true)
      try {
        const probe = await desktop.probeWatermarkRemoveMedia(p)
        useWatermarkRemoveUiStore.getState().addProbedFiles([{ inputPath: p, probe }])
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Không đọc được media')
      } finally {
        ui.setIsLoadingMedia(false)
      }
    },
    [desktop, ui]
  )

  const pickOut = async (): Promise<void> => {
    const dir = await desktop.pickOutputFolder()
    if (!dir) return
    ui.setOutputFolder(dir)
  }

  return (
    <>
      <Card className="border-border/80 bg-transparent shadow-none">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle>Đầu vào</CardTitle>
          <CardDescription>
            Thêm ảnh (jpg/png/webp) hoặc video (mp4/mov/webm/mkv) để xóa watermark.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || ui.isLoadingMedia}
              className="gap-2"
              onClick={() => void addMedia('image')}
            >
              {ui.isLoadingMedia ? (
                <Spinner className="size-4" />
              ) : (
                <FilePlus className="size-4" aria-hidden />
              )}
              Thêm ảnh
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || ui.isLoadingMedia}
              className="gap-2"
              onClick={() => void addMedia('video')}
            >
              {ui.isLoadingMedia ? (
                <Spinner className="size-4" />
              ) : (
                <FileVideo className="size-4" aria-hidden />
              )}
              Thêm video
            </Button>
          </div>

          <div className="space-y-2">
            <Label>Thư mục đầu ra</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void pickOut()}
              >
                <FolderOpen className="mr-2 size-4" aria-hidden />
                Chọn thư mục
              </Button>
            </div>
            {ui.outputFolder ? (
              <p className="break-all text-xs text-muted-foreground">{ui.outputFolder}</p>
            ) : (
              <p className="text-xs text-amber-600/90">Bắt buộc chọn nơi lưu trước khi chạy.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-transparent shadow-none">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle>Hàng đợi</CardTitle>
          <CardDescription>
            {ui.queue.length} mục · nhấn để chọn xem trước / vẽ mask ở cột phải.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScrollArea className="h-[min(240px,40vh)] min-h-24 rounded-md border border-border/80">
            <div className="space-y-2 p-2 pr-3">
              {ui.queue.length === 0 ? (
                <p className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground">
                  Chưa có media.
                </p>
              ) : (
                ui.queue.map((q) => {
                  const runtime = Object.values(job.items).find((i) => i.localId === q.localId)
                  const active = q.localId === ui.selectedLocalId
                  const status = runtime?.status ?? null
                  return (
                    <div
                      key={q.localId}
                      role="button"
                      tabIndex={busy ? -1 : 0}
                      aria-disabled={busy}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        busy ? 'cursor-not-allowed opacity-80' : 'cursor-pointer',
                        active
                          ? 'border-primary/50 bg-primary/6'
                          : 'border-border/80 hover:bg-muted/40'
                      )}
                      onClick={() => {
                        if (busy) return
                        ui.setSelected(q.localId)
                      }}
                      onKeyDown={(e) => {
                        if (busy) return
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          ui.setSelected(q.localId)
                        }
                      }}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="truncate font-mono text-xs">{q.inputPath}</p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {q.mediaKind}
                          {q.width && q.height ? ` · ${q.width}×${q.height}` : ''}
                          {q.durationSec ? ` · ${q.durationSec.toFixed(1)}s` : ''}
                          {status ? ` · ${status}` : ''}
                          {runtime?.errorMessage ? ` · ${runtime.errorMessage}` : ''}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 shrink-0 p-0"
                        disabled={busy}
                        onClick={(e) => {
                          e.stopPropagation()
                          ui.removeItem(q.localId)
                        }}
                        aria-label="Xóa khỏi hàng đợi"
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </>
  )
}
