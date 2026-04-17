import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'
import { ColorField } from '@/features/image-watermark/presentation/components/color-field'
import { FontFamilyCombobox } from '@/features/image-watermark/presentation/components/font-family-combobox'
import { ImageWatermarkPillTabs } from '@/features/image-watermark/presentation/components/image-watermark-pill-tabs'
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
import { Slider } from '@/shared/presentation/components/ui/slider'
import { Textarea } from '@/shared/presentation/components/ui/textarea'
import { useRouteContext } from '@tanstack/react-router'
import { FolderOpen, Image as ImageIcon, Type } from 'lucide-react'
import type { ReactElement } from 'react'
import { toast } from 'sonner'

const DEFAULT_STROKE_HEX = '#000000'

const SOURCE_KIND_TABS = [
  { id: 'text' as const, label: 'Văn bản', Icon: Type },
  { id: 'image' as const, label: 'Logo ảnh', Icon: ImageIcon }
]

export type ImageWatermarkSourceCardProps = {
  busy: boolean
}

export function ImageWatermarkSourceCard({ busy }: ImageWatermarkSourceCardProps): ReactElement {
  const { desktop } = useRouteContext({ from: '/tools' })
  const ui = useImageWatermarkUiStore()

  const strokeEnabled = ui.textSource.strokeColorHex !== null
  const strokeHex = ui.textSource.strokeColorHex ?? DEFAULT_STROKE_HEX

  const pickLogo = async (): Promise<void> => {
    try {
      const p = await desktop.pickWatermarkLogoFile()
      if (!p) return
      ui.setImageSource({ logoPath: p })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không chọn được tệp logo')
    }
  }

  const toggleStroke = (enabled: boolean): void => {
    ui.setTextSource({
      strokeColorHex: enabled ? (ui.textSource.strokeColorHex ?? DEFAULT_STROKE_HEX) : null
    })
  }

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle>Nguồn watermark</CardTitle>
        <CardDescription>
          Chọn kiểu watermark - ảnh logo (PNG/SVG/WebP có alpha) hoặc chuỗi văn bản.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ImageWatermarkPillTabs
          value={ui.sourceKind}
          items={SOURCE_KIND_TABS}
          disabled={busy}
          layoutId="image-watermark-source-kind-pill"
          ariaLabel="Kiểu nguồn watermark"
          onValueChange={(id) => {
            if (busy) return
            ui.setSourceKind(id)
          }}
        />

        {ui.sourceKind === 'text' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="iw-text">Nội dung</Label>
              <Textarea
                id="iw-text"
                value={ui.textSource.text}
                disabled={busy}
                rows={2}
                maxLength={512}
                placeholder="© Cloud Tools"
                onChange={(e) => ui.setTextSource({ text: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="iw-font">Font family</Label>
                <FontFamilyCombobox
                  id="iw-font"
                  value={ui.textSource.fontFamily}
                  disabled={busy}
                  onChange={(name) => ui.setTextSource({ fontFamily: name })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iw-color">Màu chữ</Label>
                <ColorField
                  id="iw-color"
                  value={ui.textSource.colorHex}
                  disabled={busy}
                  ariaLabel="Chọn màu chữ watermark"
                  onChange={(hex) => ui.setTextSource({ colorHex: hex })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Font weight</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {ui.textSource.fontWeight}
                  </span>
                </div>
                <div className="flex h-9 items-center">
                  <Slider
                    value={[ui.textSource.fontWeight]}
                    min={100}
                    max={900}
                    step={100}
                    disabled={busy}
                    onValueChange={(v) =>
                      ui.setTextSource({ fontWeight: v[0] ?? ui.textSource.fontWeight })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cỡ chữ (%)</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {ui.textSource.fontSizePercent}
                  </span>
                </div>
                <div className="flex h-9 items-center">
                  <Slider
                    value={[ui.textSource.fontSizePercent]}
                    min={1}
                    max={30}
                    step={0.5}
                    disabled={busy}
                    onValueChange={(v) =>
                      ui.setTextSource({
                        fontSizePercent: v[0] ?? ui.textSource.fontSizePercent
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="space-y-3 rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="iw-stroke-toggle"
                    checked={strokeEnabled}
                    disabled={busy}
                    onCheckedChange={(v) => toggleStroke(v === true)}
                  />
                  <Label htmlFor="iw-stroke-toggle" className="cursor-pointer select-none">
                    Bật viền chữ
                  </Label>
                </div>
                {strokeEnabled && (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {ui.textSource.strokeWidthPx}px
                  </span>
                )}
              </div>
              {strokeEnabled && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="iw-stroke-color">Màu viền</Label>
                    <ColorField
                      id="iw-stroke-color"
                      value={strokeHex}
                      disabled={busy}
                      ariaLabel="Chọn màu viền chữ"
                      onChange={(hex) => ui.setTextSource({ strokeColorHex: hex })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Độ dày viền (px)</Label>
                    <div className="flex h-9 items-center">
                      <Slider
                        value={[ui.textSource.strokeWidthPx]}
                        min={0}
                        max={10}
                        step={0.5}
                        disabled={busy}
                        onValueChange={(v) =>
                          ui.setTextSource({ strokeWidthPx: v[0] ?? ui.textSource.strokeWidthPx })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void pickLogo()}
              >
                <FolderOpen className="mr-2 size-4" aria-hidden />
                Chọn logo
              </Button>
            </div>
            {ui.imageSource.logoPath ? (
              <p className="break-all font-mono text-xs text-muted-foreground">
                {ui.imageSource.logoPath}
              </p>
            ) : (
              <p className="text-xs text-amber-600/90">
                Chưa có logo. Hỗ trợ PNG/SVG/WebP có kênh trong suốt.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
