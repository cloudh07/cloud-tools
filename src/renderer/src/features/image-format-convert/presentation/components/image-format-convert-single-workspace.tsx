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
import { useRouteContext } from '@tanstack/react-router'
import { FileImage, FolderOpen } from 'lucide-react'
import { useCallback, type ReactElement } from 'react'
import { toast } from 'sonner'

export type ImageFormatConvertSingleWorkspaceProps = {
  onMultipleFilesAccepted: (paths: string[]) => void
}

export function ImageFormatConvertSingleWorkspace({
  onMultipleFilesAccepted
}: ImageFormatConvertSingleWorkspaceProps): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const ui = useImageFormatConvertUiStore()

  const firstPath = ui.queue[0]?.inputPath ?? null
  const probe = useImageFormatConvertProbe(firstPath)
  const run = useImageFormatConvertRun('single')

  const applyDroppedPaths = useCallback(
    (paths: string[]) => {
      const v = validateDroppedImageFilePaths(paths)
      if (!v.ok) {
        toast.error(v.message)
        return
      }
      if (v.paths.length > 1) {
        toast.message(`Đã nhận ${v.paths.length} ảnh - chuyển sang chế độ hàng loạt.`)
        onMultipleFilesAccepted(v.paths)
        return
      }
      const act = useImageFormatConvertUiStore.getState()
      act.clearQueue()
      act.addPaths([v.paths[0]!])
    },
    [onMultipleFilesAccepted]
  )

  const inputDrop = useInputVideoDrop({
    disabled: run.busy,
    multiple: true,
    validatePaths: validateDroppedImageFilePaths,
    onPathsAccepted: applyDroppedPaths
  })

  const pickOneFile = async (): Promise<void> => {
    const p = await desktop.pickImageFile()
    if (!p) return
    applyDroppedPaths([p])
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
                'aria-label': 'Thả một ảnh vào đây'
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
                Một tệp ảnh. Thả nhiều ảnh sẽ chuyển sang tab Hàng loạt.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-2 min-w-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={run.busy}
                  className="gap-2"
                  onClick={() => void pickOneFile()}
                >
                  <FileImage className="size-4" aria-hidden />
                  Chọn ảnh
                </Button>
              </div>
              {firstPath ? (
                <p className="break-all font-mono text-xs text-muted-foreground">{firstPath}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa chọn ảnh.</p>
              )}

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

          <ImageFormatConvertOptionsCard
            variant="single"
            idPrefix="ifc-s"
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
        selectedInputPath={firstPath}
        emptySelectionMessage="Thêm một ảnh để xem metadata."
      />
    </div>
  )
}
