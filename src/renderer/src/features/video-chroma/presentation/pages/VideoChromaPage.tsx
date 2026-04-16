import { useSettingsStore } from '@/application/stores/settings.store'
import { useInputVideoDrop } from '@/features/input-file-drop'
import { validateChromaDroppedInputPath } from '@/features/video-chroma/domain/chroma-dropped-input-path'
import {
  cancelVideoProcessing,
  startVideoProcessing
} from '@/features/video-chroma/application/start-video-processing.use-case'
import { resetVideoChromaSession } from '@/features/video-chroma/application/reset-video-chroma-session'
import { useVideoChromaEnhanceStore } from '@/features/video-chroma/application/stores/video-chroma-enhance.store'
import { useVideoChromaJobStore } from '@/features/video-chroma/application/stores/video-chroma-job.store'
import { useVideoChromaUiStore } from '@/features/video-chroma/application/stores/video-chroma-ui.store'
import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import {
  dismissVideoChromaToasts,
  useVideoChromaTerminalToasts
} from '@/features/video-chroma/presentation/hooks/use-video-chroma-terminal-toasts'
import { formatMediaDurationSeconds } from '@/features/video-chroma/presentation/lib/format-media-time'
import {
  chromaEnhancePresetLabelVi,
  jobPhaseVi,
  jobStatusVi,
  keyingKindLabelVi,
  outputModeLabelVi,
  qualityPresetLabelVi
} from '@/shared/i18n/vi-labels'
import { Badge } from '@/shared/presentation/components/ui/badge'
import { Button } from '@/shared/presentation/components/ui/button'
import { Checkbox } from '@/shared/presentation/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
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
import {
  ChromaEnhancePreset,
  type ChromaEnhancePreset as ChromaEnhancePresetId
} from '@shared/domain/chroma-enhance'
import { ChromaKeyingKind } from '@shared/domain/chroma-keying-kind'
import { describeChromaEnhancePreset } from '@shared/infrastructure/ffmpeg/chroma-enhance-params'
import { buildChromaPostEnhanceCommand } from '@shared/infrastructure/ffmpeg/chroma-post-enhance-command'
import {
  buildTranscodeCommand,
  buildWebpCommand
} from '@shared/infrastructure/ffmpeg/ffmpeg-command-builder'
import {
  buildChromaEnhancePartialVideoPath,
  buildChromaStagingVideoPath
} from '@shared/infrastructure/paths/chroma-work-paths'
import { VideoOutputMode, VideoQualityPreset } from '@shared/domain/video-output-mode'
import { getRouteApi, useRouteContext } from '@tanstack/react-router'
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import { fileNameFromPath, replaceFileExtension } from '@/shared/lib/local-file-path'
import { cn } from '@/shared/lib/utils'
import { Film, FolderOpen, Square, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

const chromaVideoRouteApi = getRouteApi('/tools/chroma-video')

export function VideoChromaPage(): ReactElement {
  useVideoChromaTerminalToasts()

  const search = chromaVideoRouteApi.useSearch()
  const { desktop } = useRouteContext({ from: '/tools' })
  const { chromaVideo } = useRouteContext({ from: '/tools/chroma-video' })

  const config = useSettingsStore((s) => s.config)

  const inputPath = useVideoChromaUiStore((s) => s.inputPath)
  const ui = useVideoChromaUiStore()
  const job = useVideoChromaJobStore()
  const enhanceStatus = useVideoChromaEnhanceStore((s) => s.status)
  const enhanceProgress = useVideoChromaEnhanceStore((s) => s.progress)
  const enhanceLogs = useVideoChromaEnhanceStore((s) => s.logs)
  const enhanceLastError = useVideoChromaEnhanceStore((s) => s.lastError)
  const exportVideoPath = useVideoChromaJobStore((s) =>
    s.status === 'completed' && s.outputs.video ? s.outputs.video : null
  )
  const exportCompletedMode = useVideoChromaJobStore((s) =>
    s.status === 'completed' ? s.completedMode : null
  )
  const exportJobId = useVideoChromaJobStore((s) =>
    s.status === 'completed' && s.outputs.video ? s.jobId : null
  )

  const [commandPreview, setCommandPreview] = useState<string>('')
  const [playerMeta, setPlayerMeta] = useState<{
    durationSec: number
    width: number
    height: number
  } | null>(null)
  const [exportPreviewUrl, setExportPreviewUrl] = useState<string | null>(null)

  const ffmpegLabel = config?.ffmpegPath?.trim().length ? config.ffmpegPath.trim() : 'ffmpeg'

  useEffect(() => {
    let cancelled = false
    const act = useVideoChromaUiStore.getState()

    async function probe(): Promise<void> {
      if (!inputPath) {
        act.setProbe(null)
        act.setPreviewUrl(null)
        act.setProbeError(null)
        return
      }

      act.setIsProbing(true)
      act.setProbeError(null)
      try {
        const result = await desktop.probeVideo(inputPath)
        if (cancelled) return
        act.setProbe(result)
        const url = await desktop.toFileUrl(inputPath)
        if (cancelled) return
        act.setPreviewUrl(url)
      } catch (e) {
        if (cancelled) return
        act.setProbe(null)
        act.setPreviewUrl(null)
        act.setProbeError(e instanceof Error ? e.message : 'Không thể phân tích video')
      } finally {
        if (!cancelled) act.setIsProbing(false)
      }
    }

    void probe()
    return () => {
      cancelled = true
    }
  }, [desktop, inputPath])

  useEffect(() => {
    if (!search.focus) return
    const anchorId =
      search.focus === 'input'
        ? 'chroma-focus-input'
        : search.focus === 'output'
          ? 'chroma-focus-output'
          : 'chroma-focus-logs'
    requestAnimationFrame(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [search.focus])

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${chromaVideo.title} | Bộ công cụ`
    return () => {
      document.title = prevTitle
    }
  }, [chromaVideo.title])

  useEffect(() => {
    setPlayerMeta(null)
  }, [ui.previewUrl])

  useEffect(() => {
    if (!exportVideoPath) {
      setExportPreviewUrl(null)
      return
    }
    let cancelled = false
    void desktop.toFileUrl(exportVideoPath).then(
      (url) => {
        if (cancelled) return
        const bust = exportJobId ?? 'done'
        const join = url.includes('?') ? '&' : '?'
        setExportPreviewUrl(`${url}${join}v=${encodeURIComponent(bust)}`)
      },
      () => {
        if (!cancelled) setExportPreviewUrl(null)
      }
    )
    return () => {
      cancelled = true
    }
  }, [desktop, exportJobId, exportVideoPath])

  useEffect(() => {
    if (!ui.inputPath || !ui.outputPath || !ui.probe?.width || !ui.probe.height) {
      setCommandPreview('')
      return
    }
    try {
      const fps = ui.probe.fps && ui.probe.fps > 0 ? ui.probe.fps : 30
      const lines: string[] = []
      const previewJobId = 'preview'

      if (ui.autoEnhanceOutput) {
        const staging = buildChromaStagingVideoPath(ui.outputPath, previewJobId)
        const partial = buildChromaEnhancePartialVideoPath(ui.outputPath, previewJobId)
        const transcodeStaging = buildTranscodeCommand({
          inputPath: ui.inputPath,
          outputPath: staging,
          mode: ui.mode,
          preset: ui.preset,
          keyingKind: ui.keyingKind,
          keyColor: ui.keyColor.trim(),
          similarity: ui.similarity,
          blend: ui.blend,
          width: ui.probe.width,
          height: ui.probe.height,
          fps,
          durationSec: ui.probe.durationSec
        })
        lines.push(`# 1) Chroma -> file tạm (${staging})`)
        lines.push(`# ${describeChromaEnhancePreset(ui.chromaEnhancePreset)}`)
        lines.push([ffmpegLabel, ...transcodeStaging.args].join(' '))
        const postEnhance = buildChromaPostEnhanceCommand({
          inputPath: staging,
          outputPath: partial,
          mode: ui.mode,
          qualityPreset: ui.preset,
          enhancePreset: ui.chromaEnhancePreset
        })
        lines.push('')
        lines.push(
          `# 2) Enhance (hqdn3d -> unsharp) -> ${partial}, rồi đổi tên -> ${ui.outputPath}`
        )
        lines.push([ffmpegLabel, ...postEnhance.args].join(' '))
      } else {
        const transcode = buildTranscodeCommand({
          inputPath: ui.inputPath,
          outputPath: ui.outputPath,
          mode: ui.mode,
          preset: ui.preset,
          keyingKind: ui.keyingKind,
          keyColor: ui.keyColor.trim(),
          similarity: ui.similarity,
          blend: ui.blend,
          width: ui.probe.width,
          height: ui.probe.height,
          fps,
          durationSec: ui.probe.durationSec
        })
        lines.push(`# mã hóa - ${outputModeLabelVi(ui.mode)}`)
        lines.push([ffmpegLabel, ...transcode.args].join(' '))
      }

      if (ui.exportWebp && ui.webpOutputPath) {
        const webp = buildWebpCommand({
          inputPath: ui.outputPath,
          outputPath: ui.webpOutputPath,
          quality: 82,
          maxWidth: 1280
        })
        lines.push('')
        lines.push('# webp (sau cùng, từ file đích đã hoàn chỉnh)')
        lines.push([ffmpegLabel, ...webp.args].join(' '))
      }

      setCommandPreview(lines.join('\n'))
    } catch {
      setCommandPreview('')
    }
  }, [
    ffmpegLabel,
    ui.autoEnhanceOutput,
    ui.blend,
    ui.chromaEnhancePreset,
    ui.exportWebp,
    ui.inputPath,
    ui.keyingKind,
    ui.keyColor,
    ui.mode,
    ui.outputPath,
    ui.preset,
    ui.probe,
    ui.similarity,
    ui.webpOutputPath
  ])

  const canStart = useMemo(() => {
    if (!ui.inputPath || !ui.outputPath) return false
    if (!ui.probe?.hasVideo || !ui.probe.width || !ui.probe.height) return false
    if (ui.probeError) return false
    if (ui.isProbing) return false
    if (['running', 'queued', 'cancelling'].includes(job.status)) return false
    if (ui.exportWebp && !ui.webpOutputPath) return false
    return true
  }, [
    job.status,
    ui.exportWebp,
    ui.inputPath,
    ui.isProbing,
    ui.outputPath,
    ui.probe,
    ui.probeError,
    ui.webpOutputPath
  ])

  const busy = ['running', 'queued', 'cancelling'].includes(job.status)
  const showProgressPercent = job.status === 'running' || job.status === 'cancelling'

  const applyChromaInputDropPath = useCallback((paths: string[]) => {
    const next = paths[0]
    if (!next) return
    const v = validateChromaDroppedInputPath(next)
    if (!v.ok) {
      toast.error(v.message)
      return
    }
    const act = useVideoChromaUiStore.getState()
    act.setInputPath(v.path)
    act.setOutputPath(null)
    act.setWebpOutputPath(null)
  }, [])

  const chromaInputDrop = useInputVideoDrop({
    disabled: busy,
    multiple: false,
    onPathsAccepted: applyChromaInputDropPath
  })

  const progressPercent = useMemo(
    () => Math.min(100, Math.max(0, Math.round(job.progress * 100))),
    [job.progress]
  )

  const enhanceProgressPercent = useMemo(
    () => Math.min(100, Math.max(0, Math.round(enhanceProgress * 100))),
    [enhanceProgress]
  )

  const showEnhanceProgress =
    ui.autoEnhanceOutput &&
    (job.phase === 'enhance' ||
      enhanceStatus === 'running' ||
      enhanceStatus === 'completed' ||
      enhanceStatus === 'failed')

  const displayDurationSec = useMemo(() => {
    if (playerMeta && Number.isFinite(playerMeta.durationSec) && playerMeta.durationSec > 0) {
      return playerMeta.durationSec
    }
    const p = ui.probe?.durationSec
    return p != null && Number.isFinite(p) && p > 0 ? p : null
  }, [playerMeta, ui.probe?.durationSec])

  const displayWidth =
    (playerMeta && playerMeta.width > 0 ? playerMeta.width : null) ?? ui.probe?.width ?? null
  const displayHeight =
    (playerMeta && playerMeta.height > 0 ? playerMeta.height : null) ?? ui.probe?.height ?? null
  const displayFps = ui.probe?.fps

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Film className="size-5 shrink-0 text-muted-foreground" />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                Công cụ chroma key video
              </h1>
              {search.ref ? (
                <Badge
                  variant="outline"
                  className="max-w-[min(240px,40vw)] shrink-0 truncate font-normal"
                  title={search.ref}
                >
                  ref: {search.ref}
                </Badge>
              ) : null}
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Loại bỏ một màu nền đồng nhất (chroma key cổ điển) và xuất bản nền xanh dạng tấm (MP4
              H.264) hoặc tệp trung gian hỗ trợ độ trong suốt (MOV ProRes 4444). Tuỳ chọn WebP chạy
              thêm một lượt ffmpeg sau khi có đầu ra trung gian.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Badge
              variant="secondary"
              className="h-8 justify-center px-3 text-xs font-medium tracking-wide"
            >
              {jobStatusVi(job.status)}
            </Badge>
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
          <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 shadow-none ring-1 ring-white/4">
            <div
              {...chromaInputDrop.getRootProps({
                className: cn(
                  'relative min-h-0 p-5 outline-none transition-[box-shadow,background-color] duration-150',
                  chromaInputDrop.surface === 'dragging' &&
                    'bg-primary/[0.06] ring-2 ring-inset ring-primary/25',
                  chromaInputDrop.surface === 'accepted' &&
                    'bg-emerald-500/[0.05] ring-2 ring-inset ring-emerald-500/35',
                  (chromaInputDrop.surface === 'rejected' || chromaInputDrop.surface === 'error') &&
                    'bg-destructive/[0.06] ring-2 ring-inset ring-destructive/40'
                )
              })}
            >
              <input
                {...chromaInputDrop.getInputProps({
                  className: 'sr-only',
                  'aria-label': 'Thả một tệp MP4 vào vùng đầu vào'
                })}
              />
              {chromaInputDrop.surface === 'dragging' ? (
                <div
                  className="pointer-events-none absolute inset-0 z-1 rounded-[inherit] bg-background/15 ring-1 ring-inset ring-primary/20"
                  aria-hidden
                />
              ) : null}
              <div className="relative z-2 space-y-5">
                <Card
                  id="chroma-focus-input"
                  className="border-border/80 bg-transparent shadow-none"
                >
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle>Đầu vào</CardTitle>
                    <CardDescription>
                      Chọn tệp MP4 và vị trí lưu đầu ra, hoặc kéo thả một tệp MP4 vào khung này.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Video MP4</Label>
                      <div className="flex gap-2">
                        <Input value={ui.inputPath ?? ''} readOnly placeholder="Chưa chọn tệp" />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 gap-2"
                          onClick={async () => {
                            const picked = await desktop.pickMp4()
                            if (!picked) return
                            ui.setInputPath(picked)
                            ui.setOutputPath(null)
                            ui.setWebpOutputPath(null)
                          }}
                        >
                          <FolderOpen className="size-4" />
                          Thêm
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Đầu ra video</Label>
                      <div className="flex gap-2">
                        <Input
                          value={ui.outputPath ?? ''}
                          readOnly
                          placeholder="Chưa chọn nơi lưu"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0 gap-2"
                          onClick={async () => {
                            const baseName = ui.inputPath
                              ? replaceFileExtension(fileNameFromPath(ui.inputPath), '')
                              : 'output'
                            const defaultName =
                              ui.mode === VideoOutputMode.GREEN_SCREEN
                                ? `${baseName}_greenscreen.mp4`
                                : `${baseName}_alpha.mov`
                            const picked = await desktop.pickSavePath({
                              defaultPath: defaultName,
                              mode:
                                ui.mode === VideoOutputMode.GREEN_SCREEN
                                  ? 'green_screen'
                                  : 'alpha_mov'
                            })
                            if (!picked) return
                            ui.setOutputPath(picked)
                          }}
                        >
                          Lưu
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
                      <Label
                        htmlFor="chroma-export-webp"
                        className="min-w-0 cursor-pointer space-y-1 font-normal"
                      >
                        <span className="block text-sm font-medium">
                          Xuất WebP sau khi xuất video
                        </span>
                        <span className="block text-xs leading-relaxed text-muted-foreground">
                          Chạy thêm một lượt ffmpeg từ tệp đầu ra trung gian.
                        </span>
                      </Label>
                      <Checkbox
                        id="chroma-export-webp"
                        checked={ui.exportWebp}
                        disabled={busy}
                        onCheckedChange={(v) => ui.setExportWebp(v === true)}
                        className="mt-0.5 shrink-0"
                      />
                    </div>

                    {ui.exportWebp ? (
                      <div className="space-y-2">
                        <Label>Đầu ra WebP</Label>
                        <div className="flex gap-2">
                          <Input
                            value={ui.webpOutputPath ?? ''}
                            readOnly
                            placeholder="Chọn đích lưu .webp"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 gap-2"
                            onClick={async () => {
                              const baseName = ui.outputPath
                                ? fileNameFromPath(ui.outputPath)
                                : 'export.webp'
                              const picked = await desktop.pickSavePath({
                                defaultPath: replaceFileExtension(baseName, '.webp'),
                                mode: 'webp'
                              })
                              if (!picked) return
                              ui.setWebpOutputPath(picked)
                            }}
                          >
                            Lưu
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="border-border/80 bg-transparent shadow-none">
                  <CardHeader className="space-y-1 pb-4">
                    <CardTitle>Xử lý</CardTitle>
                    <CardDescription>Tham số chroma key và mức chất lượng.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Chế độ đầu ra</Label>
                        <Select
                          value={ui.mode}
                          onValueChange={(v) => ui.setMode(v as VideoOutputMode)}
                          disabled={busy}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chế độ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={VideoOutputMode.GREEN_SCREEN}>
                              {outputModeLabelVi(VideoOutputMode.GREEN_SCREEN)}
                            </SelectItem>
                            <SelectItem value={VideoOutputMode.ALPHA_MOV}>
                              {outputModeLabelVi(VideoOutputMode.ALPHA_MOV)}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Mức chất lượng</Label>
                        <Select
                          value={ui.preset}
                          onValueChange={(v) =>
                            ui.setPreset(
                              v as (typeof VideoQualityPreset)[keyof typeof VideoQualityPreset]
                            )
                          }
                          disabled={busy}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Chất lượng" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={VideoQualityPreset.FAST}>
                              {qualityPresetLabelVi(VideoQualityPreset.FAST)}
                            </SelectItem>
                            <SelectItem value={VideoQualityPreset.BALANCED}>
                              {qualityPresetLabelVi(VideoQualityPreset.BALANCED)}
                            </SelectItem>
                            <SelectItem value={VideoQualityPreset.QUALITY}>
                              {qualityPresetLabelVi(VideoQualityPreset.QUALITY)}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Phương pháp khóa nền</Label>
                      <Select
                        value={ui.keyingKind}
                        onValueChange={(v) => {
                          ui.setKeyingKind(
                            v as (typeof ChromaKeyingKind)[keyof typeof ChromaKeyingKind]
                          )
                        }}
                        disabled={busy}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Phương pháp" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ChromaKeyingKind.STUDIO_CHROMA}>
                            {keyingKindLabelVi(ChromaKeyingKind.STUDIO_CHROMA)}
                          </SelectItem>
                          <SelectItem value={ChromaKeyingKind.SOLID_RGB}>
                            {keyingKindLabelVi(ChromaKeyingKind.SOLID_RGB)}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {ui.mode === VideoOutputMode.ALPHA_MOV ? (
                        <p className="text-xs text-muted-foreground">
                          Alpha MOV chỉ gói kênh trong suốt, nền vẫn được tách bằng phương pháp và
                          màu khóa bên dưới (không phải alpha sẵn có từ file nguồn).
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="keyColor">Màu khóa (định dạng ffmpeg)</Label>
                      <Input
                        id="keyColor"
                        value={ui.keyColor}
                        onChange={(e) => ui.setKeyColor(e.target.value)}
                        spellCheck={false}
                        disabled={busy}
                      />
                      <div className="text-xs text-muted-foreground">
                        {ui.keyingKind === ChromaKeyingKind.STUDIO_CHROMA ? (
                          <>
                            Ví dụ: <code className="text-foreground/80">0x00FF00</code> cho phông
                            xanh chroma.
                          </>
                        ) : (
                          <>
                            Ví dụ: <code className="text-foreground/80">0x000000</code> nền đen.
                            Tăng similarity nếu còn viền.
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Độ tương đồng (similarity)</Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {ui.similarity.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        value={[ui.similarity]}
                        min={0.01}
                        max={0.45}
                        step={0.01}
                        disabled={busy}
                        onValueChange={(v) => ui.setSimilarity(v[0] ?? ui.similarity)}
                      />
                    </div>

                    <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="autoEnhanceOutput"
                          checked={ui.autoEnhanceOutput}
                          onCheckedChange={(c) => ui.setAutoEnhanceOutput(c === true)}
                          disabled={busy}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Label htmlFor="autoEnhanceOutput" className="cursor-pointer font-medium">
                            Tự động làm nét đầu ra (Auto Enhance)
                          </Label>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            Tự động làm nét lại video sau khi xử lý chroma (denoise nhẹ + sharpen
                            nhẹ trên file thật, chạy nền - không đổi preview đầu vào).
                          </p>
                        </div>
                      </div>
                      {ui.autoEnhanceOutput ? (
                        <div className="space-y-2 pl-7">
                          <Label htmlFor="chromaEnhancePreset">Mức hậu xử lý</Label>
                          <Select
                            value={ui.chromaEnhancePreset}
                            onValueChange={(v) =>
                              ui.setChromaEnhancePreset(v as ChromaEnhancePresetId)
                            }
                            disabled={busy}
                          >
                            <SelectTrigger id="chromaEnhancePreset">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={ChromaEnhancePreset.LIGHT}>
                                {chromaEnhancePresetLabelVi(ChromaEnhancePreset.LIGHT)} -{' '}
                                {describeChromaEnhancePreset(ChromaEnhancePreset.LIGHT)}
                              </SelectItem>
                              <SelectItem value={ChromaEnhancePreset.BALANCED}>
                                {chromaEnhancePresetLabelVi(ChromaEnhancePreset.BALANCED)} -{' '}
                                {describeChromaEnhancePreset(ChromaEnhancePreset.BALANCED)}
                              </SelectItem>
                              <SelectItem value={ChromaEnhancePreset.STRONG}>
                                {chromaEnhancePresetLabelVi(ChromaEnhancePreset.STRONG)} -{' '}
                                {describeChromaEnhancePreset(ChromaEnhancePreset.STRONG)}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Pha trộn (blend)</Label>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {ui.blend.toFixed(2)}
                        </span>
                      </div>
                      <Slider
                        value={[ui.blend]}
                        min={0}
                        max={0.2}
                        step={0.01}
                        disabled={busy}
                        onValueChange={(v) => ui.setBlend(v[0] ?? ui.blend)}
                      />
                    </div>

                    <Separator className="opacity-60" />

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={!canStart}
                        onClick={async () => {
                          if (!ui.inputPath || !ui.outputPath) return
                          const jobId = crypto.randomUUID()
                          useVideoChromaEnhanceStore.getState().reset()
                          job.reset()
                          job.markQueued(jobId)
                          try {
                            await startVideoProcessing({
                              jobId,
                              inputPath: ui.inputPath,
                              outputPath: ui.outputPath,
                              mode: ui.mode,
                              preset: ui.preset,
                              keyingKind: ui.keyingKind,
                              keyColor: ui.keyColor.trim(),
                              similarity: ui.similarity,
                              blend: ui.blend,
                              autoEnhanceOutput: ui.autoEnhanceOutput,
                              chromaEnhancePreset: ui.chromaEnhancePreset,
                              exportWebp: ui.exportWebp,
                              webpOutputPath: ui.webpOutputPath ?? undefined
                            })
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Không thể bắt đầu tác vụ')
                            job.reset()
                          }
                        }}
                      >
                        {busy || ui.isProbing ? (
                          <Spinner className="size-4" aria-hidden />
                        ) : (
                          <Wand2 className="size-4" aria-hidden />
                        )}
                        Bắt đầu
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!busy || job.status === 'cancelling'}
                        onClick={async () => {
                          if (!job.jobId) return
                          job.markCancelling()
                          try {
                            await cancelVideoProcessing(job.jobId)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Không thể hủy')
                          }
                        }}
                      >
                        {job.status === 'cancelling' ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Square className="size-4" />
                        )}
                        Hủy
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          dismissVideoChromaToasts()
                          resetVideoChromaSession()
                          setCommandPreview('')
                          setPlayerMeta(null)
                          setExportPreviewUrl(null)
                        }}
                      >
                        Reset
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <Label className="shrink-0">Tiến độ</Label>
                          {busy ? (
                            <Spinner
                              className="size-3.5 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                          ) : null}
                          {busy && showProgressPercent ? (
                            <>
                              <span className="text-muted-foreground/90" aria-hidden>
                                &middot;
                              </span>
                              <span className="text-sm font-medium tabular-nums text-foreground">
                                {progressPercent}%
                              </span>
                            </>
                          ) : null}
                        </div>
                        {job.phase ? (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Giai đoạn: {jobPhaseVi(job.phase)}
                          </span>
                        ) : null}
                      </div>
                      <Progress value={progressPercent} />
                      {showEnhanceProgress ? (
                        <div className="space-y-2 border-t border-border/60 pt-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-muted-foreground">
                              Hậu xử lý (enhance)
                            </span>
                            <span className="tabular-nums text-foreground">
                              {enhanceStatus === 'failed'
                                ? 'Thất bại (giữ bản chroma)'
                                : enhanceStatus === 'completed'
                                  ? 'Hoàn tất'
                                  : `${enhanceProgressPercent}%`}
                            </span>
                          </div>
                          <Progress value={enhanceProgressPercent} />
                          {enhanceLastError ? (
                            <p className="text-xs text-amber-600 dark:text-amber-500">
                              {enhanceLastError}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>

          <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
            <div className="flex flex-col gap-5 p-4 pr-3">
              <Card
                id="chroma-focus-output"
                className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4"
              >
                <CardHeader className="space-y-1">
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    Phân tách rõ: tệp gốc (đầu vào) luôn là video chưa chroma key. Phần đầu ra chỉ
                    hiện sau khi job hoàn tất và trỏ đúng tệp đã xuất (tránh nhầm với nguồn).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ui.probeError ? (
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-foreground">
                      {ui.probeError}
                    </div>
                  ) : null}

                  {ui.probe || playerMeta ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                      <div>
                        Độ phân giải:{' '}
                        {displayWidth != null && displayHeight != null
                          ? `${displayWidth}×${displayHeight}`
                          : '-'}
                        {playerMeta &&
                        ui.probe?.width &&
                        ui.probe?.height &&
                        (playerMeta.width !== ui.probe.width ||
                          playerMeta.height !== ui.probe.height)
                          ? ' (trình phát)'
                          : ''}
                      </div>
                      <div className="tabular-nums">
                        FPS:{' '}
                        {displayFps != null && displayFps > 0 ? displayFps.toFixed(3) : 'không rõ'}
                      </div>
                      <div className="tabular-nums">
                        Thời lượng:{' '}
                        {displayDurationSec != null
                          ? `${formatMediaDurationSeconds(displayDurationSec)} (${displayDurationSec.toFixed(2)} s)`
                          : '-'}
                      </div>
                      <div>Mã hóa video: {ui.probe?.videoCodec ?? '-'}</div>
                      <div className="col-span-2">
                        Âm thanh:{' '}
                        {ui.probe
                          ? ui.probe.hasAudio
                            ? (ui.probe.audioCodec ?? 'có')
                            : 'không'
                          : '-'}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {ui.isProbing ? (
                        <>
                          <Spinner className="size-4" />
                          <span>Đang phân tích…</span>
                        </>
                      ) : (
                        <span>Chưa có dữ liệu phân tích.</span>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">
                      Đầu vào - nguồn gốc (chưa chroma key)
                    </div>
                    <div className="overflow-hidden rounded-lg border border-border/80 bg-black/40">
                      {ui.previewUrl ? (
                        <video
                          key={`in:${ui.inputPath ?? ''}:${ui.previewUrl}`}
                          className="aspect-video w-full"
                          controls
                          preload="metadata"
                          playsInline
                          src={ui.previewUrl}
                          onLoadedMetadata={(e) => {
                            const v = e.currentTarget
                            const d = v.duration
                            setPlayerMeta({
                              durationSec: Number.isFinite(d) && d > 0 ? d : 0,
                              width: v.videoWidth,
                              height: v.videoHeight
                            })
                          }}
                        />
                      ) : (
                        <div className="flex aspect-video w-full items-center justify-center text-sm text-muted-foreground">
                          Chưa có preview
                        </div>
                      )}
                    </div>
                  </div>

                  {exportVideoPath ? (
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <div className="text-xs font-medium text-muted-foreground">
                        Đầu ra - tệp đã xuất (chỉ phát từ đường dẫn output, khác preview đầu vào)
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label className="max-w-[min(100%,28rem)] truncate font-normal">
                          {fileNameFromPath(exportVideoPath)}
                        </Label>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await shellOpenPath(exportVideoPath)
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
                                await shellRevealFile(exportVideoPath)
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : 'Không thể mở thư mục')
                              }
                            }}
                          >
                            Thư mục
                          </Button>
                        </div>
                      </div>
                      {exportCompletedMode === VideoOutputMode.ALPHA_MOV ? (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          MOV ProRes có kênh alpha: trình phát nhúng (kể cả ô preview dưới) thường
                          hiển thị vùng trong suốt thành nền tối - đó là giới hạn trình phát, không
                          phải hỏng tệp. Hãy mở bằng VLC, MPC-HC hoặc DaVinci Resolve để xem alpha
                          đúng.
                        </p>
                      ) : (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          MP4 H.264 không có alpha: nền trong tệp là màu chroma thật, còn ô preview
                          bên dưới phản ánh đúng pixel đã xuất.
                        </p>
                      )}
                      {exportPreviewUrl ? (
                        <div className="overflow-hidden rounded-lg border border-border/80 bg-black/40">
                          <video
                            key={`out:${exportVideoPath}:${exportPreviewUrl}`}
                            className="aspect-video w-full"
                            controls
                            playsInline
                            preload="auto"
                            src={exportPreviewUrl}
                          />
                        </div>
                      ) : (
                        <div className="flex min-h-30 items-center justify-center rounded-lg border border-dashed border-border/80 text-xs text-muted-foreground">
                          Không tạo được URL xem trước cho tệp đầu ra.
                        </div>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>

              <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                <CardHeader className="space-y-1">
                  <CardTitle>Lệnh ffmpeg (preview)</CardTitle>
                  <CardDescription>
                    Đúng dạng tham số mà runner sử dụng (cộng thêm đường dẫn thực thi).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChromaTerminalFrame title="ffmpeg · lệnh (preview)">
                    <ScrollArea className="h-[min(22rem,42vh)] min-h-40">
                      <pre
                        className={`whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed ${
                          commandPreview ? 'text-emerald-200/95' : 'text-zinc-500'
                        }`}
                      >
                        {commandPreview || 'Chọn đầu vào, đầu ra và chờ phân tích để xem lệnh.'}
                      </pre>
                    </ScrollArea>
                  </ChromaTerminalFrame>
                </CardContent>
              </Card>

              {ui.autoEnhanceOutput ? (
                <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                  <CardHeader className="space-y-1">
                    <CardTitle>Logs · hậu xử lý (enhance)</CardTitle>
                    <CardDescription>
                      Chỉ bước denoise/sharpen sau chroma (ffmpeg filter graph riêng).
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChromaTerminalFrame title="ffmpeg · enhance">
                      <ScrollArea className="h-[min(12rem,28vh)] min-h-32">
                        <pre className="whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed text-amber-100/90">
                          {enhanceLogs.length ? enhanceLogs.join('\n') : '-'}
                        </pre>
                      </ScrollArea>
                    </ChromaTerminalFrame>
                  </CardContent>
                </Card>
              ) : null}

              <Card
                id="chroma-focus-logs"
                className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4"
              >
                <CardHeader className="space-y-1">
                  <CardTitle>Logs</CardTitle>
                  <CardDescription>Dòng stderr/stdout truyền từ ffmpeg.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChromaTerminalFrame title="ffmpeg · log (stderr/stdout)">
                    <ScrollArea className="h-[min(16rem,32vh)] min-h-40">
                      <pre className="whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed text-zinc-400">
                        {job.commands.length ? `${job.commands.join('\n\n')}\n\n` : ''}
                        {job.logs.join('\n')}
                      </pre>
                    </ScrollArea>
                  </ChromaTerminalFrame>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
