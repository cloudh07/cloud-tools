import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { useRouteContext } from '@tanstack/react-router'
import { FileImage, FilePlus2, FolderOpen, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { useImageDocumentMergeStore } from '@/features/image-document-merge/application/image-document-merge.store'
import { DocumentImageQueue } from '@/features/image-document-merge/presentation/components/document-image-queue'
import { DocumentOutputSettings } from '@/features/image-document-merge/presentation/components/document-output-settings'
import { useInputVideoDrop } from '@/features/input-file-drop/application/use-input-video-drop'
import { cn } from '@/shared/lib/utils'
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import { Button } from '@/shared/presentation/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { Progress } from '@/shared/presentation/components/ui/progress'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from '@/shared/presentation/components/ui/tabs'
import type {
  DocumentMergeMode,
  DocumentMergeProgressPhase,
  StartDocumentMergeRequest
} from '@shared/domain/image-document-merge'

const PHASE_LABELS: Record<DocumentMergeProgressPhase, string> = {
  validate: 'Đang kiểm tra yêu cầu',
  inspect: 'Đang kiểm tra file',
  normalize: 'Đang chuẩn hóa ảnh',
  merge: 'Đang ghép tài liệu',
  write: 'Đang ghi file'
}

function acceptAnyLocalPaths(paths: readonly string[]): { ok: true; paths: string[] } {
  return { ok: true, paths: [...paths] }
}

function acceptSinglePdf(
  paths: readonly string[]
): { ok: true; paths: string[] } | { ok: false; message: string } {
  const first = paths[0]
  if (!first || !first.toLowerCase().endsWith('.pdf')) {
    return { ok: false, message: 'Chỉ chấp nhận một file PDF làm tài liệu gốc.' }
  }
  return { ok: true, paths: [first] }
}

export function ImageDocumentMergePage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const store = useImageDocumentMergeStore()
  const [inspecting, setInspecting] = useState(false)
  const busy = inspecting || store.job.status === 'running'

  useEffect(() => {
    const previousTitle = document.title
    document.title = 'Ghép ảnh thành PDF/DOCX'
    return () => {
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    return desktop.onDocumentMergeEvent((event) => {
      useImageDocumentMergeStore.getState().applyEvent(event)
      if (event.type === 'completed') toast.success('Đã xuất tài liệu thành công.')
      if (event.type === 'failed') toast.error(event.message)
      if (event.type === 'cancelled') toast.message('Đã hủy quá trình xuất.')
    })
  }, [desktop])

  const loadThumbnails = useCallback(
    async (paths: string[]): Promise<void> => {
      let nextIndex = 0
      const loadNext = async (): Promise<void> => {
        while (nextIndex < paths.length) {
          const path = paths[nextIndex++]!
          try {
            const thumbnail = await desktop.createDocumentMergeThumbnail(path)
            useImageDocumentMergeStore.getState().setThumbnail(path, thumbnail.dataUrl)
          } catch {
            // Metadata remains available even when a non-critical thumbnail cannot be rendered.
          }
        }
      }
      await Promise.all([loadNext(), loadNext()])
    },
    [desktop]
  )

  const addImagePaths = useCallback(
    async (paths: string[]): Promise<void> => {
      if (paths.length === 0) return
      setInspecting(true)
      try {
        const result = await desktop.inspectDocumentMergeImages(paths)
        const state = useImageDocumentMergeStore.getState()
        state.setRejections(result.rejected)
        const addedPaths = state.addImages(result.accepted)
        const duplicateOrLimitCount = result.accepted.length - addedPaths.length
        if (result.rejected.length > 0 || duplicateOrLimitCount > 0) {
          toast.warning(
            `Đã thêm ${addedPaths.length} ảnh; bỏ qua ${result.rejected.length + duplicateOrLimitCount} file không hợp lệ, trùng hoặc vượt giới hạn.`
          )
        } else if (addedPaths.length > 0) {
          toast.success(`Đã thêm ${addedPaths.length} ảnh.`)
        } else {
          toast.message('Không có ảnh mới để thêm.')
        }
        void loadThumbnails(addedPaths)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể kiểm tra ảnh.')
      } finally {
        setInspecting(false)
      }
    },
    [desktop, loadThumbnails]
  )

  const loadBasePdf = useCallback(
    async (path: string): Promise<void> => {
      setInspecting(true)
      try {
        const pdf = await desktop.probeDocumentMergePdf(path)
        useImageDocumentMergeStore.getState().setBasePdf(pdf)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể đọc PDF gốc.')
      } finally {
        setInspecting(false)
      }
    },
    [desktop]
  )

  const imageDrop = useInputVideoDrop({
    disabled: busy,
    multiple: true,
    validatePaths: acceptAnyLocalPaths,
    onPathsAccepted: (paths) => void addImagePaths(paths)
  })
  const pdfDrop = useInputVideoDrop({
    disabled: busy || store.mode !== 'append',
    multiple: false,
    validatePaths: acceptSinglePdf,
    onPathsAccepted: (paths) => {
      if (paths[0]) void loadBasePdf(paths[0])
    }
  })

  const canExport =
    !busy && store.queue.length > 0 && (store.mode === 'create' || store.basePdf !== null)

  const defaultOutputName = useMemo(() => {
    if (store.mode === 'append' && store.basePdf) {
      return store.basePdf.name.replace(/\.pdf$/i, '-with-images.pdf')
    }
    return `merged-images.${store.outputFormat}`
  }, [store.basePdf, store.mode, store.outputFormat])

  const chooseOutput = async (): Promise<string | null> => {
    const path = await desktop.pickDocumentMergeSavePath({
      defaultPath: defaultOutputName,
      format: store.outputFormat
    })
    if (path) useImageDocumentMergeStore.getState().setOutputPath(path)
    return path
  }

  const startExport = async (): Promise<void> => {
    if (!canExport) return
    const current = useImageDocumentMergeStore.getState()
    const outputPath = current.outputPath ?? (await chooseOutput())
    if (!outputPath) return
    const jobId = crypto.randomUUID()
    current.beginJob(jobId)
    const request: StartDocumentMergeRequest = {
      jobId,
      mode: current.mode,
      outputFormat: current.mode === 'append' ? 'pdf' : current.outputFormat,
      basePdfPath: current.mode === 'append' ? (current.basePdf?.path ?? null) : null,
      outputPath,
      imagePaths: current.queue.map((item) => item.path),
      settings: {
        ...current.settings,
        pageSize: current.outputFormat === 'docx' ? 'a4' : current.settings.pageSize
      }
    }
    try {
      await desktop.startDocumentMerge(request)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể bắt đầu xuất.'
      current.applyEvent({ type: 'failed', jobId, message })
      toast.error(message)
    }
  }

  const pickImages = async (): Promise<void> => {
    await addImagePaths(await desktop.pickDocumentMergeImages())
  }

  const pickPdf = async (): Promise<void> => {
    const path = await desktop.pickDocumentMergePdf()
    if (path) await loadBasePdf(path)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex min-h-full min-w-0 flex-col gap-5 p-4 sm:p-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Ghép ảnh thành PDF/DOCX</h1>
          <p className="text-sm text-muted-foreground">
            File chỉ được xử lý trên máy. V1 hỗ trợ tạo PDF/DOCX mới và thêm ảnh vào cuối PDF.
          </p>
        </header>

        <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="min-w-0 rounded-xl border border-border/90 bg-card/30">
            <div className="space-y-5 p-5">
              <Card className="border-border/80 bg-transparent shadow-none">
                <CardHeader className="space-y-3 pb-4">
                  <CardTitle>Chế độ</CardTitle>
                  <Tabs
                    value={store.mode}
                    onValueChange={(value) => store.setMode(value as DocumentMergeMode)}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="create" disabled={busy}>
                        Tạo file mới
                      </TabsTrigger>
                      <TabsTrigger value="append" disabled={busy}>
                        Thêm vào PDF
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </CardHeader>
                {store.mode === 'append' ? (
                  <CardContent>
                    <div
                      {...pdfDrop.getRootProps({
                        className: cn(
                          'rounded-lg border border-dashed p-4 transition-colors',
                          pdfDrop.surface === 'dragging' && 'border-primary bg-primary/5'
                        )
                      })}
                    >
                      <input
                        {...pdfDrop.getInputProps({
                          className: 'sr-only',
                          'aria-label': 'Chọn PDF gốc'
                        })}
                      />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">PDF gốc</p>
                          {store.basePdf ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {store.basePdf.name} · {store.basePdf.pageCount} trang
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Kéo PDF vào đây hoặc chọn file. DOCX append sẽ có ở phase 2.
                            </p>
                          )}
                        </div>
                        <Button type="button" variant="outline" disabled={busy} onClick={pickPdf}>
                          <FolderOpen className="mr-2 size-4" aria-hidden />
                          Chọn PDF
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                ) : null}
              </Card>

              <Card
                {...imageDrop.getRootProps({
                  className: cn(
                    'border-border/80 bg-transparent shadow-none transition-colors',
                    imageDrop.surface === 'dragging' &&
                      'border-primary bg-primary/5 ring-2 ring-primary/20'
                  )
                })}
              >
                <input
                  {...imageDrop.getInputProps({
                    className: 'sr-only',
                    'aria-label': 'Chọn ảnh để ghép'
                  })}
                />
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle>Ảnh đầu vào</CardTitle>
                  <CardDescription>
                    JPG, PNG, WebP, AVIF, TIFF một trang · tối đa 100 ảnh và 250 MB.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button type="button" variant="outline" disabled={busy} onClick={pickImages}>
                    {inspecting ? (
                      <Spinner className="mr-2 size-4" />
                    ) : (
                      <FileImage className="mr-2 size-4" aria-hidden />
                    )}
                    Thêm ảnh
                  </Button>
                </CardContent>
              </Card>

              {store.rejections.length > 0 ? (
                <div
                  className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                  role="status"
                >
                  <p className="font-medium">Đã bỏ qua {store.rejections.length} file:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                    {store.rejections.slice(0, 3).map((item) => (
                      <li key={`${item.path}-${item.code}`}>
                        {item.name}: {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <DocumentImageQueue busy={busy} />
            </div>
          </div>

          <div className="min-w-0 rounded-xl border border-border/90 bg-card/20">
            <div className="space-y-5 p-5">
              <DocumentOutputSettings busy={busy} />

              <Card className="border-border/80 shadow-none">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle>Xuất file</CardTitle>
                  <CardDescription>
                    File nguồn không bị ghi đè. PDF có chữ ký số có thể mất hiệu lực khi được ghi
                    lại.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
                    Không upload, không public URL, không lưu lịch sử file.
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void chooseOutput()}
                  >
                    <FolderOpen className="mr-2 size-4" aria-hidden />
                    Chọn nơi lưu
                  </Button>
                  {store.outputPath ? (
                    <p className="break-all font-mono text-xs text-muted-foreground">
                      {store.outputPath}
                    </p>
                  ) : null}

                  {store.job.status === 'running' ? (
                    <div className="space-y-2" aria-live="polite">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{PHASE_LABELS[store.job.phase]}</span>
                        <span>{Math.round(store.job.progress * 100)}%</span>
                      </div>
                      <Progress value={store.job.progress * 100} />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (store.job.jobId) void desktop.cancelDocumentMerge(store.job.jobId)
                        }}
                      >
                        Hủy
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      className="w-full"
                      disabled={!canExport}
                      onClick={() => void startExport()}
                    >
                      <FilePlus2 className="mr-2 size-4" aria-hidden />
                      Xuất {store.mode === 'append' ? 'PDF' : store.outputFormat.toUpperCase()}
                    </Button>
                  )}

                  {store.job.status === 'failed' ? (
                    <p className="text-sm text-destructive" role="alert">
                      {store.job.error}
                    </p>
                  ) : null}
                  {store.job.status === 'completed' && store.job.resultPath ? (
                    <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                      <p>Hoàn tất · {store.job.pageCount} trang</p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void shellOpenPath(store.job.resultPath!)}
                        >
                          Mở file
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void shellRevealFile(store.job.resultPath!)}
                        >
                          Thư mục
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
