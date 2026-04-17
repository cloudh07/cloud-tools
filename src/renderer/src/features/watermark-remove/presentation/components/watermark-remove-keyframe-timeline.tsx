import { useWatermarkRemoveUiStore } from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import { Slider } from '@/shared/presentation/components/ui/slider'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, type ReactElement } from 'react'

export type WatermarkRemoveKeyframeTimelineProps = {
  durationSec: number
  busy: boolean
}

export function WatermarkRemoveKeyframeTimeline({
  durationSec,
  busy
}: WatermarkRemoveKeyframeTimelineProps): ReactElement {
  const ui = useWatermarkRemoveUiStore()

  const safeDuration = Math.max(0.01, durationSec)
  const playheadValue = useMemo(() => {
    return Math.min(1000, Math.max(0, Math.round((ui.playheadSec / safeDuration) * 1000)))
  }, [safeDuration, ui.playheadSec])

  return (
    <div className="space-y-3 rounded-lg border border-border/80 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">Keyframes mask</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              const id = useWatermarkRemoveUiStore.getState().addKeyframeAt(ui.playheadSec)
              useWatermarkRemoveUiStore.getState().setActiveKeyframe(id)
            }}
          >
            <Plus className="mr-2 size-4" aria-hidden />
            Thêm keyframe
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{ui.playheadSec.toFixed(2)}s</span>
          <span>{durationSec.toFixed(2)}s</span>
        </div>
        <Slider
          value={[playheadValue]}
          min={0}
          max={1000}
          step={1}
          disabled={busy || durationSec <= 0}
          onValueChange={(v) => {
            const ratio = (v[0] ?? 0) / 1000
            ui.setPlayhead(ratio * safeDuration)
          }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ui.keyframes.map((kf) => {
          const active = kf.id === ui.activeKeyframeId
          return (
            <div
              key={kf.id}
              className={cn(
                'flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
                active ? 'border-primary/60 bg-primary/10' : 'border-border/70 bg-background/60'
              )}
            >
              <button
                type="button"
                disabled={busy}
                className="tabular-nums"
                onClick={() => {
                  useWatermarkRemoveUiStore.getState().setActiveKeyframe(kf.id)
                  ui.setPlayhead(kf.time)
                }}
              >
                {kf.time.toFixed(2)}s · {kf.shapes.length} shape
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                disabled={busy || ui.keyframes.length <= 1}
                onClick={() => useWatermarkRemoveUiStore.getState().removeKeyframe(kf.id)}
                aria-label="Xóa keyframe"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
