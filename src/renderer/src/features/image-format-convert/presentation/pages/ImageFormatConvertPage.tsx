import { cancelImageFormatConvertBatch } from '@/features/image-format-convert/application/start-image-format-convert.use-case'
import { useImageFormatConvertJobStore } from '@/features/image-format-convert/application/stores/image-format-convert-job.store'
import { useImageFormatConvertUiStore } from '@/features/image-format-convert/application/stores/image-format-convert-ui.store'
import {
  ImageFormatConvertAnimatedModeTabs,
  type ImageFormatConvertMode
} from '@/features/image-format-convert/presentation/components/image-format-convert-animated-mode-tabs'
import { ImageFormatConvertBatchWorkspace } from '@/features/image-format-convert/presentation/components/image-format-convert-batch-workspace'
import { ImageFormatConvertSingleWorkspace } from '@/features/image-format-convert/presentation/components/image-format-convert-single-workspace'
import { batchStatusLabelVi } from '@/shared/i18n/vi-labels'
import { Badge } from '@/shared/presentation/components/ui/badge'
import { useRouteContext, useNavigate, useSearch } from '@tanstack/react-router'
import { FileImage } from 'lucide-react'
import { useCallback, useEffect, type ReactElement } from 'react'
import { toast } from 'sonner'

function surfaceBadgeLabel(scanning: boolean, jobStatus: string): string {
  if (scanning) return 'Đang nhập…'
  return batchStatusLabelVi(
    jobStatus as 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  )
}

export function ImageFormatConvertPage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { imageFormatConvert } = useRouteContext({ from: '/tools/image-format-convert' })
  const navigate = useNavigate({ from: '/tools/image-format-convert' })
  const search = useSearch({ from: '/tools/image-format-convert' })

  const mode: ImageFormatConvertMode = search.mode === 'batch' ? 'batch' : 'single'

  const ui = useImageFormatConvertUiStore()
  const job = useImageFormatConvertJobStore()

  const flowBusy =
    job.status === 'processing' || job.status === 'queued' || job.zip.status === 'running'
  const lockModeSwitch = flowBusy || ui.isScanningFolder

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${imageFormatConvert.title} | Bộ công cụ`
    return () => {
      document.title = prevTitle
    }
  }, [imageFormatConvert.title])

  useEffect(() => {
    const unsub = desktop.onImageFormatConvertBatchEvent((ev) => {
      useImageFormatConvertJobStore.getState().applyEvent(ev)
      if (ev.type === 'item_failed') toast.error(ev.message)
      if (ev.type === 'zip_failed') toast.error(ev.message)
    })
    return unsub
  }, [desktop])

  useEffect(() => {
    return () => {
      const { batchId, status } = useImageFormatConvertJobStore.getState()
      if (!batchId) return
      if (status === 'processing' || status === 'queued') {
        void cancelImageFormatConvertBatch(batchId)
      }
    }
  }, [])

  const onMultipleFilesAccepted = useCallback(
    (paths: string[]) => {
      useImageFormatConvertUiStore.getState().addPaths(paths)
      void navigate({ search: { mode: 'batch' }, replace: true })
    },
    [navigate]
  )

  const setMode = useCallback(
    (next: ImageFormatConvertMode) => {
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
              <FileImage className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {imageFormatConvert.title}
              </h1>
            </div>
            <ImageFormatConvertAnimatedModeTabs
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
                  Một ảnh: chọn định dạng đích, thư mục lưu, rồi chuyển đổi bằng Sharp (probe +
                  encode). Thả nhiều ảnh ở tab này sẽ chuyển sang hàng loạt.
                </>
              ) : (
                <>
                  Xử lý hàng loạt: quản lý hàng đợi, quét thư mục và xử lý tuần tự. Lỗi ở từng tệp
                  sẽ được ghi log, không làm dừng toàn bộ batch trừ khi bị hủy.
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Badge
              variant="secondary"
              className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
            >
              {surfaceBadgeLabel(ui.isScanningFolder, job.status)}
            </Badge>
          </div>
        </header>

        {mode === 'single' ? (
          <ImageFormatConvertSingleWorkspace onMultipleFilesAccepted={onMultipleFilesAccepted} />
        ) : (
          <ImageFormatConvertBatchWorkspace />
        )}
      </div>
    </div>
  )
}
