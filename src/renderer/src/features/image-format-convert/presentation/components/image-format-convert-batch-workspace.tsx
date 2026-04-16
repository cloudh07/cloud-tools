import { resetImageFormatConvertSession } from '@/features/image-format-convert/application/reset-image-format-convert-session'
import { useImageFormatConvertUiStore } from '@/features/image-format-convert/application/stores/image-format-convert-ui.store'
import { ImageFormatConvertOptionsCard } from '@/features/image-format-convert/presentation/components/image-format-convert-options-card'
import { ImageFormatConvertPreviewColumn } from '@/features/image-format-convert/presentation/components/image-format-convert-preview-column'
import { useImageFormatConvertProbe } from '@/features/image-format-convert/presentation/hooks/use-image-format-convert-probe'
import { useImageFormatConvertRun } from '@/features/image-format-convert/presentation/hooks/use-image-format-convert-run'
import { useInputVideoDrop } from '@/features/input-file-drop'
import { validateDroppedImageFilePaths } from '@/features/image-smart-crop/domain/dropped-image-paths'
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
import { useCallback, useMemo, type ReactElement } from 'react'
import { toast } from 'sonner'

export function ImageFormatConvertBatchWorkspace(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const ui = useImageFormatConvertUiStore()
  const run = useImageFormatConvertRun('batch')

  const selected = useMemo(
    () => ui.queue.find((x) => x.localId === ui.selectedLocalId) ?? null,
    [ui.queue, ui.selectedLocalId]
  )

  const probe = useImageFormatConvertProbe(selected?.inputPath)

  const enqueueAcceptedPaths = useCallback((paths: string[]) => {
    const v = validateDroppedImageFilePaths(paths)
    if (!v.ok) {
      toast.error(v.message)
      return
    }
    useImageFormatConvertUiStore.getState().addPaths(v.paths)
  }, [])

  const inputDrop = useInputVideoDrop({
    disabled: run.busy,
    multiple: true,
    validatePaths: validateDroppedImageFilePaths,
    onPathsAccepted: enqueueAcceptedPaths
  })

  const addFiles = async (): Promise<void> => {
    const files = await desktop.pickImageFiles()
    if (files.length === 0) return
    enqueueAcceptedPaths(files)
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
      useImageFormatConvertUiStore.getState().addPaths(v.paths, { scannedRoot: dir })
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

  const onResetSession = (): void => {
    resetImageFormatConvertSession()
  }

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 shadow-none ring-1 ring-white/4">
        <div className="min-w-0 space-y-5 p-5">
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
                Kéo thả một hoặc nhiều ảnh, hoặc thêm từ thư mục (quét đệ quy, lọc theo phần mở rộng
                hợp lệ).
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-2 min-w-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={run.busy || ui.isScanningFolder}
                  className="gap-2"
                  onClick={() => void addFiles()}
                >
                  <FolderOpen className="size-4" aria-hidden />
                  Thêm tệp
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={run.busy || ui.isScanningFolder}
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
                    disabled={run.busy}
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
                {ui.queue.length} tệp · nhấn để xem metadata ở cột phải.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <ScrollArea className="h-[min(240px,40vh)] min-h-24 rounded-md border border-border/80">
                <div className="space-y-2 p-2 pr-3">
                  {ui.queue.length === 0 ? (
                    <p className="absolute inset-0 size-full flex items-center justify-center text-sm text-center text-muted-foreground">
                      Chưa có tệp.
                    </p>
                  ) : (
                    ui.queue.map((q) => (
                      <div
                        key={q.localId}
                        role="button"
                        tabIndex={run.busy ? -1 : 0}
                        aria-disabled={run.busy}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          run.busy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                          q.localId === ui.selectedLocalId
                            ? 'border-primary/50 bg-primary/6'
                            : 'border-border/80 hover:bg-muted/40'
                        )}
                        onClick={() => {
                          if (run.busy) return
                          ui.setSelected(q.localId)
                        }}
                        onKeyDown={(e) => {
                          if (run.busy) return
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            ui.setSelected(q.localId)
                          }
                        }}
                      >
                        <span className="min-w-0 truncate font-mono text-xs">{q.inputPath}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 shrink-0 p-0"
                          disabled={run.busy}
                          onClick={(e) => {
                            e.stopPropagation()
                            ui.removeItem(q.localId)
                          }}
                          aria-label="Xóa khỏi hàng đợi"
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <ImageFormatConvertOptionsCard
            variant="batch"
            idPrefix="ifc-b"
            canStart={run.canStart}
            busy={run.busy}
            showProgressPercent={run.showProgressPercent}
            progressPercent={run.progressPercent}
            onRun={run.runConvert}
            onCancel={run.cancelRun}
            onResetSession={onResetSession}
          />
        </div>
      </ScrollArea>

      <ImageFormatConvertPreviewColumn
        probe={probe}
        selectedInputPath={selected?.inputPath ?? null}
        emptySelectionMessage="Chọn một dòng trong hàng đợi."
      />
    </div>
  )
}
