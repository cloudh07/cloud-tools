import { useImageSmartCropBatchJobStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-batch-job.store'
import { useImageSmartCropBatchUiStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-batch-ui.store'
import { useImageSmartCropJobStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-job.store'
import {
  ImageSmartCropAnimatedModeTabs,
  type ImageSmartCropMode
} from '@/features/image-smart-crop/presentation/components/image-smart-crop-animated-mode-tabs'
import { ImageSmartCropBatchWorkspace } from '@/features/image-smart-crop/presentation/components/image-smart-crop-batch-workspace'
import { ImageSmartCropSingleWorkspace } from '@/features/image-smart-crop/presentation/components/image-smart-crop-single-workspace'
import { batchStatusLabelVi, jobStatusVi } from '@/shared/i18n/vi-labels'
import { Badge } from '@/shared/presentation/components/ui/badge'
import type { VideoJobStatus } from '@shared/domain/video-job'
import { useRouteContext, useNavigate, useSearch } from '@tanstack/react-router'
import { ImageIcon } from 'lucide-react'
import { useCallback, useEffect, type ReactElement } from 'react'
import { toast } from 'sonner'

export function ImageSmartCropPage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { imageSmartCrop } = useRouteContext({ from: '/tools/image-smart-crop' })
  const navigate = useNavigate({ from: '/tools/image-smart-crop' })
  const search = useSearch({ from: '/tools/image-smart-crop' })

  const mode: ImageSmartCropMode = search.mode === 'batch' ? 'batch' : 'single'

  const singleJob = useImageSmartCropJobStore()
  const batchJob = useImageSmartCropBatchJobStore()

  const singleFlowBusy =
    singleJob.status === 'running' ||
    singleJob.status === 'queued' ||
    singleJob.status === 'cancelling'
  const batchFlowBusy =
    batchJob.status === 'processing' ||
    batchJob.status === 'queued' ||
    batchJob.zip.status === 'running'
  const lockModeSwitch = singleFlowBusy || batchFlowBusy

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${imageSmartCrop.title} | Bộ công cụ`
    return () => {
      document.title = prevTitle
    }
  }, [imageSmartCrop.title])

  useEffect(() => {
    const unsub = desktop.onImageSmartCropJobEvent((ev) => {
      useImageSmartCropJobStore.getState().applyEvent(ev)
      if (ev.type === 'failed') toast.error(ev.message)
    })
    return unsub
  }, [desktop])

  useEffect(() => {
    const unsub = desktop.onImageSmartCropBatchEvent((ev) => {
      useImageSmartCropBatchJobStore.getState().applyEvent(ev)
      if (ev.type === 'item_failed') toast.error(ev.message)
      if (ev.type === 'zip_failed') toast.error(ev.message)
    })
    return unsub
  }, [desktop])

  const onMultipleFilesAccepted = useCallback(
    (paths: string[]) => {
      useImageSmartCropBatchUiStore.getState().addPaths(paths)
      void navigate({ search: { mode: 'batch' }, replace: true })
    },
    [navigate]
  )

  const setMode = useCallback(
    (next: ImageSmartCropMode) => {
      void navigate({ search: { mode: next }, replace: true })
    },
    [navigate]
  )

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <ImageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {imageSmartCrop.title}
              </h1>
            </div>
            <ImageSmartCropAnimatedModeTabs
              value={mode}
              disabled={lockModeSwitch}
              className="max-w-xl"
              onValueChange={(next) => {
                if (lockModeSwitch) return
                setMode(next)
              }}
            />
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {mode === 'single' ? (
                <>
                  Smart crop saliency (Sobel + ngưỡng thích ứng), padding và tỉ lệ tùy chọn. Một
                  ảnh: xem trước khung crop và xuất từng tệp. Thả nhiều ảnh ở tab này sẽ chuyển sang
                  hàng loạt.
                </>
              ) : (
                <>
                  Chọn nhiều ảnh hoặc cả một thư mục. Ứng dụng sẽ xử lý lần lượt và lưu vào vị trí
                  bạn chọn. Khi cần, có thể gói các ảnh đã hoàn tất thành một tệp để chia sẻ. Việc
                  xử lý diễn ra trên tiến trình chính (Sharp), tương tự chế độ một ảnh.
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Badge
              variant="secondary"
              className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
            >
              {mode === 'single'
                ? jobStatusVi(singleJob.status as VideoJobStatus)
                : batchStatusLabelVi(batchJob.status)}
            </Badge>
          </div>
        </header>

        {mode === 'single' ? (
          <ImageSmartCropSingleWorkspace onMultipleFilesAccepted={onMultipleFilesAccepted} />
        ) : (
          <ImageSmartCropBatchWorkspace />
        )}
      </div>
    </div>
  )
}
