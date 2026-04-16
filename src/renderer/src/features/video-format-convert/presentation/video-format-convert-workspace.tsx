import { useSettingsStore } from '@/application/stores/settings.store'
import { useInputVideoDrop } from '@/features/input-file-drop'
import { validateDroppedVideoFilePaths } from '@/features/input-file-drop/domain/dropped-video-paths'
import { resetVideoFormatConvertSession } from '@/features/video-format-convert/application/reset-video-format-convert-session'
import {
  cancelVideoFormatConvertJob,
  startVideoFormatConvertJob
} from '@/features/video-format-convert/application/start-video-format-convert.use-case'
import { useVideoFormatConvertJobStore } from '@/features/video-format-convert/application/stores/video-format-convert-job.store'
import {
  useVideoFormatConvertUiStore,
  VIDEO_FORMAT_SELECT_ITEMS,
  videoFormatTargetLabel
} from '@/features/video-format-convert/application/stores/video-format-convert-ui.store'
import { suggestedVideoFormatConvertSavePath } from '@/features/video-format-convert/application/video-format-output-path'
import { VideoFormatConvertPreviewColumn } from '@/features/video-format-convert/presentation/video-format-convert-preview-column'
import type { DesktopBridge } from '@shared/domain/desktop-bridge'
import type { VideoFormatTarget } from '@shared/domain/video-format-convert'
import {
  alphaIncompatibleReason,
  previewFfmpegCommandLine,
  resolveVideoFormatConversion,
  targetKeepsAlphaWell
} from '@shared/infrastructure/ffmpeg/video-format-convert-plan'
import { shellOpenPath, shellRevealFile } from '@/shared/lib/desktop-bridge'
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
import { Progress } from '@/shared/presentation/components/ui/progress'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import { ScrollArea } from '@/shared/presentation/components/ui/scroll-area'
import { Separator } from '@/shared/presentation/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/presentation/components/ui/select'
import { FileVideo, FolderOpen, Square, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, type ReactElement } from 'react'
import { toast } from 'sonner'

type Props = {
  desktop: DesktopBridge
}

export function VideoFormatConvertWorkspace({ desktop }: Props): ReactElement {
  const ffmpegPath = useSettingsStore((s) => s.config?.ffmpegPath ?? 'ffmpeg')

  const ui = useVideoFormatConvertUiStore()
  const job = useVideoFormatConvertJobStore()

  const inputPath = ui.inputPath
  const probe = ui.probe
  const outputFormat = ui.outputFormat
  const outputPath = ui.outputPath
  const flowStatus = ui.flowStatus

  const busy = flowStatus === 'processing' || flowStatus === 'probing'

  const virtualOutput = useMemo(() => {
    if (!inputPath) return null
    return suggestedVideoFormatConvertSavePath(inputPath, outputFormat)
  }, [inputPath, outputFormat])

  const alphaHint = useMemo(() => {
    if (!probe) return null
    return alphaIncompatibleReason(probe, outputFormat)
  }, [probe, outputFormat])

  useEffect(() => {
    if (!inputPath) {
      useVideoFormatConvertUiStore.getState().setFlowStatus('idle')
      return
    }
    let cancelled = false
    useVideoFormatConvertUiStore.getState().setFlowStatus('probing')
    useVideoFormatConvertUiStore.getState().setProbeError(null)
    void (async () => {
      try {
        const p = await desktop.probeVideoFormatConvert(inputPath)
        if (cancelled) return
        useVideoFormatConvertUiStore.getState().setProbe(p)
        useVideoFormatConvertUiStore.getState().setFlowStatus('ready')
      } catch (e) {
        if (cancelled) return
        useVideoFormatConvertUiStore
          .getState()
          .setProbeError(e instanceof Error ? e.message : 'Không probe được tệp.')
        useVideoFormatConvertUiStore.getState().setFlowStatus('failed')
        toast.error(e instanceof Error ? e.message : 'Probe lỗi')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inputPath, desktop])

  useEffect(() => {
    if (!probe || !inputPath || !virtualOutput) {
      useVideoFormatConvertUiStore.getState().setPlanPreview(null, null)
      return
    }
    const plan = resolveVideoFormatConversion({
      probe,
      target: outputFormat,
      inputPath,
      outputPath: virtualOutput
    })
    if (!plan.ok) {
      useVideoFormatConvertUiStore.getState().setPlanPreview(null, plan.reason)
      return
    }
    const line = previewFfmpegCommandLine(ffmpegPath, plan.args)
    useVideoFormatConvertUiStore.getState().setPlanPreview(line, null)
  }, [probe, inputPath, outputFormat, virtualOutput, ffmpegPath])

  useEffect(() => {
    const unsub = desktop.onVideoFormatConvertJobEvent((ev) => {
      useVideoFormatConvertJobStore.getState().applyEvent(ev)
      if (ev.type === 'completed') {
        useVideoFormatConvertUiStore.getState().setFlowStatus('completed')
        toast.success('Đã chuyển đổi xong.')
      }
      if (ev.type === 'failed') {
        useVideoFormatConvertUiStore.getState().setFlowStatus('failed')
        toast.error(ev.message)
      }
      if (ev.type === 'cancelled') {
        useVideoFormatConvertUiStore.getState().setFlowStatus('cancelled')
        toast.message('Đã hủy chuyển đổi.')
      }
    })
    return unsub
  }, [desktop])

  useEffect(() => {
    return () => {
      const { jobId, flowStatus: st } = {
        jobId: useVideoFormatConvertJobStore.getState().jobId,
        flowStatus: useVideoFormatConvertUiStore.getState().flowStatus
      }
      if (jobId && st === 'processing') {
        void cancelVideoFormatConvertJob(jobId)
      }
    }
  }, [])

  const onPaths = useCallback((paths: string[]) => {
    const v = validateDroppedVideoFilePaths(paths.slice(0, 1))
    if (!v.ok) {
      toast.error(v.message)
      return
    }
    resetVideoFormatConvertSession()
    useVideoFormatConvertUiStore.getState().setInputPath(v.paths[0] ?? null)
  }, [])

  const drop = useInputVideoDrop({
    disabled: busy,
    multiple: false,
    onPathsAccepted: onPaths,
    validatePaths: (paths) => validateDroppedVideoFilePaths(paths.slice(0, 1))
  })

  const pickVideo = useCallback(async () => {
    const paths = await desktop.pickVideoFiles()
    if (paths.length === 0) return
    onPaths(paths)
  }, [desktop, onPaths])

  const pickSave = useCallback(async () => {
    if (!inputPath) return
    const suggested = suggestedVideoFormatConvertSavePath(inputPath, outputFormat)
    const p = await desktop.pickVideoFormatSavePath({
      defaultPath: suggested,
      format: outputFormat
    })
    if (p) ui.setOutputPath(p)
  }, [desktop, inputPath, outputFormat, ui])

  const canStart =
    Boolean(probe) &&
    Boolean(outputPath) &&
    !ui.planError &&
    !alphaHint &&
    flowStatus !== 'processing' &&
    flowStatus !== 'probing'

  const onStart = useCallback(async () => {
    if (!inputPath || !outputPath || !probe || ui.planError || alphaHint) return
    const plan = resolveVideoFormatConversion({
      probe,
      target: outputFormat,
      inputPath,
      outputPath
    })
    if (!plan.ok) {
      toast.error(plan.reason)
      return
    }
    const jobId = crypto.randomUUID()
    job.beginJob(jobId)
    ui.setFlowStatus('processing')
    try {
      await startVideoFormatConvertJob({
        jobId,
        inputPath,
        outputPath,
        target: outputFormat
      })
    } catch (e) {
      ui.setFlowStatus('failed')
      toast.error(e instanceof Error ? e.message : 'Không gửi được job.')
    }
  }, [inputPath, outputPath, probe, outputFormat, ui, job, alphaHint])

  const onCancel = useCallback(() => {
    const id = job.jobId
    if (id) void cancelVideoFormatConvertJob(id)
  }, [job.jobId])

  const onReset = useCallback(() => {
    if (job.jobId && flowStatus === 'processing') {
      void cancelVideoFormatConvertJob(job.jobId)
    }
    resetVideoFormatConvertSession()
  }, [job.jobId, flowStatus])

  return (
    <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-6 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <ScrollArea className="h-full min-h-0 min-w-0 rounded-xl border border-border/90 bg-card/40 shadow-none ring-1 ring-white/4">
        <div className="min-w-0 space-y-5 p-5">
          <Card
            {...drop.getRootProps({
              className: cn(
                'relative min-w-0 overflow-hidden border-border/80 bg-transparent shadow-none outline-none transition-[border-color,box-shadow,background-color] duration-150',
                drop.surface === 'dragging' &&
                  'border-2 border-dashed border-primary bg-primary/[0.06] ring-2 ring-primary/20',
                drop.surface === 'accepted' &&
                  'border-2 border-dashed border-emerald-500/50 bg-emerald-500/[0.05]',
                (drop.surface === 'rejected' || drop.surface === 'error') &&
                  'border-2 border-dashed border-destructive/70 bg-destructive/[0.06]',
                busy && 'pointer-events-none opacity-60'
              )
            })}
          >
            <input
              {...drop.getInputProps({
                className: 'sr-only',
                'aria-label': 'Thả một video vào đây'
              })}
            />
            {drop.surface === 'dragging' ? (
              <div
                className="pointer-events-none absolute inset-0 z-1 rounded-[inherit] bg-background/20 ring-1 ring-inset ring-primary/20"
                aria-hidden
              />
            ) : null}
            <CardHeader className="relative z-2 space-y-1 pb-4">
              <CardTitle>Đầu vào</CardTitle>
              <CardDescription>
                Một tệp video. Định dạng: mp4, mov, webm, mkv, avi, m4v, gif.
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-2 min-w-0 space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  className="gap-2"
                  onClick={() => void pickVideo()}
                >
                  <FileVideo className="size-4" aria-hidden />
                  Chọn video
                </Button>
              </div>
              {inputPath ? (
                <p className="break-all font-mono text-xs text-muted-foreground">{inputPath}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Chưa chọn video - kéo thả vào khung này.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-transparent shadow-none">
            <CardHeader className="space-y-1 pb-4">
              <CardTitle>Định dạng đích & chạy</CardTitle>
              <CardDescription>
                Chọn định dạng và đường dẫn tệp đầu ra trước khi bấm chạy. Lệnh ffmpeg xem ở cột bên
                phải.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vfc-out-fmt">Định dạng đầu ra</Label>
                <Select
                  disabled={busy}
                  value={outputFormat}
                  onValueChange={(v) => ui.setOutputFormat(v as VideoFormatTarget)}
                >
                  <SelectTrigger id="vfc-out-fmt">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_FORMAT_SELECT_ITEMS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {videoFormatTargetLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Đường dẫn lưu</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy || !inputPath}
                    onClick={() => void pickSave()}
                  >
                    <FolderOpen className="mr-2 size-4" aria-hidden />
                    Chọn đầu ra…
                  </Button>
                </div>
                {outputPath ? (
                  <p className="break-all text-xs text-muted-foreground">{outputPath}</p>
                ) : (
                  <p className="text-xs text-amber-600/90 dark:text-amber-400/90">
                    Cần chọn tệp đích (đúng phần mở rộng) trước khi chạy.
                  </p>
                )}
              </div>
              {alphaHint ? (
                <p className="text-sm text-destructive" role="alert">
                  {alphaHint}
                </p>
              ) : probe?.inputHasAlpha && targetKeepsAlphaWell(outputFormat) ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Video có alpha. Định dạng đích có hỗ trợ; pipeline sẽ cố giữ độ trong suốt khi phù
                  hợp.
                </p>
              ) : null}
              {ui.planError ? (
                <p className="text-sm text-destructive" role="alert">
                  {ui.planError}
                </p>
              ) : null}

              <Separator className="opacity-60" />

              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={!canStart} onClick={() => void onStart()}>
                  {flowStatus === 'processing' ? (
                    <Spinner className="size-4" aria-hidden />
                  ) : (
                    <Wand2 className="size-4" aria-hidden />
                  )}
                  Bắt đầu
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={flowStatus !== 'processing'}
                  onClick={onCancel}
                >
                  <Square className="size-4" aria-hidden />
                  Hủy
                </Button>
                <Button type="button" variant="ghost" disabled={busy} onClick={onReset}>
                  Reset
                </Button>
                {job.outputPath && flowStatus === 'completed' ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void shellOpenPath(job.outputPath!)}
                    >
                      Mở tệp
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void shellRevealFile(job.outputPath!)}
                    >
                      <FolderOpen className="size-4" aria-hidden />
                      Thư mục
                    </Button>
                  </>
                ) : null}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tiến độ</span>
                  <span className="tabular-nums">{Math.round(job.percent)}%</span>
                </div>
                <Progress value={job.percent} />
              </div>
              {job.errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                  {job.errorMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <VideoFormatConvertPreviewColumn />
    </div>
  )
}
