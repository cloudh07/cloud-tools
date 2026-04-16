import { useInputVideoDrop } from '@/features/input-file-drop'
import { resetImageSmartCropSession } from '@/features/image-smart-crop/application/reset-image-smart-crop-session'
import { useImageSmartCropJobStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-job.store'
import { useImageSmartCropUiStore } from '@/features/image-smart-crop/application/stores/image-smart-crop-ui.store'
import { validateDroppedImageFilePaths } from '@/features/image-smart-crop/domain/dropped-image-paths'
import {
  AUTO_ANALYZE_DEBOUNCE_MS,
  rectAlmostEqual,
  SMART_CROP_PREVIEW_CHECKER_SURFACE
} from '@/features/image-smart-crop/presentation/lib/smart-crop-preview-helpers'
import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import { fileNameFromPath, stemFromPath } from '@/shared/lib/local-file-path'
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
import { Input } from '@/shared/presentation/components/ui/input'
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
  SmartCropAspectMode
} from '@shared/domain/image-smart-crop'
import { outputFormatSupportsAlpha } from '@shared/domain/image-smart-crop'
import { useRouteContext } from '@tanstack/react-router'
import { FolderOpen, Play, Square } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

export type ImageSmartCropSingleWorkspaceProps = {
  onMultipleFilesAccepted: (paths: string[]) => void
}

function defaultExportName(inputPath: string, format: ImageSmartCropOutputFormat): string {
  const stem = stemFromPath(inputPath)
  const ext = format === 'jpeg' ? 'jpg' : format === 'tiff' ? 'tif' : format
  return `${stem}_smart.${ext}`
}

const OUTPUT_FORMATS: readonly ImageSmartCropOutputFormat[] = [
  'png',
  'jpeg',
  'webp',
  'avif',
  'tiff'
]

const ASPECT_OPTIONS: readonly { value: SmartCropAspectMode; label: string }[] = [
  { value: 'free', label: 'Tự do (theo vùng nổi bật)' },
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' }
]

export function ImageSmartCropSingleWorkspace({
  onMultipleFilesAccepted
}: ImageSmartCropSingleWorkspaceProps): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })

  const ui = useImageSmartCropUiStore()
  const job = useImageSmartCropJobStore()
  const exportOutputPath = useImageSmartCropJobStore((s) =>
    s.status === 'completed' && s.lastOutputPath ? s.lastOutputPath : null
  )
  const exportJobId = useImageSmartCropJobStore((s) =>
    s.status === 'completed' && s.lastOutputPath ? s.jobId : null
  )

  const [busyAnalyze, setBusyAnalyze] = useState<boolean>(false)
  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(null)
  const lastAutoAnalyzedPathRef = useRef<string | null>(null)

  useEffect(() => {
    const p = useImageSmartCropUiStore.getState().inputPath
    if (!p) {
      useImageSmartCropUiStore.getState().setInputPreviewUrl(null)
      return
    }
    let cancelled = false
    void desktop.toFileUrl(p).then(
      (u) => {
        if (!cancelled) useImageSmartCropUiStore.getState().setInputPreviewUrl(u)
      },
      () => {
        if (!cancelled) useImageSmartCropUiStore.getState().setInputPreviewUrl(null)
      }
    )
    return () => {
      cancelled = true
    }
  }, [desktop, ui.inputPath])

  useEffect(() => {
    if (!exportOutputPath) {
      setOutputPreviewUrl(null)
      return
    }
    let cancelled = false
    void desktop.toFileUrl(exportOutputPath).then(
      (url) => {
        if (cancelled) return
        const bust = exportJobId ?? 'done'
        const join = url.includes('?') ? '&' : '?'
        setOutputPreviewUrl(`${url}${join}v=${encodeURIComponent(bust)}`)
      },
      () => {
        if (!cancelled) setOutputPreviewUrl(null)
      }
    )
    return () => {
      cancelled = true
    }
  }, [desktop, exportJobId, exportOutputPath])

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
      const next = v.paths[0]!
      useImageSmartCropUiStore.getState().setInputPath(next)
      useImageSmartCropUiStore.getState().setAnalysis(null)
      useImageSmartCropUiStore.getState().setChosenOutputPath(null)
      useImageSmartCropJobStore.getState().reset()
    },
    [onMultipleFilesAccepted]
  )

  const busy = job.status === 'running' || job.status === 'queued' || job.status === 'cancelling'

  const inputDrop = useInputVideoDrop({
    disabled: busy,
    multiple: true,
    validatePaths: validateDroppedImageFilePaths,
    onPathsAccepted: applyDroppedPaths
  })

  useEffect(() => {
    const path = ui.inputPath?.trim() ?? ''
    if (!path) {
      lastAutoAnalyzedPathRef.current = null
      setBusyAnalyze(false)
      return
    }
    if (busy) {
      setBusyAnalyze(false)
      return
    }

    const pathChanged = lastAutoAnalyzedPathRef.current !== path
    if (pathChanged) lastAutoAnalyzedPathRef.current = path

    const delayMs = pathChanged ? 0 : AUTO_ANALYZE_DEBOUNCE_MS
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled) return
        setBusyAnalyze(true)
        const act = useImageSmartCropUiStore.getState()
        const inputPath = act.inputPath?.trim()
        if (!inputPath) {
          if (!cancelled) setBusyAnalyze(false)
          return
        }
        try {
          const r = await desktop.analyzeImageSmartCrop({
            inputPath,
            sensitivity: act.sensitivity,
            paddingRatio: act.paddingRatio,
            aspectMode: act.aspectMode
          })
          if (cancelled) return
          act.setAnalysis(r)
          if (r.fallbackUsed) {
            toast.message(
              'Độ tin cậy vùng nổi bật thấp - đã dùng crop bảo thủ quanh centroid năng lượng (không phải cắt giữa tĩnh).'
            )
          }
        } catch (e) {
          if (cancelled) return
          toast.error(e instanceof Error ? e.message : 'Phân tích thất bại')
          act.setAnalysis(null)
        } finally {
          if (!cancelled) setBusyAnalyze(false)
        }
      })()
    }, delayMs)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [busy, desktop, ui.aspectMode, ui.inputPath, ui.paddingRatio, ui.sensitivity])

  const showProgressPercent = job.status === 'running' || job.status === 'cancelling'
  const progressPercent = useMemo(
    () => Math.min(100, Math.max(0, Math.round(job.progress * 100))),
    [job.progress]
  )

  const alphaHint = useMemo(() => {
    if (outputFormatSupportsAlpha(ui.outputFormat) && !ui.keepAlpha) {
      return 'Định dạng đích hỗ trợ alpha nhưng bạn tắt giữ alpha - ảnh sẽ được flatten nền trắng trước khi mã hóa.'
    }
    if (!outputFormatSupportsAlpha(ui.outputFormat) && ui.keepAlpha) {
      return 'Định dạng đích không hỗ trợ alpha - kênh trong suốt sẽ bị flatten nền trắng.'
    }
    return null
  }, [ui.keepAlpha, ui.outputFormat])

  const pickInput = async (): Promise<void> => {
    const p = await desktop.pickImageFile()
    if (!p) return
    applyDroppedPaths([p])
  }

  const pickOutputThenStart = async (): Promise<void> => {
    if (!ui.inputPath || !ui.analysis) {
      toast.error('Cần ảnh và khung crop (đợi phân tích tự động).')
      return
    }
    const def = defaultExportName(ui.inputPath, ui.outputFormat)
    const out = await desktop.pickImageSavePath({ defaultPath: def, format: ui.outputFormat })
    if (!out) return
    ui.setChosenOutputPath(out)
    const jobId = crypto.randomUUID()
    job.markQueued(jobId)
    try {
      await desktop.startImageSmartCropJob({
        jobId,
        inputPath: ui.inputPath,
        outputPath: out,
        outputFormat: ui.outputFormat,
        cropRect: ui.analysis.cropRect,
        keepAlpha: ui.keepAlpha,
        jpegQuality: 90,
        webpQuality: 85
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không thể bắt đầu')
      job.reset()
    }
  }

  const cancelRun = (): void => {
    const id = job.jobId
    if (id) void desktop.cancelImageSmartCropJob(id)
    job.markCancelling()
  }

  const iw = ui.analysis?.image.width ?? 0
  const ih = ui.analysis?.image.height ?? 0

  const tightRectForPreview: CropRect | null = useMemo(() => {
    const a = ui.analysis
    if (!a?.cropRect) return null
    return a.tightSaliencyRect ?? a.cropRect
  }, [ui.analysis])

  const paddingAppliedPx = ui.analysis?.paddingAppliedPx ?? 0

  const tightDetect = ui.analysis?.tightSaliencyRect
  const showTightDetectOverlay =
    tightDetect != null &&
    ui.analysis != null &&
    iw > 0 &&
    ih > 0 &&
    !rectAlmostEqual(tightDetect, ui.analysis.cropRect)

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 shadow-none ring-1 ring-white/4">
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
              'aria-label':
                'Thả ảnh vào đây. Một tệp để xem trước crop, nhiều tệp sẽ chuyển sang chế độ hàng loạt'
            })}
          />
          {inputDrop.surface === 'dragging' ? (
            <div
              className="pointer-events-none absolute inset-0 z-1 rounded-[inherit] bg-background/15 ring-1 ring-inset ring-primary/20"
              aria-hidden
            />
          ) : null}
          <div className="relative z-2 space-y-5">
            <Card className="border-border/80 bg-transparent shadow-none">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle>Ảnh nguồn</CardTitle>
                <CardDescription>
                  Kéo thả hoặc chọn tệp. Một ảnh: phân tích và crop tại chỗ. Nhiều ảnh: tự chuyển
                  sang tab hàng loạt. Hỗ trợ PNG/JPEG/WebP/GIF/TIFF/AVIF/BMP/HEIC/JXL/SVG (Sharp /
                  libvips).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tệp</Label>
                  <div className="flex gap-2">
                    <Input
                      value={ui.inputPath ?? ''}
                      readOnly
                      placeholder="Chưa chọn ảnh"
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0 gap-2"
                      disabled={busy}
                      onClick={() => void pickInput()}
                    >
                      <FolderOpen className="size-4" aria-hidden />
                      Chọn
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-transparent shadow-none">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle>Định dạng &amp; crop</CardTitle>
                <CardDescription>
                  Phân tích saliency tự động (debounce khi đổi padding / độ nhạy / tỉ lệ). Chọn định
                  dạng đầu ra trước khi bấm Bắt đầu.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
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
                  <Label>Tỉ lệ khung crop</Label>
                  <Select
                    value={ui.aspectMode}
                    onValueChange={(v) => ui.setAspectMode(v as SmartCropAspectMode)}
                    disabled={busy || busyAnalyze}
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

                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <Label>Padding quanh object</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {ui.paddingRatio.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[ui.paddingRatio]}
                    min={0}
                    max={0.25}
                    step={0.01}
                    disabled={busy || busyAnalyze}
                    onValueChange={(v) => ui.setPaddingRatio(v[0] ?? ui.paddingRatio)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tỉ lệ nhân cạnh ngắn của bbox sau detect - mặc định nhỏ để crop sát object.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <Label>Độ nhạy (salient)</Label>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {ui.sensitivity.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    value={[ui.sensitivity]}
                    min={0}
                    max={1}
                    step={0.01}
                    disabled={busy || busyAnalyze}
                    onValueChange={(v) => ui.setSensitivity(v[0] ?? ui.sensitivity)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Giá trị cao hơn sẽ giữ nhiều phần biên hơn, còn thấp hơn thì chỉ giữ lại vùng
                    nổi bật nhất.
                  </p>
                </div>

                <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
                  <Label
                    htmlFor="smart-crop-keep-alpha"
                    className="min-w-0 cursor-pointer space-y-1 font-normal"
                  >
                    <span className="block text-sm font-medium">Giữ alpha khi có thể</span>
                    <span className="block text-xs leading-relaxed text-muted-foreground">
                      Tắt để flatten nền trắng trước khi mã hóa.
                    </span>
                  </Label>
                  <Checkbox
                    id="smart-crop-keep-alpha"
                    checked={ui.keepAlpha}
                    disabled={busy}
                    onCheckedChange={(v) => ui.setKeepAlpha(v === true)}
                    className="mt-0.5 shrink-0"
                  />
                </div>

                {alphaHint ? (
                  <p className="text-xs text-amber-600/90 dark:text-amber-400/90">{alphaHint}</p>
                ) : null}

                <Separator className="opacity-60" />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={!ui.analysis || busy || busyAnalyze}
                    onClick={() => void pickOutputThenStart()}
                  >
                    {busy ? <Spinner className="size-4" /> : <Play className="size-4" />}
                    Bắt đầu
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!busy || job.status === 'cancelling'}
                    onClick={cancelRun}
                  >
                    <Square className="size-4" />
                    Hủy
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      resetImageSmartCropSession()
                      setOutputPreviewUrl(null)
                    }}
                  >
                    Reset
                  </Button>
                </div>

                {ui.chosenOutputPath ? (
                  <p className="break-all text-xs text-muted-foreground">
                    Đích ra gần nhất: {ui.chosenOutputPath}
                  </p>
                ) : null}

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="shrink-0">Tiến độ</Label>
                    {busy || busyAnalyze ? (
                      <Spinner className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    ) : null}
                    {busy && showProgressPercent ? (
                      <span className="text-sm font-medium tabular-nums">{progressPercent}%</span>
                    ) : null}
                  </div>
                  <Progress value={progressPercent} />
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
                Ảnh gốc và khung crop. Đầu ra hiển thị sau khi job hoàn tất. Nền caro biểu thị
                alpha. Viền vàng đứt là vùng detect chặt, còn viền primary là vùng xuất file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ui.analysis ? (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>
                    Nguồn: {iw}×{ih}px · Độ tin cậy:{' '}
                    <span className="font-medium text-foreground">
                      {(ui.analysis.confidence * 100).toFixed(0)}%
                    </span>
                    {ui.analysis.fallbackUsed ? (
                      <span className="text-amber-600/90 dark:text-amber-400/90"> · fallback</span>
                    ) : null}
                  </p>
                  <p className="wrap-break-word font-mono text-[11px] text-muted-foreground/90">
                    {ui.analysis.detail}
                  </p>
                  <p>
                    Detect chặt:{' '}
                    {tightRectForPreview
                      ? `${Math.round(tightRectForPreview.width)}×${Math.round(tightRectForPreview.height)} @ (${Math.round(tightRectForPreview.x)},${Math.round(tightRectForPreview.y)})`
                      : '-'}{' '}
                    · padding ±{Math.round(paddingAppliedPx)}px · crop xuất:{' '}
                    {Math.round(ui.analysis.cropRect.width)}×
                    {Math.round(ui.analysis.cropRect.height)} @ (
                    {Math.round(ui.analysis.cropRect.x)},{Math.round(ui.analysis.cropRect.y)})
                    {!ui.analysis.tightSaliencyRect ? (
                      <span className="text-amber-600/90 dark:text-amber-400/90">
                        {' '}
                        (thiếu bbox detect - fallback cropRect)
                      </span>
                    ) : null}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {busyAnalyze && ui.inputPath ? (
                    <>
                      <Spinner className="size-4" />
                      <span>Đang phân tích…</span>
                    </>
                  ) : ui.inputPath ? (
                    <span>Chưa có khung crop.</span>
                  ) : (
                    <span>Chọn ảnh để phân tích saliency.</span>
                  )}
                </div>
              )}

              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Đầu vào - ảnh gốc (chưa crop)
                </div>
                <div
                  className={cn(
                    'relative w-full overflow-hidden rounded-lg border border-border/80',
                    SMART_CROP_PREVIEW_CHECKER_SURFACE
                  )}
                >
                  {ui.inputPreviewUrl ? (
                    <>
                      <img
                        src={ui.inputPreviewUrl}
                        alt="Ảnh gốc"
                        className="relative z-0 block h-auto max-h-[min(52vh,520px)] w-full object-contain"
                      />
                      {ui.analysis && iw > 0 && ih > 0 ? (
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
                              title="Bbox saliency (trước padding)"
                            />
                          ) : null}
                          <div
                            className="pointer-events-none absolute z-10 border-2 border-primary shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                            style={{
                              left: `${(ui.analysis.cropRect.x / iw) * 100}%`,
                              top: `${(ui.analysis.cropRect.y / ih) * 100}%`,
                              width: `${(ui.analysis.cropRect.width / iw) * 100}%`,
                              height: `${(ui.analysis.cropRect.height / ih) * 100}%`
                            }}
                            title="Vùng xuất file"
                          />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
                      Chưa có ảnh
                    </div>
                  )}
                </div>
              </div>

              {exportOutputPath ? (
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <div className="text-xs font-medium text-muted-foreground">
                    Đầu ra - tệp đã xuất
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label className="max-w-[min(100%,28rem)] truncate font-normal">
                      {fileNameFromPath(exportOutputPath)}
                    </Label>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            await shellOpenPath(exportOutputPath)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Không thể mở tệp')
                          }
                        }}
                      >
                        Mở tệp
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await shellRevealFile(exportOutputPath)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Không thể mở thư mục')
                          }
                        }}
                      >
                        Thư mục
                      </Button>
                    </div>
                  </div>
                  {outputFormatSupportsAlpha(ui.outputFormat) && ui.keepAlpha ? (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Định dạng có alpha: một số trình xem hiển thị trong suốt thành xám - giới hạn
                      viewer.
                    </p>
                  ) : null}
                  {outputPreviewUrl ? (
                    <div
                      className={cn(
                        'overflow-hidden rounded-lg border border-border/80',
                        SMART_CROP_PREVIEW_CHECKER_SURFACE
                      )}
                    >
                      <img
                        key={`out:${exportOutputPath}:${outputPreviewUrl}`}
                        src={outputPreviewUrl}
                        alt="Ảnh đã crop"
                        className="relative z-0 block h-auto max-h-[min(48vh,480px)] w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex min-h-30 items-center justify-center rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground">
                      Không tạo được URL xem trước.
                    </div>
                  )}
                </div>
              ) : null}
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
