import { useSettingsStore } from '@/application/stores/settings.store'
import { useInputVideoDrop } from '@/features/input-file-drop'
import { resetVideoCompressSession } from '@/features/video-compress/application/reset-video-compress-session'
import { useVideoCompressJobStore } from '@/features/video-compress/application/stores/video-compress-job.store'
import { useVideoCompressUiStore } from '@/features/video-compress/application/stores/video-compress-ui.store'
import { suggestedCompressExtension } from '@/features/video-compress/application/video-compress-output'
import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { formatMediaDurationSeconds } from '@/features/video-chroma/presentation/lib/format-media-time'
import {
  compressCodecLabelVi,
  compressProfileLabelVi,
  compressQualityLabelVi,
  jobStatusVi
} from '@/shared/i18n/vi-labels'
import { Button } from '@/shared/presentation/components/ui/button'
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
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
import {
  fileNameFromPath,
  joinDirFile,
  queuePathKey,
  replaceFileExtension
} from '@/shared/lib/local-file-path'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/presentation/components/ui/badge'
import {
  CompressQualityPreset,
  CompressUseCaseProfile,
  CompressVideoCodec,
  defaultCompressOverrides,
  type CompressJobEvent
} from '@shared/domain/compress-job'
import type { VideoProbeResult } from '@shared/domain/video-job'
import {
  estimateBitrateDeltaPercent,
  estimateOutputBytes,
  formatBytes
} from '@shared/infrastructure/ffmpeg/compress-estimates'
import { resolveCompressEncodingPlan } from '@shared/infrastructure/ffmpeg/video-compress-plan'
import { useRouteContext } from '@tanstack/react-router'
import { FolderOpen, Gauge, Play, Square, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

type QueueRow = {
  localId: string
  path: string
  probe: VideoProbeResult | null
  probeError: string | null
  jobId: string | null
  outputPath: string
}

const PROBE_TIMEOUT_MS = 45_000

function newRow(
  path: string,
  outputFolder: string | null,
  profile: CompressUseCaseProfile,
  codec: CompressVideoCodec
): QueueRow {
  const base = fileNameFromPath(path)
  const ext = suggestedCompressExtension(profile, codec)
  const out =
    outputFolder != null ? joinDirFile(outputFolder, replaceFileExtension(base, `_opt${ext}`)) : ''
  return {
    localId: crypto.randomUUID(),
    path,
    probe: null,
    probeError: null,
    jobId: null,
    outputPath: out
  }
}

export function VideoCompressPage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { videoCompress } = useRouteContext({ from: '/tools/video-compress' })
  const config = useSettingsStore((s) => s.config)

  const ui = useVideoCompressUiStore()
  const job = useVideoCompressJobStore()

  const [rows, setRows] = useState<QueueRow[]>([])
  const [inputPreviewUrl, setInputPreviewUrl] = useState<string | null>(null)
  const [outputPreviewUrl, setOutputPreviewUrl] = useState<string | null>(null)
  const runStartedAt = useRef<number | null>(null)

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${videoCompress.title} | Bộ công cụ`
    return () => {
      document.title = prevTitle
    }
  }, [videoCompress.title])

  const busy = job.status === 'running' || job.status === 'queued' || job.status === 'cancelling'

  const firstProbe = rows.find((r) => r.probe)?.probe ?? null

  const planPreview = useMemo(() => {
    if (!firstProbe) return null
    return resolveCompressEncodingPlan({
      probe: firstProbe,
      quality: ui.quality,
      profile: ui.profile,
      overrides: { ...ui.overrides, codec: ui.codec }
    })
  }, [firstProbe, ui.quality, ui.profile, ui.overrides, ui.codec])

  const estBytes =
    planPreview && firstProbe?.durationSec != null
      ? estimateOutputBytes(planPreview, firstProbe.durationSec)
      : null

  const bitrateDelta =
    planPreview && firstProbe ? estimateBitrateDeltaPercent(firstProbe, planPreview) : null

  useEffect(() => {
    const unsub = desktop.onCompressJobEvent((ev: CompressJobEvent) => {
      useVideoCompressJobStore.getState().applyEvent(ev)
      if (ev.type === 'item_started' || ev.type === 'progress') {
        runStartedAt.current ??= Date.now()
      }
      if (ev.type === 'completed') {
        void desktop
          .toFileUrl(ev.outputPath)
          .then(setOutputPreviewUrl)
          .catch(() => setOutputPreviewUrl(null))
      }
      if (ev.type === 'failed') {
        toast.error(ev.message)
      }
    })
    return unsub
  }, [desktop])

  const primaryQueueInputPath = rows[0]?.path ?? null

  useEffect(() => {
    if (!primaryQueueInputPath) {
      setInputPreviewUrl(null)
      return
    }
    let cancelled = false
    void desktop
      .toFileUrl(primaryQueueInputPath)
      .then((u) => {
        if (!cancelled) setInputPreviewUrl(u)
      })
      .catch(() => {
        if (!cancelled) setInputPreviewUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [desktop, primaryQueueInputPath])

  const rebuildOutputs = useCallback(
    (folder: string | null, profile: CompressUseCaseProfile, codec: CompressVideoCodec) => {
      setRows((rs) =>
        rs.map((r) => {
          if (!folder) return { ...r, outputPath: '' }
          const base = fileNameFromPath(r.path)
          const ext = suggestedCompressExtension(profile, codec)
          return {
            ...r,
            outputPath: joinDirFile(folder, replaceFileExtension(base, `_opt${ext}`))
          }
        })
      )
    },
    []
  )

  useEffect(() => {
    rebuildOutputs(ui.outputFolder, ui.profile, ui.codec)
  }, [ui.outputFolder, ui.profile, ui.codec, rebuildOutputs])

  const probeRow = useCallback(
    async (path: string, localId: string) => {
      let timeoutId: number | undefined
      try {
        const probe = await Promise.race([
          desktop.probeCompressVideo(path),
          new Promise<never>((_, reject) => {
            timeoutId = window.setTimeout(() => {
              reject(
                new Error(
                  'Phân tích quá lâu - tệp có thể đang bị khóa, ổ chậm, hoặc đường dẫn không hợp lệ.'
                )
              )
            }, PROBE_TIMEOUT_MS)
          })
        ])
        if (timeoutId !== undefined) window.clearTimeout(timeoutId)
        setRows((rs) =>
          rs.map((r) => (r.localId === localId ? { ...r, probe, probeError: null } : r))
        )
      } catch (e) {
        if (timeoutId !== undefined) window.clearTimeout(timeoutId)
        const msg = e instanceof Error ? e.message : 'Probe failed'
        setRows((rs) =>
          rs.map((r) => (r.localId === localId ? { ...r, probe: null, probeError: msg } : r))
        )
      }
    },
    [desktop]
  )

  const enqueueVideoPaths = useCallback(
    (picked: string[]) => {
      if (picked.length === 0) return
      setRows((rs) => {
        const { outputFolder, profile, codec } = useVideoCompressUiStore.getState()
        const next = [...rs]
        const newRows: QueueRow[] = []
        for (const p of picked) {
          const pKey = queuePathKey(p)
          if (next.some((r) => queuePathKey(r.path) === pKey)) continue
          const row = newRow(p, outputFolder, profile, codec)
          newRows.push(row)
          next.push(row)
        }
        if (newRows.length > 0) {
          queueMicrotask(() => {
            for (const row of newRows) {
              void probeRow(row.path, row.localId)
            }
          })
        }
        return next
      })
    },
    [probeRow]
  )

  const addFiles = async (): Promise<void> => {
    const picked = await desktop.pickVideoFiles()
    enqueueVideoPaths(picked)
  }

  const pickFolder = async (): Promise<void> => {
    const dir = await desktop.pickOutputFolder()
    ui.setOutputFolder(dir)
  }

  const inputDrop = useInputVideoDrop({
    disabled: busy,
    multiple: true,
    onPathsAccepted: enqueueVideoPaths
  })

  const removeRow = (localId: string): void => {
    setRows((rs) => rs.filter((r) => r.localId !== localId))
  }

  const startBatch = async (): Promise<void> => {
    if (!ui.outputFolder?.trim()) {
      toast.error('Chọn thư mục đầu ra trước.')
      return
    }
    const ready = rows.filter((r) => r.probe && r.outputPath)
    if (ready.length === 0) {
      toast.error('Thêm video và đợi phân tích (probe) xong.')
      return
    }
    job.reset()
    runStartedAt.current = null
    const items = ready.map((r) => ({
      jobId: crypto.randomUUID(),
      inputPath: r.path,
      outputPath: r.outputPath,
      quality: ui.quality,
      profile: ui.profile,
      overrides: { ...defaultCompressOverrides(), ...ui.overrides, codec: ui.codec }
    }))
    setRows((rs) =>
      rs.map((r) => {
        const idx = ready.findIndex((x) => x.localId === r.localId)
        if (idx >= 0) return { ...r, jobId: items[idx]!.jobId }
        return r
      })
    )
    await desktop.startCompressBatch({ items })
    toast.message(`Đã xếp hàng ${items.length} tệp.`)
  }

  const cancelRun = (): void => {
    const id = job.jobId
    if (id) void desktop.cancelCompressJob(id)
    job.markCancelling()
  }

  const etaLabel = useMemo(() => {
    if (
      job.status !== 'running' ||
      job.progress <= 0.02 ||
      !runStartedAt.current ||
      !firstProbe?.durationSec
    ) {
      return null
    }
    const elapsed = (Date.now() - runStartedAt.current) / 1000
    const totalEst = elapsed / job.progress
    const left = Math.max(0, totalEst - elapsed)
    return `~${formatMediaDurationSeconds(left)} còn lại (ước lượng)`
  }, [job.status, job.progress, firstProbe?.durationSec])

  const savedBytes =
    job.lastOutput && job.lastOutput.outputBytes < job.lastOutput.inputBytes
      ? job.lastOutput.inputBytes - job.lastOutput.outputBytes
      : null
  const savedPct =
    job.lastOutput && job.lastOutput.inputBytes > 0
      ? Math.round((1 - job.lastOutput.outputBytes / job.lastOutput.inputBytes) * 100)
      : null

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Gauge className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {videoCompress.title}
              </h1>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Giảm dung lượng video bằng ffmpeg - preset theo bối cảnh, tùy chỉnh
              CRF/bitrate/scale/FPS/codec. Engine tách ở tiến trình chính. Lệnh được dựng từ{' '}
              <code className="text-foreground/80">video-compress-plan</code> +{' '}
              <code className="text-foreground/80">video-compress-command-builder</code>. GPU
              (NVENC/…) để dành mở rộng sau.
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
            <div className="space-y-5 p-5">
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
                    'aria-label': 'Thả tệp video vào hàng đợi'
                  })}
                />
                {inputDrop.surface === 'dragging' ? (
                  <div
                    className="pointer-events-none absolute inset-0 z-1 rounded-[inherit] bg-background/20 ring-1 ring-inset ring-primary/20"
                    aria-hidden
                  />
                ) : null}
                <CardHeader className="relative z-2 space-y-1 pb-4">
                  <CardTitle>Hàng đợi</CardTitle>
                  <CardDescription>
                    Thêm video bằng nút hoặc kéo thả vào khung này. Tệp đầu ra mặc định giữ tên gốc,
                    chèn _opt trước đuôi mở rộng (ví dụ: clip.mp4 -&gt; clip_opt.mp4).
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void addFiles()}
                    >
                      Thêm
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void pickFolder()}
                    >
                      <FolderOpen className="mr-2 size-4" aria-hidden />
                      Đầu ra
                    </Button>
                    <Button type="button" disabled={busy} onClick={() => void startBatch()}>
                      {busy ? <Spinner className="size-4" /> : <Play className="mr-2 size-4" />}
                      Bắt đầu
                    </Button>
                    <Button type="button" variant="ghost" disabled={!busy} onClick={cancelRun}>
                      <Square className="mr-2 size-4" />
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        resetVideoCompressSession()
                        setRows([])
                        setInputPreviewUrl(null)
                        setOutputPreviewUrl(null)
                        runStartedAt.current = null
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
                  <ScrollArea className="h-48 rounded-md border border-border/80">
                    <ul className="divide-y divide-border/60 p-2 text-sm">
                      {rows.length === 0 ? (
                        <li className="absolute inset-0 flex items-center justify-center text-center text-muted-foreground">
                          Chưa có tệp.
                        </li>
                      ) : (
                        rows.map((r) => (
                          <li key={r.localId} className="flex items-start gap-2 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{fileNameFromPath(r.path)}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {r.outputPath || '-'}
                              </div>
                              {r.probeError ? (
                                <div className="text-xs text-destructive">{r.probeError}</div>
                              ) : r.probe ? (
                                <div className="text-xs text-muted-foreground">
                                  {r.probe.width}×{r.probe.height}
                                  {r.probe.durationSec != null
                                    ? ` · ${formatMediaDurationSeconds(r.probe.durationSec)}`
                                    : ''}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">Đang phân tích…</div>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="size-8 shrink-0 p-0"
                              disabled={busy}
                              onClick={() => removeRow(r.localId)}
                              aria-label="Xóa khỏi hàng đợi"
                            >
                              <Trash2 className="size-4" />
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
                  <CardTitle>Tham số</CardTitle>
                  <CardDescription>
                    Preset chất lượng và profile bối cảnh. Phần dưới có ghi đè nâng cao khi cần tinh
                    chỉnh.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Chất lượng</Label>
                    <Select
                      value={ui.quality}
                      onValueChange={(v) => ui.setQuality(v as CompressQualityPreset)}
                      disabled={busy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            CompressQualityPreset.MAX_QUALITY,
                            CompressQualityPreset.BALANCED,
                            CompressQualityPreset.SMALL_SIZE,
                            CompressQualityPreset.ULTRA_COMPRESSED
                          ] as const
                        ).map((q) => (
                          <SelectItem key={q} value={q}>
                            {compressQualityLabelVi(q)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Profile</Label>
                    <Select
                      value={ui.profile}
                      onValueChange={(v) => ui.setProfile(v as CompressUseCaseProfile)}
                      disabled={busy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            CompressUseCaseProfile.GENERIC,
                            CompressUseCaseProfile.WEB_UPLOAD,
                            CompressUseCaseProfile.DISCORD,
                            CompressUseCaseProfile.SOCIAL,
                            CompressUseCaseProfile.TRANSPARENT_MOV,
                            CompressUseCaseProfile.TRANSPARENT_WEBM,
                            CompressUseCaseProfile.ANIMATED_WEBP,
                            CompressUseCaseProfile.GREEN_SCREEN,
                            CompressUseCaseProfile.ARCHIVE,
                            CompressUseCaseProfile.STORAGE
                          ] as const
                        ).map((p) => (
                          <SelectItem key={p} value={p}>
                            {compressProfileLabelVi(p)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Codec video</Label>
                    <Select
                      value={ui.codec}
                      onValueChange={(v) => ui.setCodec(v as CompressVideoCodec)}
                      disabled={busy || ui.profile === CompressUseCaseProfile.ANIMATED_WEBP}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          [
                            CompressVideoCodec.H264,
                            CompressVideoCodec.H265,
                            CompressVideoCodec.VP9,
                            CompressVideoCodec.AV1
                          ] as const
                        ).map((c) => (
                          <SelectItem key={c} value={c}>
                            {compressCodecLabelVi(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Separator className="sm:col-span-2" />
                  <div className="space-y-2">
                    <Label>Chế độ tốc độ</Label>
                    <Select
                      value={ui.overrides.rateMode ?? 'crf'}
                      onValueChange={(v) => ui.setRateMode(v === 'bitrate' ? 'bitrate' : null)}
                      disabled={busy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crf">CRF (chất lượng ưu tiên)</SelectItem>
                        <SelectItem value="bitrate">Bitrate cố định</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>CRF (tuỳ chọn, để trống = auto)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="vd. 23"
                      value={ui.overrides.crf ?? ''}
                      onChange={(e) => {
                        const t = e.target.value.trim()
                        ui.setCrf(t === '' ? null : Number(t))
                      }}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitrate video kênh (kbps)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="vd. 4500"
                      value={ui.overrides.targetVideoBitrateKbps ?? ''}
                      onChange={(e) => {
                        const t = e.target.value.trim()
                        ui.setTargetVideoBitrateKbps(t === '' ? null : Number(t))
                      }}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Scale (0.25–1)</Label>
                    <Input
                      inputMode="decimal"
                      placeholder="1"
                      value={ui.overrides.scale ?? ''}
                      onChange={(e) => {
                        const t = e.target.value.trim()
                        ui.setScale(t === '' ? null : Number(t))
                      }}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>FPS đích (để trống = giữ nguồn)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="30"
                      value={ui.overrides.fps ?? ''}
                      onChange={(e) => {
                        const t = e.target.value.trim()
                        ui.setFps(t === '' ? null : Number(t))
                      }}
                      disabled={busy}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Bitrate âm thanh (kbps)</Label>
                    <Input
                      inputMode="numeric"
                      placeholder="128"
                      value={ui.overrides.audioBitrateKbps ?? ''}
                      onChange={(e) => {
                        const t = e.target.value.trim()
                        ui.setAudioBitrateKbps(t === '' ? null : Number(t))
                      }}
                      disabled={busy}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
            <div className="flex flex-col gap-5 p-4 pr-3">
              <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                <CardHeader className="space-y-1">
                  <CardTitle>Ước lượng &amp; cảnh báo</CardTitle>
                  <CardDescription>
                    Dựa trên tệp đầu tiên trong hàng đợi (sau probe).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {!planPreview ? (
                    <p className="text-muted-foreground">
                      Thêm và phân tích ít nhất một video để xem ước lượng.
                    </p>
                  ) : (
                    <>
                      <div>
                        <span className="text-muted-foreground">Dự kiến dung lượng: </span>
                        <span className="font-medium tabular-nums">
                          {estBytes != null
                            ? formatBytes(estBytes)
                            : '- (WebP động / thiếu duration)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Ảnh hưởng chất lượng (heuristic):{' '}
                        </span>
                        <span>{planPreview.qualityImpactLabel}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Bitrate video ước lượng: </span>
                        <span className="tabular-nums">
                          {planPreview.estimatedVideoBitrateKbps} kbps
                        </span>
                        {bitrateDelta != null ? (
                          <span className="text-muted-foreground">
                            {' '}
                            (so với nguồn ~{bitrateDelta > 0 ? '-' : '+'}
                            {Math.abs(bitrateDelta)}%)
                          </span>
                        ) : null}
                      </div>
                      {planPreview.warnings.length > 0 ? (
                        <ul className="list-inside list-disc space-y-1 text-amber-700 dark:text-amber-400">
                          {planPreview.warnings.map((w) => (
                            <li key={w}>{w}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                <CardHeader className="space-y-1">
                  <CardTitle>So sánh trước / sau</CardTitle>
                  <CardDescription>
                    Trước: video đầu tiên trong hàng đợi. Sau: bản xuất khi job xong (local-media).
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Trước</div>
                    {inputPreviewUrl ? (
                      <video
                        key={inputPreviewUrl}
                        className="aspect-video w-full rounded-md border border-border/80 bg-black"
                        src={inputPreviewUrl}
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                        Chưa có nguồn
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-medium text-muted-foreground">Sau</div>
                    {outputPreviewUrl ? (
                      <video
                        key={outputPreviewUrl}
                        className="aspect-video w-full rounded-md border border-border/80 bg-black"
                        src={outputPreviewUrl}
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="flex aspect-video items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                        Chưa có bản ra
                      </div>
                    )}
                  </div>
                </CardContent>
                {job.lastOutput ? (
                  <CardContent className="border-t border-border/60 pt-0 text-sm">
                    <p>
                      Lần xong gần nhất: tiết kiệm{' '}
                      <span className="font-medium tabular-nums">
                        {savedBytes != null ? formatBytes(savedBytes) : '-'}
                      </span>
                      {savedPct != null ? (
                        <span className="text-muted-foreground"> ({savedPct}% nhỏ hơn)</span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => void shellOpenPath(job.lastOutput!.outputPath)}
                      >
                        Mở tệp ra
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void shellRevealFile(job.lastOutput!.outputPath)}
                      >
                        Hiện trong thư mục
                      </Button>
                    </div>
                  </CardContent>
                ) : null}
              </Card>

              <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                <CardHeader className="space-y-1">
                  <CardTitle>Logs</CardTitle>
                  <CardDescription>Dòng stderr/stdout truyền từ ffmpeg.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChromaTerminalFrame
                    title={`ffmpeg · ${config?.ffmpegPath?.trim() ? 'custom' : 'PATH'}`}
                  >
                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                      {job.status === 'running' ? (
                        <>
                          <Progress value={job.progress * 100} className="h-1.5 w-40" />
                          <span className="tabular-nums">{Math.round(job.progress * 100)}%</span>
                          {etaLabel ? <span>{etaLabel}</span> : null}
                        </>
                      ) : null}
                    </div>
                    <ScrollArea className="h-[min(16rem,32vh)] min-h-40">
                      <pre className="whitespace-pre-wrap break-all p-2 font-mono text-[11px] leading-relaxed text-zinc-400">
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
