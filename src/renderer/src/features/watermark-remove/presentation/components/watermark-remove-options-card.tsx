import { useWatermarkRemoveJobStore } from '@/features/watermark-remove/application/stores/watermark-remove-job.store'
import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import { useWatermarkRemoveModel } from '@/features/watermark-remove/presentation/hooks/use-watermark-remove-model'
import { shellOpenDirectory } from '@/shared/lib/desktop-bridge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/presentation/components/ui/select'
import { Separator } from '@/shared/presentation/components/ui/separator'
import { Slider } from '@/shared/presentation/components/ui/slider'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import type {
  WatermarkRemoveEngine,
  WatermarkRemoveImageFormat,
  WatermarkRemoveVideoCodec
} from '@shared/domain/watermark-remove'
import {
  WATERMARK_REMOVE_IMAGE_FORMATS,
  WATERMARK_REMOVE_VIDEO_CODECS
} from '@shared/domain/watermark-remove'
import { Download, FolderOpen, Square, Trash2, Wand2 } from 'lucide-react'
import type { ReactElement } from 'react'

const IMAGE_FORMAT_LABELS: Record<WatermarkRemoveImageFormat, string> = {
  keep: 'Giữ nguyên định dạng gốc',
  jpeg: 'JPEG (.jpg)',
  png: 'PNG (.png)',
  webp: 'WebP (.webp)'
}

const VIDEO_CODEC_LABELS: Record<WatermarkRemoveVideoCodec, string> = {
  copy: 'Copy (giữ nguyên codec)',
  h264: 'H.264 / MP4',
  vp9: 'VP9 / WebM'
}

const ENGINE_LABELS: Record<WatermarkRemoveEngine, string> = {
  classical: 'Classical (Telea) - ngoại tuyến',
  ai: 'AI (LaMa) - cần model'
}

const PRESET_VALUES = ['ultrafast', 'fast', 'medium', 'slow'] as const

export type WatermarkRemoveOptionsCardProps = {
  canStart: boolean
  busy: boolean
  showProgressPercent: boolean
  progressPercent: number
  onRun: () => void | Promise<void>
  onCancel: () => void
  onResetSession: () => void
}

export function WatermarkRemoveOptionsCard({
  canStart,
  busy,
  showProgressPercent,
  progressPercent,
  onRun,
  onCancel,
  onResetSession
}: WatermarkRemoveOptionsCardProps): ReactElement {
  const ui = useWatermarkRemoveUiStore()
  const job = useWatermarkRemoveJobStore()
  const lama = useWatermarkRemoveModel('lama-inpaint')
  const u2net = useWatermarkRemoveModel('u2net-detect')

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle>Engine &amp; Xuất</CardTitle>
        <CardDescription>
          Classical hoạt động hoàn toàn offline. AI cho chất lượng cao hơn nhưng cần tải model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wr-engine">Engine</Label>
          <Select
            value={ui.engine}
            disabled={busy}
            onValueChange={(v) => ui.setEngine(v as WatermarkRemoveEngine)}
          >
            <SelectTrigger id="wr-engine">
              <SelectValue placeholder="Chọn engine" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="classical">{ENGINE_LABELS.classical}</SelectItem>
              <SelectItem value="ai">{ENGINE_LABELS.ai}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {ui.engine === 'ai' ? (
          <div className="space-y-3 rounded-lg border border-border/70 bg-background/40 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Model LaMa inpainting</p>
              <p className="text-xs text-muted-foreground">
                Trạng thái: {lama.status.state}
                {lama.status.errorMessage ? ` · ${lama.status.errorMessage}` : ''}
              </p>
              {lama.isBusy ? <Progress value={lama.percent} /> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={lama.isBusy || lama.status.state === 'ready'}
                onClick={() => void lama.startDownload()}
              >
                <Download className="mr-2 size-4" aria-hidden />
                {lama.status.state === 'ready' ? 'Đã sẵn sàng' : 'Tải model'}
              </Button>
              {lama.status.state === 'ready' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void lama.deleteModel()}
                >
                  <Trash2 className="mr-2 size-4" aria-hidden />
                  Xóa model
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="space-y-1 rounded-lg border border-border/70 bg-background/40 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Model auto-detect (U²-Net lite)</p>
          <p>
            {u2net.status.state === 'ready'
              ? 'Đã tải. Nhấn Auto-detect để dùng AI.'
              : u2net.status.state === 'downloading'
                ? `Đang tải… ${u2net.percent}%`
                : 'Nếu không tải, Auto-detect sẽ dùng thuật toán heuristic (Sobel).'}
          </p>
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={u2net.isBusy || u2net.status.state === 'ready'}
              onClick={() => void u2net.startDownload()}
            >
              <Download className="mr-2 size-4" aria-hidden />
              {u2net.status.state === 'ready' ? 'Đã sẵn sàng' : 'Tải U²-Net'}
            </Button>
          </div>
        </div>

        <Separator className="opacity-60" />

        <div className="space-y-2">
          <Label htmlFor="wr-img-fmt">Định dạng ảnh đầu ra</Label>
          <Select
            value={ui.imageOptions.outputFormat}
            disabled={busy}
            onValueChange={(v) => {
              ui.setImageOption('outputFormat', v as WatermarkRemoveImageFormat)
              ui.rebuildOutputPaths()
            }}
          >
            <SelectTrigger id="wr-img-fmt">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WATERMARK_REMOVE_IMAGE_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {IMAGE_FORMAT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="wr-vid-codec">Video codec</Label>
          <Select
            value={ui.videoOptions.videoCodec}
            disabled={busy}
            onValueChange={(v) => {
              ui.setVideoOption('videoCodec', v as WatermarkRemoveVideoCodec)
              ui.rebuildOutputPaths()
            }}
          >
            <SelectTrigger id="wr-vid-codec">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WATERMARK_REMOVE_VIDEO_CODECS.map((c) => (
                <SelectItem key={c} value={c}>
                  {VIDEO_CODEC_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-h-5 items-center justify-between gap-2">
              <Label htmlFor="wr-crf" className="text-sm font-medium leading-none">
                CRF (video)
              </Label>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {ui.videoOptions.crf}
              </span>
            </div>
            <div className="flex h-9 w-full items-center">
              <Slider
                id="wr-crf"
                className="w-full"
                value={[ui.videoOptions.crf]}
                min={12}
                max={36}
                step={1}
                disabled={busy || ui.videoOptions.videoCodec === 'copy'}
                onValueChange={(v) => ui.setVideoOption('crf', v[0] ?? ui.videoOptions.crf)}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-h-5 items-center justify-between gap-2">
              <Label htmlFor="wr-preset" className="text-sm font-medium leading-none">
                Preset (x264)
              </Label>
              <span className="shrink-0 text-xs capitalize tabular-nums text-muted-foreground">
                {ui.videoOptions.preset}
              </span>
            </div>
            <div className="flex h-9 w-full items-center">
              <Select
                value={ui.videoOptions.preset}
                disabled={busy || ui.videoOptions.videoCodec !== 'h264'}
                onValueChange={(v) =>
                  ui.setVideoOption('preset', v as (typeof PRESET_VALUES)[number])
                }
              >
                <SelectTrigger id="wr-preset" className="h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_VALUES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-h-5 items-center justify-between gap-2">
              <Label htmlFor="wr-jpeg-q" className="text-sm font-medium leading-none">
                JPEG quality
              </Label>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {ui.imageOptions.jpegQuality}
              </span>
            </div>
            <div className="flex h-9 w-full items-center">
              <Slider
                id="wr-jpeg-q"
                className="w-full"
                value={[ui.imageOptions.jpegQuality]}
                min={60}
                max={100}
                step={1}
                disabled={busy}
                onValueChange={(v) =>
                  ui.setImageOption('jpegQuality', v[0] ?? ui.imageOptions.jpegQuality)
                }
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-h-5 items-center justify-between gap-2">
              <Label htmlFor="wr-webp-q" className="text-sm font-medium leading-none">
                WebP quality
              </Label>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {ui.imageOptions.webpQuality}
              </span>
            </div>
            <div className="flex h-9 w-full items-center">
              <Slider
                id="wr-webp-q"
                className="w-full"
                value={[ui.imageOptions.webpQuality]}
                min={50}
                max={100}
                step={1}
                disabled={busy}
                onValueChange={(v) =>
                  ui.setImageOption('webpQuality', v[0] ?? ui.imageOptions.webpQuality)
                }
              />
            </div>
          </div>
        </div>

        <Separator className="opacity-60" />

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="wr-smooth" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Làm mượt theo thời gian (EMA)</span>
            <span className="block text-xs text-muted-foreground">
              Giảm nhấp nháy cho video. Alpha cao hơn = bám khung hiện tại nhiều hơn.
            </span>
          </Label>
          <Checkbox
            id="wr-smooth"
            checked={ui.temporalSmooth}
            disabled={busy}
            onCheckedChange={(v) => ui.setTemporalSmooth(v === true)}
            className="mt-0.5"
          />
        </div>

        {ui.temporalSmooth ? (
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>EMA alpha</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {ui.temporalAlpha.toFixed(2)}
              </span>
            </div>
            <Slider
              value={[Math.round(ui.temporalAlpha * 100)]}
              min={30}
              max={95}
              step={1}
              disabled={busy}
              onValueChange={(v) =>
                ui.setTemporalAlpha(((v[0] ?? Math.round(ui.temporalAlpha * 100)) as number) / 100)
              }
            />
          </div>
        ) : null}

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="wr-autoname" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Đổi tên đầu ra (_clean)</span>
          </Label>
          <Checkbox
            id="wr-autoname"
            checked={ui.imageOptions.autoRename}
            disabled={busy}
            onCheckedChange={(v) => {
              const next = v === true
              ui.setImageOption('autoRename', next)
              ui.setVideoOption('autoRename', next)
              ui.rebuildOutputPaths()
            }}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="wr-overwrite" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Ghi đè nếu tệp đích đã tồn tại</span>
          </Label>
          <Checkbox
            id="wr-overwrite"
            checked={ui.imageOptions.overwrite}
            disabled={busy}
            onCheckedChange={(v) => {
              const next = v === true
              ui.setImageOption('overwrite', next)
              ui.setVideoOption('overwrite', next)
            }}
            className="mt-0.5"
          />
        </div>

        <Separator className="opacity-60" />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!canStart} onClick={() => void onRun()}>
            {busy ? (
              <Spinner className="size-4" aria-hidden />
            ) : (
              <Wand2 className="size-4" aria-hidden />
            )}
            Bắt đầu
          </Button>
          <Button type="button" variant="outline" disabled={!busy} onClick={onCancel}>
            <Square className="mr-2 size-4" />
            Hủy
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || ui.queue.length === 0}
            onClick={() => useWatermarkRemoveUiStore.getState().clearQueue()}
          >
            Xóa hàng đợi
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onResetSession}>
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !ui.outputFolder}
            onClick={() => {
              const d = ui.outputFolder?.trim()
              if (d) void shellOpenDirectory(d)
            }}
          >
            <FolderOpen className="mr-2 size-4" aria-hidden />
            Mở thư mục đầu ra
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Label className="shrink-0">Tiến độ</Label>
              {busy ? (
                <Spinner className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
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
            {job.total > 0 ? (
              <span className="text-xs text-muted-foreground">
                {Object.values(job.items).filter((i) => i.status === 'completed').length}/
                {job.total} xong
              </span>
            ) : null}
          </div>
          <Progress value={progressPercent} />
        </div>
      </CardContent>
    </Card>
  )
}
