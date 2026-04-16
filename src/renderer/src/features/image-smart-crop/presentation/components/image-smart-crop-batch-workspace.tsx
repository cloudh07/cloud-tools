import { useInputVideoDrop } from '@/features/input-file-drop'
import { resetImageSmartCropBatchSession } from '@/features/image-smart-crop/application/reset-image-smart-crop-session'
import { useImageSmartCropBatchJobStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-batch-job.store'
import { useImageSmartCropBatchUiStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-batch-ui.store'
import { validateDroppedImageFilePaths } from '@/features/image-smart-crop/domain/dropped-image-paths'
import {
  AUTO_ANALYZE_DEBOUNCE_MS,
  rectAlmostEqual,
  SMART_CROP_PREVIEW_CHECKER_SURFACE
} from '@/features/image-smart-crop/presentation/lib/smart-crop-preview-helpers'
import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { shellOpenDirectory, shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import { fileNameFromPath, joinDirFile, stemFromPath } from '@/shared/lib/local-file-path'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { Checkbox } from '@/shared/presentation/components/ui/checkbox'
import { Label } from '@/shared/presentation/components/ui/label'
import { Progress } from '@/shared/presentation/components/ui/progress'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Separator } from '@/shared/presentation/components/ui/separator'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/presentation/components/ui/select'
import { Slider } from '@/shared/presentation/components/ui/slider'
import type {
  CropRect,
  ImageSmartCropOutputFormat,
  SmartCropAspectMode,
  SmartCropAnalysisResult
} from '@shared/domain/image-smart-crop'
import type { StartImageSmartCropBatchRequest } from '@shared/domain/image-smart-crop-batch'
import { useRouteContext } from '@tanstack/react-router'
import { FolderOpen, Images, Play, Square, Trash2, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

const OUTPUT_FORMATS: readonly ImageSmartCropOutputFormat[] = [
  'png',
  'jpeg',
  'webp',
  'avif',
  'tiff'
]

const ASPECT_OPTIONS: readonly { value: SmartCropAspectMode; label: string }[] = [
  { value: 'free', label: 'Tự do' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' }
]

function defaultOutName(inputPath: string, format: ImageSmartCropOutputFormat): string {
  const stem = stemFromPath(inputPath)
  const ext = format === 'jpeg' ? 'jpg' : format === 'tiff' ? 'tif' : format
  return `${stem}_smart.${ext}`
}

export function ImageSmartCropBatchWorkspace(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })

  const ui = useImageSmartCropBatchUiStore()
  const job = useImageSmartCropBatchJobStore()

  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null)
  const [previewAnalysis, setPreviewAnalysis] = useState<SmartCropAnalysisResult | null>(null)
  const [busyPreviewAnalyze, setBusyPreviewAnalyze] = useState(false)
  const lastPreviewPathForDebounceRef = useRef<string | null>(null)

  const selected = useMemo(
    () => ui.queue.find((x) => x.localId === ui.selectedLocalId) ?? null,
    [ui.queue, ui.selectedLocalId]
  )

  useEffect(() => {
    let cancelled = false
    if (!selected) {
      queueMicrotask(() => {
        if (!cancelled) setSelectedPreviewUrl(null)
      })
    } else {
      void desktop.toFileUrl(selected.inputPath).then(
        (u) => {
          if (!cancelled) setSelectedPreviewUrl(u)
        },
        () => {
          if (!cancelled) setSelectedPreviewUrl(null)
        }
      )
    }
    return () => {
      cancelled = true
    }
  }, [desktop, selected])

  useEffect(() => {
    const inputPath = selected?.inputPath?.trim() ?? ''
    if (!inputPath) {
      lastPreviewPathForDebounceRef.current = null
      setPreviewAnalysis(null)
      setBusyPreviewAnalyze(false)
      return
    }

    const pathChanged = lastPreviewPathForDebounceRef.current !== inputPath
    if (pathChanged) {
      lastPreviewPathForDebounceRef.current = inputPath
      setPreviewAnalysis(null)
    }

    const delayMs = pathChanged ? 0 : AUTO_ANALYZE_DEBOUNCE_MS
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        setBusyPreviewAnalyze(true)
        const act = useImageSmartCropBatchUiStore.getState()
        const p = act.queue.find((q) => q.localId === act.selectedLocalId)?.inputPath?.trim()
        if (!p) {
          if (!cancelled) setBusyPreviewAnalyze(false)
          return
        }
        try {
          const r = await desktop.analyzeImageSmartCrop({
            inputPath: p,
            sensitivity: act.sensitivity,
            paddingRatio: act.paddingRatio,
            aspectMode: act.aspectMode
          })
          if (cancelled) return
          const after = useImageSmartCropBatchUiStore.getState()
          const still = after.queue
            .find((q) => q.localId === after.selectedLocalId)
            ?.inputPath?.trim()
          if (still !== p) return
          setPreviewAnalysis(r)
        } catch {
          if (cancelled) return
          setPreviewAnalysis(null)
        } finally {
          if (!cancelled) setBusyPreviewAnalyze(false)
        }
      })()
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [desktop, selected?.inputPath, ui.aspectMode, ui.paddingRatio, ui.sensitivity])

  const rebuildOutputs = useCallback(() => {
    const folder = useImageSmartCropBatchUiStore.getState().outputFolder
    const fmt = useImageSmartCropBatchUiStore.getState().outputFormat
    useImageSmartCropBatchUiStore.setState((s) => ({
      queue: s.queue.map((q) => ({
        ...q,
        outputPath: folder ? joinDirFile(folder, defaultOutName(q.inputPath, fmt)) : ''
      }))
    }))
  }, [])

  useEffect(() => {
    rebuildOutputs()
  }, [ui.outputFolder, ui.outputFormat, rebuildOutputs])

  const enqueueAcceptedPaths = useCallback(
    (paths: string[]) => {
      const v = validateDroppedImageFilePaths(paths)
      if (!v.ok) {
        toast.error(v.message)
        return
      }
      ui.addPaths(v.paths)
      queueMicrotask(() => rebuildOutputs())
    },
    [rebuildOutputs, ui]
  )

  const busy =
    job.status === 'processing' || job.status === 'queued' || job.zip.status === 'running'

  const inputDrop = useInputVideoDrop({
    disabled: busy,
    multiple: true,
    validatePaths: validateDroppedImageFilePaths,
    onPathsAccepted: enqueueAcceptedPaths
  })

  const addFiles = async (): Promise<void> => {
    const picked = await desktop.pickImageFiles()
    enqueueAcceptedPaths(picked)
  }

  const addFolder = async (): Promise<void> => {
    const picked = await desktop.pickOutputFolder()
    if (!picked) return
    const files = await desktop.scanImageSmartCropFolder(picked)
    if (files.length === 0) {
      toast.error('Thư mục không có ảnh hợp lệ để crop.')
      return
    }
    const v = validateDroppedImageFilePaths(files)
    if (!v.ok) {
      toast.error(v.message)
      return
    }
    ui.addPaths(v.paths, { scannedRoot: picked })
    queueMicrotask(() => rebuildOutputs())
  }

  const pickOutputFolder = async (): Promise<void> => {
    const dir = await desktop.pickOutputFolder()
    ui.setOutputFolder(dir)
  }

  const totalProgress = useMemo(() => {
    if (job.total <= 0) return 0
    const items = Object.values(job.items)
    if (items.length === 0) return 0
    const sum = items.reduce((acc, it) => acc + Math.max(0, Math.min(1, it.progress)), 0)
    return sum / job.total
  }, [job.items, job.total])

  const doneCount = useMemo(
    () => Object.values(job.items).filter((x) => x.status === 'completed').length,
    [job.items]
  )

  const iw = previewAnalysis?.image.width ?? 0
  const ih = previewAnalysis?.image.height ?? 0

  const tightRectForPreview: CropRect | null = useMemo(() => {
    const a = previewAnalysis
    if (!a?.cropRect) return null
    return a.tightSaliencyRect ?? a.cropRect
  }, [previewAnalysis])

  const paddingAppliedPx = previewAnalysis?.paddingAppliedPx ?? 0
  const tightDetect = previewAnalysis?.tightSaliencyRect
  const showTightDetectOverlay =
    tightDetect != null &&
    previewAnalysis != null &&
    iw > 0 &&
    ih > 0 &&
    !rectAlmostEqual(tightDetect, previewAnalysis.cropRect)

  const startBatch = async (): Promise<void> => {
    if (!ui.outputFolder?.trim()) {
      toast.error('Chọn thư mục đầu ra trước.')
      return
    }
    if (ui.queue.length === 0) {
      toast.error('Hàng đợi trống.')
      return
    }
    const boot = job.bootstrapQueue(
      ui.queue.map((q) => ({
        localId: q.localId,
        inputPath: q.inputPath,
        outputPath: q.outputPath
      }))
    )

    const items = ui.queue.map((q) => ({
      jobId: boot.jobIdByLocalId[q.localId]!,
      inputPath: q.inputPath,
      outputPath: q.outputPath
    }))

    const req: StartImageSmartCropBatchRequest = {
      batchId: boot.batchId,
      outputFormat: ui.outputFormat,
      aspectMode: ui.aspectMode,
      paddingRatio: ui.paddingRatio,
      sensitivity: ui.sensitivity,
      keepAlpha: ui.keepAlpha,
      zipOutput: ui.zipOutput,
      batchZipSourceFolderPath: ui.sourceFolder,
      items
    }
    await desktop.startImageSmartCropBatch(req)
    toast.message(`Đã xếp hàng ${items.length} ảnh.`)
  }

  const cancelBatch = async (): Promise<void> => {
    if (!job.batchId) return
    await desktop.cancelImageSmartCropBatch(job.batchId)
  }

  const openOutputFolder = async (): Promise<void> => {
    if (!ui.outputFolder) return
    await shellOpenDirectory(ui.outputFolder)
  }

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 ring-1 ring-white/4">
        <div
          {...inputDrop.getRootProps({
            className: cn(
              'relative min-h-0 p-5 outline-none transition-[box-shadow,background-color] duration-150',
              inputDrop.surface === 'dragging' &&
                'bg-primary/[0.06] ring-2 ring-inset ring-primary/25',
              inputDrop.surface === 'accepted' &&
                'bg-emerald-500/[0.05] ring-2 ring-inset ring-emerald-500/35',
              (inputDrop.surface === 'rejected' || inputDrop.surface === 'error') &&
                'bg-destructive/[0.06] ring-2 ring-inset ring-destructive/40'
            )
          })}
        >
          <input
            {...inputDrop.getInputProps({
              className: 'sr-only',
              'aria-label': 'Thả nhiều ảnh vào hàng đợi'
            })}
          />
          <div className="space-y-5">
            <Card className="border-border/80 bg-transparent shadow-none">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-4 text-muted-foreground" aria-hidden />
                  Hàng đợi
                </CardTitle>
                <CardDescription>
                  Thêm ảnh (kéo thả, tệp hoặc thư mục). Đường dẫn ra = thư mục đích + hậu tố{' '}
                  <span className="font-mono text-[11px]">*_smart</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void addFiles()}
                  >
                    <Images className="mr-2 size-4" aria-hidden />
                    Thêm tệp
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void addFolder()}
                  >
                    <FolderOpen className="mr-2 size-4" aria-hidden />
                    Thêm thư mục
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void pickOutputFolder()}
                  >
                    <FolderOpen className="mr-2 size-4" aria-hidden />
                    Thư mục đầu ra
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => void startBatch()}>
                    {busy ? (
                      <Spinner className="size-4" />
                    ) : (
                      <Play className="mr-2 size-4" aria-hidden />
                    )}
                    Bắt đầu batch
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!busy}
                    onClick={() => void cancelBatch()}
                  >
                    <Square className="mr-2 size-4" aria-hidden />
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      resetImageSmartCropBatchSession()
                      setSelectedPreviewUrl(null)
                    }}
                  >
                    Reset
                  </Button>
                </div>
                {ui.outputFolder ? (
                  <p className="break-all text-xs text-muted-foreground">
                    Đầu ra: {ui.outputFolder}
                  </p>
                ) : (
                  <p className="text-xs text-amber-600/90">Chưa chọn thư mục đầu ra.</p>
                )}
                <ScrollArea className="h-56 rounded-md border border-border/80">
                  <ul className="divide-y divide-border/60 p-2 text-sm">
                    {ui.queue.length === 0 ? (
                      <li className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground">
                        Chưa có tệp.
                      </li>
                    ) : (
                      ui.queue.map((r) => (
                        <li
                          key={r.localId}
                          className={cn(
                            'flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 transition-colors',
                            ui.selectedLocalId === r.localId && 'bg-muted/40'
                          )}
                          onClick={() => ui.setSelected(r.localId)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">
                              {fileNameFromPath(r.inputPath)}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {r.outputPath || '-'}
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="size-8 shrink-0 p-0"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation()
                              ui.removeItem(r.localId)
                            }}
                            aria-label="Xóa khỏi hàng đợi"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </li>
                      ))
                    )}
                  </ul>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-transparent shadow-none">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle>Thiết lập batch</CardTitle>
                <CardDescription>
                  Định dạng, tỉ lệ, padding, độ nhạy - áp dụng mọi ảnh trong lượt chạy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Định dạng đầu ra</Label>
                    <Select
                      value={ui.outputFormat}
                      onValueChange={(v) => ui.setOutputFormat(v as ImageSmartCropOutputFormat)}
                      disabled={busy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_FORMATS.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f.toUpperCase()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tỉ lệ khung</Label>
                    <Select
                      value={ui.aspectMode}
                      onValueChange={(v) => ui.setAspectMode(v as SmartCropAspectMode)}
                      disabled={busy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASPECT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Padding</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {ui.paddingRatio.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[ui.paddingRatio]}
                    min={0}
                    max={0.25}
                    step={0.01}
                    disabled={busy}
                    onValueChange={(v) => ui.setPaddingRatio(v[0] ?? ui.paddingRatio)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Độ nhạy (saliency)</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {ui.sensitivity.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[ui.sensitivity]}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={busy}
                    onValueChange={(v) => ui.setSensitivity(v[0] ?? ui.sensitivity)}
                  />
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
                  <Label
                    htmlFor="batch-keep-alpha"
                    className="min-w-0 cursor-pointer space-y-1 font-normal"
                  >
                    <span className="block text-sm font-medium">Giữ alpha</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      Nếu định dạng hỗ trợ.
                    </span>
                  </Label>
                  <Checkbox
                    id="batch-keep-alpha"
                    checked={ui.keepAlpha}
                    disabled={busy}
                    onCheckedChange={(v) => ui.setKeepAlpha(v === true)}
                    className="mt-0.5 shrink-0"
                  />
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
                  <Label
                    htmlFor="batch-zip"
                    className="min-w-0 cursor-pointer space-y-1 font-normal"
                  >
                    <span className="block text-sm font-medium">ZIP sau batch</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      Chỉ gói các ảnh thành công.
                    </span>
                  </Label>
                  <Checkbox
                    id="batch-zip"
                    checked={ui.zipOutput}
                    disabled={busy}
                    onCheckedChange={(v) => ui.setZipOutput(v === true)}
                    className="mt-0.5 shrink-0"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>

      <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
        <div className="flex flex-col gap-5 p-4 pr-3">
          <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
            <CardHeader className="space-y-1">
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Ảnh gốc và khung crop theo cài đặt bên trái - cùng cách xem như chế độ một ảnh.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selected ? (
                <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                  Chọn một dòng trong danh sách để xem.
                </div>
              ) : busyPreviewAnalyze && !previewAnalysis ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  <span>Đang phân tích khung crop…</span>
                </div>
              ) : null}

              {selected && previewAnalysis ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Nguồn: {iw}×{ih}px · Độ tin cậy:{' '}
                    <span className="font-medium text-foreground">
                      {(previewAnalysis.confidence * 100).toFixed(0)}%
                    </span>
                    {previewAnalysis.fallbackUsed ? (
                      <span className="text-amber-600/90 dark:text-amber-400/90"> · fallback</span>
                    ) : null}
                  </p>
                  <p className="wrap-break-word font-mono text-[11px] text-muted-foreground/90">
                    {previewAnalysis.detail}
                  </p>
                  <p>
                    Detect chặt:{' '}
                    {tightRectForPreview
                      ? `${Math.round(tightRectForPreview.width)}×${Math.round(tightRectForPreview.height)} @ (${Math.round(tightRectForPreview.x)},${Math.round(tightRectForPreview.y)})`
                      : '-'}{' '}
                    · padding ±{Math.round(paddingAppliedPx)}px · crop xuất:{' '}
                    {Math.round(previewAnalysis.cropRect.width)}×
                    {Math.round(previewAnalysis.cropRect.height)} @ (
                    {Math.round(previewAnalysis.cropRect.x)},
                    {Math.round(previewAnalysis.cropRect.y)})
                    {!previewAnalysis.tightSaliencyRect ? (
                      <span className="text-amber-600/90 dark:text-amber-400/90">
                        {' '}
                        (thiếu bbox detect - fallback cropRect)
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : selected && !busyPreviewAnalyze && !previewAnalysis ? (
                <p className="text-sm text-muted-foreground">Chưa phân tích được khung crop.</p>
              ) : null}

              {selectedPreviewUrl ? (
                <div className="space-y-1.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Ảnh gốc (chưa crop)
                  </div>
                  <div
                    className={cn(
                      'relative w-full overflow-hidden rounded-lg border border-border/80',
                      SMART_CROP_PREVIEW_CHECKER_SURFACE
                    )}
                  >
                    <img
                      src={selectedPreviewUrl}
                      alt="Ảnh đang chọn"
                      className="relative z-0 block h-auto max-h-[min(52vh,520px)] w-full object-contain"
                    />
                    {previewAnalysis && iw > 0 && ih > 0 ? (
                      <>
                        {showTightDetectOverlay && tightDetect ? (
                          <div
                            className="pointer-events-none absolute z-5 border-2 border-dashed border-amber-500 shadow-[0_0_0_1px_rgba(0,0,0,0.25)] dark:border-amber-400"
                            style={{
                              left: `${(tightDetect.x / iw) * 100}%`,
                              top: `${(tightDetect.y / ih) * 100}%`,
                              width: `${(tightDetect.width / iw) * 100}%`,
                              height: `${(tightDetect.height / ih) * 100}%`
                            }}
                            title="Vùng saliency (trước padding)"
                          />
                        ) : null}
                        <div
                          className="pointer-events-none absolute z-10 border-2 border-primary shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                          style={{
                            left: `${(previewAnalysis.cropRect.x / iw) * 100}%`,
                            top: `${(previewAnalysis.cropRect.y / ih) * 100}%`,
                            width: `${(previewAnalysis.cropRect.width / iw) * 100}%`,
                            height: `${(previewAnalysis.cropRect.height / ih) * 100}%`
                          }}
                          title="Vùng sẽ xuất"
                        />
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <Separator className="opacity-60" />

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="shrink-0">Tiến độ batch</Label>
                  {busy ? (
                    <Spinner className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {doneCount}/{job.total || ui.queue.length}
                  </span>
                </div>
                <Progress value={Math.round(totalProgress * 100)} />
              </div>

              {job.zip.status === 'completed' && job.zip.result ? (
                <div className="rounded-lg border border-border/80 bg-background/40 p-3 text-sm">
                  <p className="break-all text-xs text-muted-foreground">
                    ZIP: {job.zip.result.zipPath}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await shellOpenPath(job.zip.result!.zipPath)
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Không mở được ZIP')
                        }
                      }}
                    >
                      Mở ZIP
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await shellRevealFile(job.zip.result!.zipPath)
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Không mở thư mục')
                        }
                      }}
                    >
                      Thư mục
                    </Button>
                  </div>
                </div>
              ) : job.zip.status === 'running' ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner className="size-4" />
                  <span>Đang tạo ZIP…</span>
                </div>
              ) : job.zip.status === 'failed' ? (
                <div className="rounded-lg border border-border/80 bg-muted/30 p-3 text-sm text-foreground">
                  ZIP lỗi: {job.zip.error}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!ui.outputFolder}
                  onClick={() => void openOutputFolder()}
                >
                  Mở thư mục đầu ra
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
            <CardHeader className="space-y-1">
              <CardTitle>Logs</CardTitle>
              <CardDescription>Tiến trình chính (Sharp).</CardDescription>
            </CardHeader>
            <CardContent>
              <ChromaTerminalFrame title="Sharp · smart crop">
                <ScrollArea className="h-[min(16rem,32vh)] min-h-40">
                  <pre className="whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
                    {job.logs.join('\n')}
                  </pre>
                </ScrollArea>
              </ChromaTerminalFrame>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
