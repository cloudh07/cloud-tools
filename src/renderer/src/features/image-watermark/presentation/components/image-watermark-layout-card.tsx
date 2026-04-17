import { useImageWatermarkUiStore } from '@/features/image-watermark/application/stores/image-watermark-ui.store'
import { ImageWatermarkPillTabs } from '@/features/image-watermark/presentation/components/image-watermark-pill-tabs'
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
import { Slider } from '@/shared/presentation/components/ui/slider'
import type { WatermarkAnchorPosition } from '@shared/domain/image-watermark'
import { WATERMARK_ANCHOR_POSITIONS } from '@shared/domain/image-watermark'
import { Anchor, LayoutGrid } from 'lucide-react'
import type { ReactElement } from 'react'

const LAYOUT_TABS = [
  { id: 'anchor' as const, label: 'Anchor', Icon: Anchor },
  { id: 'tile' as const, label: 'Tile', Icon: LayoutGrid }
]

const ANCHOR_LABELS: Record<WatermarkAnchorPosition, string> = {
  'top-left': 'Trên · trái',
  top: 'Trên · giữa',
  'top-right': 'Trên · phải',
  left: 'Giữa · trái',
  center: 'Giữa',
  right: 'Giữa · phải',
  'bottom-left': 'Dưới · trái',
  bottom: 'Dưới · giữa',
  'bottom-right': 'Dưới · phải'
}

export type ImageWatermarkLayoutCardProps = {
  busy: boolean
}

export function ImageWatermarkLayoutCard({ busy }: ImageWatermarkLayoutCardProps): ReactElement {
  const ui = useImageWatermarkUiStore()

  return (
    <Card className="border-border/80 bg-transparent shadow-none">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle>Bố cục</CardTitle>
        <CardDescription>
          Chọn đặt ở 1 vị trí (anchor) hoặc lặp lại theo lưới (tile).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <ImageWatermarkPillTabs
          value={ui.layout}
          items={LAYOUT_TABS}
          disabled={busy}
          layoutId="image-watermark-layout-mode-pill"
          ariaLabel="Chế độ bố cục watermark"
          onValueChange={(id) => {
            if (busy) return
            ui.setLayout(id)
          }}
        />

        {ui.layout === 'anchor' ? (
          <div className="space-y-4">
            <div
              className="mx-auto grid w-full max-w-[240px] grid-cols-3 gap-1.5"
              role="radiogroup"
              aria-label="Vị trí anchor"
            >
              {WATERMARK_ANCHOR_POSITIONS.map((pos) => {
                const active = ui.anchorPosition === pos
                return (
                  <Button
                    key={pos}
                    type="button"
                    variant={active ? 'secondary' : 'outline'}
                    disabled={busy}
                    size="sm"
                    role="radio"
                    aria-checked={active}
                    aria-label={ANCHOR_LABELS[pos]}
                    className={cn(
                      'h-10 rounded-md p-0 text-xs',
                      active && 'ring-2 ring-primary/70'
                    )}
                    onClick={() => ui.setAnchorPosition(pos)}
                  >
                    <span className="size-2 rounded-full bg-current opacity-80" aria-hidden />
                  </Button>
                )
              })}
            </div>
            <p className="text-center text-xs text-muted-foreground">
              {ANCHOR_LABELS[ui.anchorPosition]}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="iw-offx">Offset X (px)</Label>
                <Input
                  id="iw-offx"
                  type="number"
                  value={ui.anchorOffsetX}
                  disabled={busy}
                  step={1}
                  onChange={(e) => ui.setAnchorOffsetX(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="iw-offy">Offset Y (px)</Label>
                <Input
                  id="iw-offy"
                  type="number"
                  value={ui.anchorOffsetY}
                  disabled={busy}
                  step={1}
                  onChange={(e) => ui.setAnchorOffsetY(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Khoảng cách X (% rộng)</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {ui.tileSpacingX}
                </span>
              </div>
              <Slider
                value={[ui.tileSpacingX]}
                min={5}
                max={100}
                step={1}
                disabled={busy}
                onValueChange={(v) => ui.setTileSpacingX(v[0] ?? ui.tileSpacingX)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Khoảng cách Y (% cao)</Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {ui.tileSpacingY}
                </span>
              </div>
              <Slider
                value={[ui.tileSpacingY]}
                min={5}
                max={100}
                step={1}
                disabled={busy}
                onValueChange={(v) => ui.setTileSpacingY(v[0] ?? ui.tileSpacingY)}
              />
            </div>
            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3">
              <Label htmlFor="iw-stagger" className="cursor-pointer space-y-1 font-normal">
                <span className="block text-sm font-medium">Stagger hàng lẻ</span>
                <span className="block text-xs text-muted-foreground">
                  Dịch một nửa khoảng cách để xen kẽ thành dạng gạch.
                </span>
              </Label>
              <Checkbox
                id="iw-stagger"
                checked={ui.tileStaggerOddRows}
                disabled={busy}
                onCheckedChange={(v) => ui.setTileStaggerOddRows(v === true)}
                className="mt-0.5"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Kích thước (%)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{ui.scalePercent}</span>
            </div>
            <Slider
              value={[ui.scalePercent]}
              min={1}
              max={100}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setScalePercent(v[0] ?? ui.scalePercent)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Lề (%)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{ui.marginPercent}</span>
            </div>
            <Slider
              value={[ui.marginPercent]}
              min={0}
              max={25}
              step={0.5}
              disabled={busy}
              onValueChange={(v) => ui.setMarginPercent(v[0] ?? ui.marginPercent)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Opacity</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(ui.opacity * 100)}%
              </span>
            </div>
            <Slider
              value={[Math.round(ui.opacity * 100)]}
              min={1}
              max={100}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setOpacity((v[0] ?? 70) / 100)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Xoay (°)</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{ui.rotationDeg}</span>
            </div>
            <Slider
              value={[ui.rotationDeg]}
              min={-180}
              max={180}
              step={1}
              disabled={busy}
              onValueChange={(v) => ui.setRotationDeg(v[0] ?? ui.rotationDeg)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
