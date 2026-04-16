import { cancelImageFormatConvertBatch } from '@/features/image-format-convert/application/start-image-format-convert.use-case'
import { useImageFormatConvertJobStore } from '@/features/image-format-convert/application/stores/image-format-convert-job.store'
import { useImageFormatConvertUiStore } from '@/features/image-format-convert/application/stores/image-format-convert-ui.store'
import {
  FormatConvertWorkspaceTabs,
  type FormatConvertWorkspaceTab,
  type ImageFormatConvertMode
} from '@/features/image-format-convert/presentation/components/format-convert-workspace-tabs'
import { ImageFormatConvertBatchWorkspace } from '@/features/image-format-convert/presentation/components/image-format-convert-batch-workspace'
import { ImageFormatConvertSingleWorkspace } from '@/features/image-format-convert/presentation/components/image-format-convert-single-workspace'
import { resetVideoFormatConvertSession } from '@/features/video-format-convert/application/reset-video-format-convert-session'
import { useVideoFormatConvertUiStore } from '@/features/video-format-convert/application/stores/video-format-convert-ui.store'
import { VideoFormatConvertWorkspace } from '@/features/video-format-convert/presentation/video-format-convert-workspace'
import { batchStatusLabelVi } from '@/shared/i18n/vi-labels'
import { Badge } from '@/shared/presentation/components/ui/badge'
import { useRouteContext, useNavigate, useSearch } from '@tanstack/react-router'
import { FileImage, Film } from 'lucide-react'
import { useCallback, useEffect, type ReactElement } from 'react'
import { toast } from 'sonner'

function surfaceBadgeLabel(scanning: boolean, jobStatus: string): string {
  if (scanning) return 'Đang nhập…'
  return batchStatusLabelVi(
    jobStatus as 'idle' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  )
}

function videoFlowBadgeLabel(flowStatus: string): string {
  switch (flowStatus) {
    case 'idle':
      return 'Video · chờ tệp'
    case 'probing':
      return 'Video · đang probe…'
    case 'ready':
      return 'Video · sẵn sàng'
    case 'processing':
      return 'Video · đang chuyển…'
    case 'completed':
      return 'Video · hoàn tất'
    case 'failed':
      return 'Video · lỗi'
    case 'cancelled':
      return 'Video · đã hủy'
    default:
      return `Video · ${flowStatus}`
  }
}

export function ImageFormatConvertPage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { imageFormatConvert } = useRouteContext({ from: '/tools/image-format-convert' })
  const navigate = useNavigate({ from: '/tools/image-format-convert' })
  const search = useSearch({ from: '/tools/image-format-convert' })

  const media: 'video' | 'image' =
    search.media === 'video' ? 'video' : search.media === 'image' ? 'image' : 'video'
  const mode: ImageFormatConvertMode = search.mode === 'batch' ? 'batch' : 'single'
  const workspaceTab: FormatConvertWorkspaceTab =
    media === 'video' ? 'video' : mode === 'batch' ? 'image-batch' : 'image-single'

  const ui = useImageFormatConvertUiStore()
  const job = useImageFormatConvertJobStore()
  const videoFlow = useVideoFormatConvertUiStore((s) => s.flowStatus)

  const flowBusy =
    job.status === 'processing' || job.status === 'queued' || job.zip.status === 'running'
  const lockModeSwitch = flowBusy || ui.isScanningFolder
  const videoBusy = videoFlow === 'processing' || videoFlow === 'probing'
  const lockMediaSwitch = lockModeSwitch || videoBusy

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${imageFormatConvert.pageTitle} | Bộ công cụ`
    return () => {
      document.title = prevTitle
    }
  }, [imageFormatConvert.pageTitle])

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
      void navigate({ search: { ...search, media: 'image', mode: 'batch' }, replace: true })
    },
    [navigate, search]
  )

  const disabledVideo = lockMediaSwitch && media !== 'video'
  const disabledImageSingle = lockMediaSwitch && !(media === 'image' && mode === 'single')
  const disabledImageBatch = lockMediaSwitch && !(media === 'image' && mode === 'batch')

  const onWorkspaceTab = useCallback(
    (tab: FormatConvertWorkspaceTab) => {
      if (tab === 'video' && disabledVideo) return
      if (tab === 'image-single' && disabledImageSingle) return
      if (tab === 'image-batch' && disabledImageBatch) return

      const fromVideo = media === 'video'
      const toVideo = tab === 'video'
      if (fromVideo !== toVideo) {
        resetVideoFormatConvertSession()
      }

      if (tab === 'video') {
        void navigate({ search: { ...search, media: 'video' }, replace: true })
        return
      }
      if (tab === 'image-single') {
        void navigate({ search: { ...search, media: 'image', mode: 'single' }, replace: true })
        return
      }
      void navigate({ search: { ...search, media: 'image', mode: 'batch' }, replace: true })
    },
    [navigate, search, media, disabledVideo, disabledImageSingle, disabledImageBatch]
  )

  const PageIcon = media === 'video' ? Film : FileImage

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 overflow-auto p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="w-full min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <PageIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {imageFormatConvert.pageTitle}
              </h1>
            </div>
            <FormatConvertWorkspaceTabs
              value={workspaceTab}
              disabledVideo={disabledVideo}
              disabledImageSingle={disabledImageSingle}
              disabledImageBatch={disabledImageBatch}
              className="max-w-3xl"
              onValueChange={onWorkspaceTab}
            />
            <p className="w-full max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {workspaceTab === 'video' ? (
                <>
                  Chuyển container/codec bằng ffmpeg + ffprobe: probe và xem trước ở cột phải, chọn
                  đích và chạy ở cột trái. MVP: một tệp mỗi lần.
                </>
              ) : workspaceTab === 'image-single' ? (
                <>
                  Một ảnh: định dạng đích, thư mục lưu, Sharp (probe + encode). Thả nhiều ảnh sẽ
                  chuyển sang chế độ hàng loạt.
                </>
              ) : (
                <>
                  Hàng đợi, quét thư mục, xử lý tuần tự. Lỗi từng tệp ghi log; batch chỉ dừng khi
                  hủy.
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            {media === 'image' ? (
              <Badge
                variant="secondary"
                className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
              >
                {surfaceBadgeLabel(ui.isScanningFolder, job.status)}
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
              >
                {videoFlowBadgeLabel(videoFlow)}
              </Badge>
            )}
          </div>
        </header>

        {media === 'image' ? (
          mode === 'single' ? (
            <ImageFormatConvertSingleWorkspace onMultipleFilesAccepted={onMultipleFilesAccepted} />
          ) : (
            <ImageFormatConvertBatchWorkspace />
          )
        ) : (
          <VideoFormatConvertWorkspace desktop={desktop} />
        )}
      </div>
    </div>
  )
}
