import { useImageWatermarkJobStore } from '@/features/image-watermark/application/stores/image-watermark-job.store'
import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'
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
import type { WatermarkOutputFormat } from '@shared/domain/image-watermark'
import { WATERMARK_OUTPUT_FORMATS } from '@shared/domain/image-watermark'
import { FolderOpen, Square, Wand2 } from 'lucide-react'
import type { ReactElement } from 'react'

const FORMAT_LABELS: Record<WatermarkOutputFormat, string> = {
  keep: 'Giữ nguyên định dạng gốc',
  jpeg: 'JPEG (.jpg)',
  png: 'PNG (.png)',
  webp: 'WebP (.webp)'
}

export type ImageWatermarkOptionsCardProps = {
  canStart: boolean
  busy: boolean
  showProgressPercent: boolean
  progressPercent: number
  onRun: () => void | Promise<void>
  onCancel: () => void
  onResetSession: () => void
}

export function ImageWatermarkOptionsCard({
  canStart,
  busy,
  showProgressPercent,
  progressPercent,
  onRun,
  onCancel,
  onResetSession
}: ImageWatermarkOptionsCardProps): ReactElement {
  const ui = useImageWatermarkUiStore()
  const job = useImageWatermarkJobStore()

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle>Xuất &amp; chất lượng</CardTitle>
        <CardDescription>
          Chọn định dạng đích - JPEG sẽ loại bỏ alpha (nền trắng), PNG/WebP giữ trong suốt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="iw-fmt">Định dạng xuất</Label>
          <Select
            value={ui.outputFormat}
            disabled={busy}
            onValueChange={(v) => ui.setOutputFormat(v as WatermarkOutputFormat)}
          >
            <SelectTrigger id="iw-fmt">
              <SelectValue placeholder="Chọn định dạng" />
            </SelectTrigger>
            <SelectContent>
              {WATERMARK_OUTPUT_FORMATS.map((f) => (
                <SelectItem key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="iw-meta" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Giữ metadata (EXIF) khi có thể</span>
            <span className="block text-xs text-muted-foreground">
              Sharp withMetadata - không phải định dạng nào cũng giữ đầy đủ.
            </span>
          </Label>
          <Checkbox
            id="iw-meta"
            checked={ui.keepMetadata}
            disabled={busy}
            onCheckedChange={(v) => ui.setKeepMetadata(v === true)}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="iw-autoname" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Đổi tên đầu ra (_watermark)</span>
            <span className="block text-xs text-muted-foreground">
              Tắt để dùng tên gốc + phần mở rộng (dễ trùng tệp).
            </span>
          </Label>
          <Checkbox
            id="iw-autoname"
            checked={ui.autoRename}
            disabled={busy}
            onCheckedChange={(v) => ui.setAutoRename(v === true)}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="iw-overwrite" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Ghi đè nếu tệp đích đã tồn tại</span>
          </Label>
          <Checkbox
            id="iw-overwrite"
            checked={ui.overwrite}
            disabled={busy}
            onCheckedChange={(v) => ui.setOverwrite(v === true)}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="iw-whole" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Xử lý toàn bộ hàng đợi</span>
            <span className="block text-xs text-muted-foreground">
              Tắt để chỉ xử lý mục đang chọn.
            </span>
          </Label>
          <Checkbox
            id="iw-whole"
            checked={ui.processWholeQueue}
            disabled={busy}
            onCheckedChange={(v) => ui.setProcessWholeQueue(v === true)}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor="iw-zip" className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">ZIP sau batch</span>
            <span className="block text-xs text-muted-foreground">
              Chỉ gói các tệp gắn watermark thành công (cùng thư mục đầu ra).
            </span>
          </Label>
          <Checkbox
            id="iw-zip"
            checked={ui.zipOutput}
            disabled={busy}
            onCheckedChange={(v) => ui.setZipOutput(v === true)}
            className="mt-0.5"
          />
        </div>

        <Separator className="opacity-60" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>JPEG quality</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{ui.jpegQuality}</span>
            </div>
            <Slider
              value={[ui.jpegQuality]}
              min={1}
              max={100}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setJpegQuality(v[0] ?? ui.jpegQuality)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>WebP quality</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{ui.webpQuality}</span>
            </div>
            <Slider
              value={[ui.webpQuality]}
              min={1}
              max={100}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setWebpQuality(v[0] ?? ui.webpQuality)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <div className="flex justify-between">
              <Label>PNG compression (0-9)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {ui.pngCompressionLevel}
              </span>
            </div>
            <Slider
              value={[ui.pngCompressionLevel]}
              min={0}
              max={9}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setPngCompressionLevel(v[0] ?? ui.pngCompressionLevel)}
            />
          </div>
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
            onClick={() => {
              useImageWatermarkUiStore.getState().clearQueue()
            }}
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
