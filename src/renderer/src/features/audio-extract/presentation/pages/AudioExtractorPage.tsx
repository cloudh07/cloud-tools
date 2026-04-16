import { useSettingsStore } from '@/application/stores/settings.store'
import { useInputVideoDrop } from '@/features/input-file-drop'
import {
  extensionForFormat,
  fileNameFromPath,
  joinDirFile,
  stemFromPath
} from '@/features/audio-extract/application/audio-extract-paths'
import { resetAudioExtractSession } from '@/features/audio-extract/application/reset-audio-extract-session'
import {
  cancelAudioExtractJob,
  startAudioExtractBatch
} from '@/features/audio-extract/application/start-audio-extract.use-case'
import { useAudioExtractJobStore } from '@/features/audio-extract/application/stores/audio-extract-job.store'
import { useAudioExtractUiStore } from '@/features/audio-extract/application/stores/audio-extract-ui.store'
import { AudioExtractControls } from '@/features/audio-extract/presentation/components/audio-extract-controls'
import { AudioTrackTable } from '@/features/audio-extract/presentation/components/audio-track-table'
import { ChromaTerminalFrame } from '@/features/video-chroma/presentation/components/chroma-terminal-frame'
import { formatMediaDurationSeconds } from '@/features/video-chroma/presentation/lib/format-media-time'
import { audioExtractPhaseVi, jobStatusVi } from '@/shared/i18n/vi-labels'
import { shellRevealFile } from '@/shared/lib/desktop-bridge'
import { cn } from '@/shared/lib/utils'
import { Badge } from '@/shared/presentation/components/ui/badge'
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
import type {
  AudioExtractJobEvent,
  AudioExtractProbeResult
} from '@shared/domain/audio-extract-job'
import { buildAudioExtractFfmpegArgs } from '@shared/infrastructure/ffmpeg/build-audio-extract-args'
import { useRouteContext } from '@tanstack/react-router'
import { FolderOpen, Headphones, Square, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

type ProbeSlice = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: AudioExtractProbeResult | null
  message: string | null
}

const idleProbe = (): ProbeSlice => ({ status: 'idle', data: null, message: null })

export function AudioExtractorPage(): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const { audioExtract } = useRouteContext({ from: '/tools/audio-extract' })
  const config = useSettingsStore((s) => s.config)

  const ui = useAudioExtractUiStore()
  const job = useAudioExtractJobStore()

  const [probeSlice, setProbeSlice] = useState<ProbeSlice>(idleProbe)

  useEffect(() => {
    const prevTitle = document.title
    document.title = `${audioExtract.title} | Bộ công cụ`
    return () => {
      document.title = prevTitle
    }
  }, [audioExtract.title])

  useEffect(() => {
    const p = ui.inputPath
    if (!p) {
      queueMicrotask(() => setProbeSlice(idleProbe()))
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) {
        setProbeSlice({ status: 'loading', data: null, message: null })
      }
    })
    void desktop
      .probeAudioExtract(p)
      .then((r) => {
        if (cancelled) return
        const empty = r.tracks.length === 0
        if (!empty) {
          useAudioExtractUiStore.getState().setSelectedAudioOrdinal(0)
        }
        setProbeSlice({
          status: empty ? 'error' : 'ready',
          data: r,
          message: empty ? 'Không có luồng âm thanh trong tệp.' : null
        })
      })
      .catch((e) => {
        if (cancelled) return
        setProbeSlice({
          status: 'error',
          data: null,
          message: e instanceof Error ? e.message : 'Probe thất bại'
        })
      })
    return () => {
      cancelled = true
    }
  }, [desktop, ui.inputPath])

  const probe = probeSlice.data

  useEffect(() => {
    if (!probe?.tracks.length) return
    const max = probe.tracks.length - 1
    const ord = useAudioExtractUiStore.getState().selectedAudioOrdinal
    if (ord > max || ord < 0) {
      useAudioExtractUiStore.getState().setSelectedAudioOrdinal(0)
    }
  }, [probe])

  useEffect(() => {
    const unsub = desktop.onAudioExtractJobEvent((ev: AudioExtractJobEvent) => {
      useAudioExtractJobStore.getState().applyEvent(ev)
      if (ev.type === 'failed') {
        toast.error(ev.message)
      }
    })
    return unsub
  }, [desktop])

  const busy = job.status === 'running' || job.status === 'queued' || job.status === 'cancelling'
  const showProgressPercent = job.status === 'running' || job.status === 'cancelling'

  const canStart = useMemo(() => {
    if (busy) return false
    if (probeSlice.status === 'loading') return false
    if (!ui.inputPath?.trim()) return false
    if (!ui.outputFolder?.trim()) return false
    if (probeSlice.status !== 'ready' || !probe?.tracks.length) return false
    if (!ui.extractAll) {
      const t = probe.tracks.find((x) => x.audioOrdinal === ui.selectedAudioOrdinal)
      if (!t) return false
    }
    return true
  }, [
    busy,
    probe,
    probeSlice.status,
    ui.extractAll,
    ui.inputPath,
    ui.outputFolder,
    ui.selectedAudioOrdinal
  ])

  const applyDroppedInputPaths = useCallback((paths: string[]) => {
    const first = paths[0]
    if (first) useAudioExtractUiStore.getState().setInputPath(first)
  }, [])

  const inputDrop = useInputVideoDrop({
    disabled: busy,
    multiple: false,
    onPathsAccepted: applyDroppedInputPaths
  })

  const ffmpegLabel = config?.ffmpegPath?.trim().length ? config.ffmpegPath.trim() : 'ffmpeg'

  const commandPreview = useMemo(() => {
    if (!ui.inputPath || !ui.outputFolder || !probe?.tracks.length) return ''
    const track = probe.tracks.find((t) => t.audioOrdinal === ui.selectedAudioOrdinal)
    if (!track) return ''
    const stem = stemFromPath(ui.inputPath)
    const ext = extensionForFormat(ui.format)
    const out = joinDirFile(ui.outputFolder, `${stem}_track${track.audioOrdinal}${ext}`)
    const built = buildAudioExtractFfmpegArgs({
      inputPath: ui.inputPath,
      outputPath: out,
      audioOrdinal: track.audioOrdinal,
      sourceCodec: track.codec,
      format: ui.format,
      preferCopy: ui.preferCopy
    })
    const mode = built.usedCopy ? 'stream copy' : 'encode'
    return [
      `# ${mode} · map 0:a:${track.audioOrdinal} · ${ui.format}`,
      [ffmpegLabel, ...built.args].join(' ')
    ].join('\n')
  }, [
    ffmpegLabel,
    probe,
    ui.format,
    ui.inputPath,
    ui.outputFolder,
    ui.preferCopy,
    ui.selectedAudioOrdinal
  ])

  const progressPercent = Math.min(100, Math.max(0, Math.round(job.progress * 100)))

  const pickVideo = async (): Promise<void> => {
    const files = await desktop.pickVideoFiles()
    if (files.length === 0) return
    ui.setInputPath(files[0]!)
    if (files.length > 1) {
      toast.message('Đã chọn nhiều tệp - chỉ dùng tệp đầu tiên cho tác vụ này.')
    }
  }

  const pickFolder = async (): Promise<void> => {
    const dir = await desktop.pickOutputFolder()
    ui.setOutputFolder(dir)
  }

  const startExtract = async (): Promise<void> => {
    if (!ui.inputPath?.trim()) {
      toast.error('Chọn video nguồn.')
      return
    }
    const outDir = ui.outputFolder?.trim()
    if (!outDir) {
      toast.error('Chọn thư mục đầu ra.')
      return
    }
    if (!probe?.tracks.length) {
      toast.error('Không có luồng âm thanh hợp lệ.')
      return
    }
    if (!ui.extractAll) {
      const t = probe.tracks.find((x) => x.audioOrdinal === ui.selectedAudioOrdinal)
      if (!t) {
        toast.error('Luồng âm thanh đã chọn không tồn tại.')
        return
      }
    }

    job.reset()
    const inputPath = ui.inputPath
    const outputFolder = outDir
    const stem = stemFromPath(inputPath)
    const ext = extensionForFormat(ui.format)
    const items = ui.extractAll
      ? probe.tracks.map((t) => ({
          jobId: crypto.randomUUID(),
          inputPath,
          outputPath: joinDirFile(outputFolder, `${stem}_track${t.audioOrdinal}${ext}`),
          audioOrdinal: t.audioOrdinal,
          format: ui.format,
          preferCopy: ui.preferCopy
        }))
      : [
          {
            jobId: crypto.randomUUID(),
            inputPath,
            outputPath: joinDirFile(outputFolder, `${stem}_track${ui.selectedAudioOrdinal}${ext}`),
            audioOrdinal: ui.selectedAudioOrdinal,
            format: ui.format,
            preferCopy: ui.preferCopy
          }
        ]

    await startAudioExtractBatch({ items })
    toast.message(`Đã xếp hàng ${items.length} tác vụ.`)
  }

  const cancelRun = (): void => {
    const id = job.jobId
    if (id) void cancelAudioExtractJob(id)
    job.markCancelling()
  }

  const durationHint =
    probe?.tracks.find((t) => t.audioOrdinal === ui.selectedAudioOrdinal)?.durationSec ??
    probe?.formatDurationSec ??
    null

  return (
    <div className="h-full overflow-hidden">
      <div className="flex h-full min-h-0 flex-col gap-6 p-6">
        <header className="flex flex-col gap-3 border-b border-border/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <Headphones className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">
                {audioExtract.title}
              </h1>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Tách âm thanh bằng ffmpeg với <code className="text-foreground/80">-map 0:a:N</code>{' '}
              được cố định. Luôn phân tích trước bằng ffprobe. Chỉ dùng stream copy khi codec tương
              thích với container và đã bật tùy chọn copy. Định dạng .ogg dùng container Ogg và cần
              encode lại sang Vorbis. Chỉ có thể copy nếu nguồn đã là Vorbis hoặc Opus trong Ogg.
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
                    'aria-label': 'Thả tệp video nguồn vào đây'
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
                    Chọn một video hoặc kéo thả vào khung này. ffprobe liệt kê luồng audio theo thứ
                    tự 0:a:0, 0:a:1, …
                  </CardDescription>
                </CardHeader>
                <CardContent className="relative z-2 min-w-0 space-y-4">
                  <div className="space-y-2">
                    <Label>Video nguồn</Label>
                    <div className="flex min-w-0 gap-2">
                      <div className="min-w-0 flex-1">
                        <Input
                          value={ui.inputPath ?? ''}
                          readOnly
                          placeholder="Chưa chọn tệp"
                          title={ui.inputPath ?? undefined}
                          className="truncate font-mono text-xs"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 gap-2"
                        disabled={busy}
                        onClick={() => void pickVideo()}
                      >
                        <FolderOpen className="size-4" aria-hidden />
                        Chọn
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Thư mục đầu ra</Label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void pickFolder()}
                      >
                        <FolderOpen className="mr-2 size-4" aria-hidden />
                        Thư mục
                      </Button>
                    </div>
                    {ui.outputFolder ? (
                      <p className="break-all text-xs text-muted-foreground">{ui.outputFolder}</p>
                    ) : (
                      <p className="text-xs text-amber-600/90">Chưa chọn thư mục.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="min-w-0 overflow-hidden border-border/80 bg-transparent shadow-none">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle>Luồng âm thanh</CardTitle>
                  <CardDescription>
                    Mỗi hàng là một luồng{' '}
                    <span className="font-mono text-xs">codec_type=audio</span> từ ffprobe.
                  </CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 space-y-3">
                  {probeSlice.message ? (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                      {probeSlice.message}
                    </div>
                  ) : null}
                  {probeSlice.status === 'loading' ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Spinner className="size-4" />
                      Đang phân tích…
                    </div>
                  ) : (
                    <AudioTrackTable
                      tracks={probe?.tracks ?? []}
                      extractAll={ui.extractAll}
                      selectedOrdinal={ui.selectedAudioOrdinal}
                      onSelectOrdinal={ui.setSelectedAudioOrdinal}
                      disabled={busy}
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="min-w-0 overflow-hidden border-border/80 bg-transparent shadow-none">
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle>Tùy chọn xuất</CardTitle>
                  <CardDescription>Định dạng file và chế độ copy hoặc encode.</CardDescription>
                </CardHeader>
                <CardContent className="min-w-0 space-y-4">
                  <AudioExtractControls
                    format={ui.format}
                    onFormat={ui.setFormat}
                    preferCopy={ui.preferCopy}
                    onPreferCopy={ui.setPreferCopy}
                    extractAll={ui.extractAll}
                    onExtractAll={ui.setExtractAll}
                    disabled={busy}
                  />
                  <Separator className="opacity-60" />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" disabled={!canStart} onClick={() => void startExtract()}>
                      {busy ? (
                        <Spinner className="size-4" aria-hidden />
                      ) : (
                        <Wand2 className="size-4" aria-hidden />
                      )}
                      Bắt đầu
                    </Button>
                    <Button type="button" variant="outline" disabled={!busy} onClick={cancelRun}>
                      <Square className="mr-2 size-4" />
                      Hủy
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        resetAudioExtractSession()
                        setProbeSlice(idleProbe())
                      }}
                    >
                      Reset
                    </Button>
                    {job.lastOutput ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void shellRevealFile(job.lastOutput!.outputPath)}
                      >
                        Mở thư mục bản ra
                      </Button>
                    ) : null}
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
                      {busy && job.phase ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          Giai đoạn: {audioExtractPhaseVi(job.phase)}
                        </span>
                      ) : durationHint != null && durationHint > 0 ? (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          Thời lượng tham chiếu ~{formatMediaDurationSeconds(durationHint)}
                        </span>
                      ) : null}
                    </div>
                    <Progress value={progressPercent} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>

          <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/20 ring-1 ring-white/4">
            <div className="flex min-w-0 flex-col gap-5 p-4 pr-3">
              <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                <CardHeader className="space-y-1">
                  <CardTitle>Lệnh ffmpeg (preview)</CardTitle>
                  <CardDescription>
                    Tham số thực tế gửi tới runner (cộng đường dẫn ffmpeg). Map luôn là 0:a:N.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChromaTerminalFrame title="ffmpeg · lệnh (preview)">
                    <ScrollArea className="h-[min(18rem,36vh)] min-h-36">
                      <pre
                        className={`whitespace-pre-wrap wrap-break-word p-3 font-mono text-xs leading-relaxed ${
                          commandPreview ? 'text-emerald-200/95' : 'text-zinc-500'
                        }`}
                      >
                        {commandPreview ||
                          'Chọn video, thư mục ra và chờ phân tích để xem lệnh mẫu (một luồng đang chọn).'}
                      </pre>
                    </ScrollArea>
                  </ChromaTerminalFrame>
                </CardContent>
              </Card>

              {job.lastOutput ? (
                <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                  <CardHeader className="space-y-1">
                    <CardTitle>Lần xuất gần nhất</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p className="break-all text-muted-foreground">
                      {fileNameFromPath(job.lastOutput.outputPath)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chế độ: {job.lastOutput.usedCopy ? 'stream copy' : 'encode lại'}
                    </p>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="shrink-0 border-border/90 shadow-none ring-1 ring-white/4">
                <CardHeader className="space-y-1">
                  <CardTitle>Logs</CardTitle>
                  <CardDescription>Dòng stderr/stdout từ ffmpeg.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChromaTerminalFrame
                    title={`ffmpeg · ${config?.ffmpegPath?.trim() ? 'custom' : 'PATH'}`}
                  >
                    <ScrollArea className="h-[min(16rem,32vh)] min-h-40">
                      <pre className="whitespace-pre-wrap break-all p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
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
