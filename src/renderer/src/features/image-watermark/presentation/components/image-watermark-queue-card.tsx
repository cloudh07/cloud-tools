import { useImageWatermarkJobStore } from '@/features/image-watermark/application/stores/image-watermark-job.store'
import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'
import { validateDroppedImageFilePaths } from '@/features/image-smart-crop/domain/dropped-image-paths'
import { useInputVideoDrop } from '@/features/input-file-drop'
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
import { FolderOpen, Images, Trash2 } from 'lucide-react'
import { useCallback, type ReactElement } from 'react'
import { toast } from 'sonner'

export type ImageWatermarkQueueCardProps = {
  busy: boolean
}

export function ImageWatermarkQueueCard({ busy }: ImageWatermarkQueueCardProps): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const ui = useImageWatermarkUiStore()
  const job = useImageWatermarkJobStore()

  const enqueuePaths = useCallback((paths: string[]) => {
    const v = validateDroppedImageFilePaths(paths)
    if (!v.ok) {
      toast.error(v.message)
      return
    }
    useImageWatermarkUiStore.getState().addPaths(v.paths)
  }, [])

  const inputDrop = useInputVideoDrop({
    disabled: busy,
    multiple: true,
    validatePaths: validateDroppedImageFilePaths,
    onPathsAccepted: enqueuePaths
  })

  const addFiles = async (): Promise<void> => {
    const files = await desktop.pickImageFiles()
    if (files.length === 0) return
    enqueuePaths(files)
  }

  const addFolder = async (): Promise<void> => {
    ui.setIsScanningFolder(true)
    try {
      const dir = await desktop.pickOutputFolder()
      if (!dir) {
        toast.message('Chưa chọn thư mục.')
        return
      }
      const paths = await desktop.scanImageSmartCropFolder(dir)
      if (paths.length === 0) {
        toast.error('Thư mục không có ảnh hợp lệ.')
        return
      }
      const v = validateDroppedImageFilePaths(paths)
      if (!v.ok) {
        toast.error(v.message)
        return
      }
      useImageWatermarkUiStore.getState().addPaths(v.paths, { scannedRoot: dir })
      toast.message(`Đã thêm ${v.paths.length} ảnh từ thư mục.`)
    } finally {
      ui.setIsScanningFolder(false)
    }
  }

  const pickOut = async (): Promise<void> => {
    const dir = await desktop.pickOutputFolder()
    if (!dir) return
    ui.setOutputFolder(dir)
  }

  return (
    <>
      <Card
        {...inputDrop.getRootProps({
          className: cn(
            'relative min-w-0 overflow-hidden border-border/80 bg-transparent shadow-none outline-none transition-[border-color,box-shadow,background-color] duration-150',
            inputDrop.surface === 'dragging' &&
              'border-2 border-dashed border-primary bg-primary/[0.06] ring-2 ring-primary/20',
            inputDrop.surface === 'accepted' &&
              'border-2 border-dashed border-emerald-500/50 bg-emerald-500/[0.05]',
            (inputDrop.surface === 'rejected' || inputDrop.surface === 'error') &&
              'border-2 border-dashed border-destructive/70 bg-destructive/[0.06]'
          )
        })}
      >
        <input
          {...inputDrop.getInputProps({
            className: 'sr-only',
            'aria-label': 'Thả ảnh vào đây'
          })}
        />
        {inputDrop.surface === 'dragging' ? (
          <div
            className="pointer-events-none absolute inset-0 z-1 rounded-[inherit] bg-background/20 ring-1 ring-inset ring-primary/20"
            aria-hidden
          />
        ) : null}
        <CardHeader className="relative z-2 space-y-1 pb-4">
          <CardTitle>Đầu vào</CardTitle>
          <CardDescription>
            Kéo thả một hoặc nhiều ảnh, hoặc thêm từ thư mục (quét đệ quy, lọc theo phần mở rộng hợp
            lệ).
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-2 min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || ui.isScanningFolder}
              className="gap-2"
              onClick={() => void addFiles()}
            >
              <FolderOpen className="size-4" aria-hidden />
              Thêm tệp
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy || ui.isScanningFolder}
              className="gap-2"
              onClick={() => void addFolder()}
            >
              {ui.isScanningFolder ? (
                <Spinner className="size-4" />
              ) : (
                <Images className="size-4" aria-hidden />
              )}
              Thêm thư mục
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
            {ui.queue.length} ảnh · nhấn để chọn xem trước ở cột phải.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ScrollArea className="h-[min(240px,40vh)] min-h-24 rounded-md border border-border/80">
            <div className="space-y-2 p-2 pr-3">
              {ui.queue.length === 0 ? (
                <p className="absolute inset-0 flex items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
                  Chưa có ảnh.
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
                        {status ? (
                          <p
                            className={cn(
                              'text-[10px] uppercase tracking-wide',
                              status === 'completed' && 'text-emerald-600/90',
                              status === 'failed' && 'text-destructive',
                              status === 'processing' && 'text-primary',
                              status === 'cancelled' && 'text-muted-foreground'
                            )}
                          >
                            {status}
                            {runtime?.errorMessage ? ` · ${runtime.errorMessage}` : ''}
                          </p>
                        ) : null}
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
