import { useImageFormatConvertJobStore } from '@/features/image-format-convert/application/stores/image-format-convert-job.store'
import { useImageFormatConvertUiStore } from '@/features/image-format-convert/application/stores/image-format-convert-ui.store'
import { formatTargetLabel } from '@/features/image-format-convert/presentation/lib/image-format-convert-target-labels'
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
import type { ImageFormatTarget } from '@shared/domain/image-format-convert'
import { IMAGE_FORMAT_TARGETS } from '@shared/domain/image-format-convert'
import { FolderOpen, Play, Square } from 'lucide-react'
import type { ReactElement } from 'react'

export type ImageFormatConvertOptionsCardProps = {
  variant: 'single' | 'batch'
  idPrefix: string
  canStart: boolean
  busy: boolean
  showProgressPercent: boolean
  progressPercent: number
  onRun: () => void | Promise<void>
  onCancel: () => void
  onResetSession: () => void
}

export function ImageFormatConvertOptionsCard({
  variant,
  idPrefix,
  canStart,
  busy,
  showProgressPercent,
  progressPercent,
  onRun,
  onCancel,
  onResetSession
}: ImageFormatConvertOptionsCardProps): ReactElement {
  const ui = useImageFormatConvertUiStore()
  const job = useImageFormatConvertJobStore()

  const clearLabel = variant === 'single' ? 'Xóa ảnh' : 'Xóa hàng đợi'
  const canClear = variant === 'single' ? ui.queue.length > 0 : ui.queue.length > 0

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle>Định dạng đích</CardTitle>
        <CardDescription>
          Chọn trước khi bấm chạy. JPEG không hỗ trợ alpha - batch sẽ báo lỗi rõ cho từng ảnh có
          trong suốt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-fmt`}>Định dạng xuất</Label>
          <Select
            value={ui.outputFormat}
            disabled={busy}
            onValueChange={(v) => ui.setOutputFormat(v as ImageFormatTarget)}
          >
            <SelectTrigger id={`${idPrefix}-fmt`}>
              <SelectValue placeholder="Chọn định dạng" />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_FORMAT_TARGETS.map((t) => (
                <SelectItem key={t} value={t}>
                  {formatTargetLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor={`${idPrefix}-keep-meta`} className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Giữ metadata (EXIF) khi có thể</span>
            <span className="block text-xs text-muted-foreground">
              Sharp withMetadata - không phải định dạng nào cũng giữ đầy đủ.
            </span>
          </Label>
          <Checkbox
            id={`${idPrefix}-keep-meta`}
            checked={ui.keepMetadata}
            disabled={busy}
            onCheckedChange={(v) => ui.setKeepMetadata(v === true)}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor={`${idPrefix}-autoname`} className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Đổi tên đầu ra (_converted)</span>
            <span className="block text-xs text-muted-foreground">
              Tắt để dùng tên gốc + phần mở rộng mới (dễ trùng tệp).
            </span>
          </Label>
          <Checkbox
            id={`${idPrefix}-autoname`}
            checked={ui.autoRename}
            disabled={busy}
            onCheckedChange={(v) => ui.setAutoRename(v === true)}
            className="mt-0.5"
          />
        </div>

        <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
          <Label htmlFor={`${idPrefix}-overwrite`} className="cursor-pointer space-y-1 font-normal">
            <span className="block text-sm font-medium">Ghi đè nếu tệp đích đã tồn tại</span>
          </Label>
          <Checkbox
            id={`${idPrefix}-overwrite`}
            checked={ui.overwrite}
            disabled={busy}
            onCheckedChange={(v) => ui.setOverwrite(v === true)}
            className="mt-0.5"
          />
        </div>

        {variant === 'batch' ? (
          <>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
              <Label htmlFor={`${idPrefix}-batch`} className="cursor-pointer space-y-1 font-normal">
                <span className="block text-sm font-medium">Batch - xử lý toàn bộ hàng đợi</span>
                <span className="block text-xs text-muted-foreground">
                  Tắt để chỉ chuyển mục đang chọn.
                </span>
              </Label>
              <Checkbox
                id={`${idPrefix}-batch`}
                checked={ui.convertWholeQueue}
                disabled={busy}
                onCheckedChange={(v) => ui.setConvertWholeQueue(v === true)}
                className="mt-0.5"
              />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
              <Label htmlFor={`${idPrefix}-zip`} className="cursor-pointer space-y-1 font-normal">
                <span className="block text-sm font-medium">ZIP sau batch</span>
                <span className="block text-xs text-muted-foreground">
                  Chỉ gói các tệp chuyển đổi thành công (cùng thư mục đầu ra).
                </span>
              </Label>
              <Checkbox
                id={`${idPrefix}-zip`}
                checked={ui.zipOutput}
                disabled={busy}
                onCheckedChange={(v) => ui.setZipOutput(v === true)}
                className="mt-0.5"
              />
            </div>
          </>
        ) : null}

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
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>AVIF quality</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{ui.avifQuality}</span>
            </div>
            <Slider
              value={[ui.avifQuality]}
              min={1}
              max={100}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setAvifQuality(v[0] ?? ui.avifQuality)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>PNG compression (0–9)</Label>
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
            {busy ? <Spinner className="size-4" /> : <Play className="mr-2 size-4" />}
            Bắt đầu chuyển đổi
          </Button>
          <Button type="button" variant="outline" disabled={!busy} onClick={onCancel}>
            <Square className="mr-2 size-4" />
            Hủy
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !canClear}
            onClick={() => {
              useImageFormatConvertUiStore.getState().clearQueue()
            }}
          >
            {clearLabel}
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
