import type { ReactElement } from 'react'

import { useImageDocumentMergeStore } from '@/features/image-document-merge/application/image-document-merge.store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { Label } from '@/shared/presentation/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/presentation/components/ui/select'
import { Slider } from '@/shared/presentation/components/ui/slider'
import type {
  DocumentMargin,
  DocumentOrientation,
  DocumentOutputFormat,
  DocumentPageSize,
  ImageFit
} from '@shared/domain/image-document-merge'

export function DocumentOutputSettings({ busy }: { busy: boolean }): ReactElement {
  const mode = useImageDocumentMergeStore((state) => state.mode)
  const outputFormat = useImageDocumentMergeStore((state) => state.outputFormat)
  const settings = useImageDocumentMergeStore((state) => state.settings)
  const setOutputFormat = useImageDocumentMergeStore((state) => state.setOutputFormat)
  const updateSettings = useImageDocumentMergeStore((state) => state.updateSettings)
  const allowMatchImage = mode === 'create' && outputFormat === 'pdf'

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle>Thiết lập đầu ra</CardTitle>
        <CardDescription>Ảnh được auto-rotate theo EXIF và xóa metadata khi xuất.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="idm-format">Định dạng</Label>
          <Select
            value={outputFormat}
            disabled={busy || mode === 'append'}
            onValueChange={(value) => setOutputFormat(value as DocumentOutputFormat)}
          >
            <SelectTrigger id="idm-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">DOCX</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="idm-page-size">Kích thước trang</Label>
          <Select
            value={settings.pageSize}
            disabled={busy}
            onValueChange={(value) => updateSettings({ pageSize: value as DocumentPageSize })}
          >
            <SelectTrigger id="idm-page-size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4</SelectItem>
              {allowMatchImage ? <SelectItem value="match_image">Theo tỷ lệ ảnh</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="idm-orientation">Hướng trang</Label>
          <Select
            value={settings.orientation}
            disabled={busy}
            onValueChange={(value) => updateSettings({ orientation: value as DocumentOrientation })}
          >
            <SelectTrigger id="idm-orientation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Tự động theo ảnh</SelectItem>
              <SelectItem value="portrait">Dọc</SelectItem>
              <SelectItem value="landscape">Ngang</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="idm-margin">Lề trang</Label>
          <Select
            value={settings.margin}
            disabled={busy}
            onValueChange={(value) => updateSettings({ margin: value as DocumentMargin })}
          >
            <SelectTrigger id="idm-margin">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Không lề</SelectItem>
              <SelectItem value="small">Nhỏ · 6 mm</SelectItem>
              <SelectItem value="standard">Chuẩn · 12 mm</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="idm-fit">Cách đặt ảnh</Label>
          <Select
            value={settings.imageFit}
            disabled={busy}
            onValueChange={(value) => updateSettings({ imageFit: value as ImageFit })}
          >
            <SelectTrigger id="idm-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contain">Vừa trang, không cắt</SelectItem>
              <SelectItem value="cover">Phủ trang, có thể cắt</SelectItem>
              <SelectItem value="actual">Không phóng to ảnh nhỏ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="idm-quality">Chất lượng JPEG</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{settings.quality}</span>
          </div>
          <div className="flex h-9 items-center">
            <Slider
              id="idm-quality"
              value={[settings.quality]}
              min={40}
              max={95}
              step={1}
              disabled={busy}
              onValueChange={(value) => updateSettings({ quality: value[0] ?? settings.quality })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Không bảo đảm chính xác dung lượng file. Ảnh có alpha được giữ bằng PNG.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
