import {
  useWatermarkRemoveUiStore,
  type EditorTool
} from '@/features/watermark-remove/application/stores/watermark-remove-ui.store'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import { Label } from '@/shared/presentation/components/ui/label'
import { Slider } from '@/shared/presentation/components/ui/slider'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/shared/presentation/components/ui/tooltip'
import { getDesktop } from '@/shared/lib/desktop-bridge'
import type {
  MaskBrushShape,
  MaskKeyframe,
  MaskPolygonShape,
  MaskRectShape,
  MaskShape
} from '@shared/domain/watermark-remove'
import {
  Brush,
  Eraser,
  Pentagon,
  Sparkles,
  Square as SquareIcon,
  Trash2,
  Undo2
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

type EditorPoint = { x: number; y: number }

export type WatermarkRemoveMaskEditorProps = {
  backgroundUrl: string | null
  busy: boolean
}

const TOOL_META: Record<EditorTool, { label: string; Icon: typeof SquareIcon }> = {
  rectangle: { label: 'Hình chữ nhật', Icon: SquareIcon },
  brush: { label: 'Cọ vẽ', Icon: Brush },
  polygon: { label: 'Đa giác', Icon: Pentagon },
  eraser: { label: 'Tẩy', Icon: Eraser }
}

export function WatermarkRemoveMaskEditor({
  backgroundUrl,
  busy
}: WatermarkRemoveMaskEditorProps): ReactElement {
  const ui = useWatermarkRemoveUiStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<{
    kind: 'rect' | 'brush' | 'polygon' | null
    startedAt: EditorPoint | null
    currentShape: MaskShape | null
  }>({ kind: null, startedAt: null, currentShape: null })
  const [autoDetecting, setAutoDetecting] = useState(false)
  const [polygonDraft, setPolygonDraft] = useState<EditorPoint[]>([])
  const activeKeyframe = useMemo<MaskKeyframe | null>(() => {
    return ui.keyframes.find((k) => k.id === ui.activeKeyframeId) ?? null
  }, [ui.activeKeyframeId, ui.keyframes])

  const selected = useMemo(
    () => ui.queue.find((q) => q.localId === ui.selectedLocalId) ?? null,
    [ui.queue, ui.selectedLocalId]
  )

  const displayWidth = ui.canvasWidth
  const displayHeight = ui.canvasHeight
  const aspect = displayHeight > 0 ? displayWidth / displayHeight : 16 / 9

  const toCanvasCoord = useCallback(
    (clientX: number, clientY: number): EditorPoint | null => {
      const host = containerRef.current
      if (!host) return null
      const rect = host.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      const scaleX = displayWidth / rect.width
      const scaleY = displayHeight / rect.height
      return {
        x: Math.max(0, Math.min(displayWidth, (clientX - rect.left) * scaleX)),
        y: Math.max(0, Math.min(displayHeight, (clientY - rect.top) * scaleY))
      }
    },
    [displayHeight, displayWidth]
  )

  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: MaskShape, fill: string) => {
    ctx.fillStyle = fill
    if (shape.kind === 'rect') {
      ctx.fillRect(shape.x, shape.y, shape.width, shape.height)
      return
    }
    if (shape.kind === 'brush') {
      const r = shape.radius
      for (const p of shape.points) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      return
    }
    if (shape.kind === 'polygon' && shape.points.length >= 3) {
      ctx.beginPath()
      const first = shape.points[0]!
      ctx.moveTo(first.x, first.y)
      for (let i = 1; i < shape.points.length; i++) {
        const p = shape.points[i]!
        ctx.lineTo(p.x, p.y)
      }
      ctx.closePath()
      ctx.fill()
    }
  }, [])

  const render = useCallback(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    if (canvas.width !== displayWidth) canvas.width = displayWidth
    if (canvas.height !== displayHeight) canvas.height = displayHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, displayWidth, displayHeight)
    if (!activeKeyframe) return
    for (const shape of activeKeyframe.shapes) {
      drawShape(ctx, shape, 'rgba(239,68,68,0.45)')
    }
    if (dragRef.current.currentShape) {
      drawShape(ctx, dragRef.current.currentShape, 'rgba(239,68,68,0.35)')
    }
    if (polygonDraft.length > 0) {
      ctx.strokeStyle = 'rgba(239,68,68,0.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      const first = polygonDraft[0]!
      ctx.moveTo(first.x, first.y)
      for (let i = 1; i < polygonDraft.length; i++) {
        const p = polygonDraft[i]!
        ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
      for (const p of polygonDraft) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(239,68,68,0.95)'
        ctx.fill()
      }
    }
  }, [activeKeyframe, displayHeight, displayWidth, drawShape, polygonDraft])

  useEffect(() => {
    render()
  }, [render])

  const commitShape = useCallback(
    (shape: MaskShape) => {
      if (!activeKeyframe) return
      useWatermarkRemoveUiStore.getState().pushShape(activeKeyframe.id, shape)
    },
    [activeKeyframe]
  )

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (busy || !activeKeyframe) return
    const p = toCanvasCoord(e.clientX, e.clientY)
    if (!p) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    if (ui.activeTool === 'rectangle') {
      const shape: MaskRectShape = {
        kind: 'rect',
        x: p.x,
        y: p.y,
        width: 0,
        height: 0,
        feather: ui.maskFeather
      }
      dragRef.current = { kind: 'rect', startedAt: p, currentShape: shape }
      render()
      return
    }

    if (ui.activeTool === 'brush') {
      const shape: MaskBrushShape = {
        kind: 'brush',
        points: [p],
        radius: ui.brushRadius,
        feather: ui.maskFeather
      }
      dragRef.current = { kind: 'brush', startedAt: p, currentShape: shape }
      render()
      return
    }

    if (ui.activeTool === 'polygon') {
      setPolygonDraft((pts) => [...pts, p])
      return
    }

    if (ui.activeTool === 'eraser') {
      useWatermarkRemoveUiStore.getState().popShape(activeKeyframe.id)
      render()
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragRef.current.kind) return
    const p = toCanvasCoord(e.clientX, e.clientY)
    if (!p) return
    const cur = dragRef.current.currentShape
    if (!cur) return

    if (dragRef.current.kind === 'rect' && cur.kind === 'rect' && dragRef.current.startedAt) {
      const start = dragRef.current.startedAt
      const next: MaskRectShape = {
        ...cur,
        x: Math.min(start.x, p.x),
        y: Math.min(start.y, p.y),
        width: Math.abs(p.x - start.x),
        height: Math.abs(p.y - start.y)
      }
      dragRef.current.currentShape = next
      render()
      return
    }

    if (dragRef.current.kind === 'brush' && cur.kind === 'brush') {
      const next: MaskBrushShape = { ...cur, points: [...cur.points, p] }
      dragRef.current.currentShape = next
      render()
    }
  }

  const handlePointerUp = (): void => {
    const state = dragRef.current
    dragRef.current = { kind: null, startedAt: null, currentShape: null }
    if (!state.kind || !state.currentShape) {
      render()
      return
    }
    if (state.currentShape.kind === 'rect') {
      const r = state.currentShape
      if (r.width < 2 || r.height < 2) {
        render()
        return
      }
    }
    if (state.currentShape.kind === 'brush' && state.currentShape.points.length < 2) {
      render()
      return
    }
    commitShape(state.currentShape)
    render()
  }

  const finishPolygon = useCallback(() => {
    if (polygonDraft.length < 3 || !activeKeyframe) {
      setPolygonDraft([])
      return
    }
    const shape: MaskPolygonShape = {
      kind: 'polygon',
      points: polygonDraft,
      feather: ui.maskFeather
    }
    commitShape(shape)
    setPolygonDraft([])
  }, [activeKeyframe, commitShape, polygonDraft, ui.maskFeather])

  useEffect(() => {
    if (ui.activeTool !== 'polygon') {
      setPolygonDraft([])
    }
  }, [ui.activeTool])

  const autoDetect = useCallback(async () => {
    if (!selected) {
      toast.error('Chưa chọn media.')
      return
    }
    if (!activeKeyframe) return
    setAutoDetecting(true)
    try {
      const result = await getDesktop().autoDetectWatermark({
        inputPath: selected.inputPath,
        previewTime: ui.playheadSec,
        preferAi: false,
        canvasWidth: ui.canvasWidth,
        canvasHeight: ui.canvasHeight
      })
      if (result.shapes.length === 0) {
        toast.message('Không tìm thấy watermark tự tin. Thử vẽ thủ công.')
        return
      }
      const act = useWatermarkRemoveUiStore.getState()
      act.replaceShapes(activeKeyframe.id, [...activeKeyframe.shapes, ...result.shapes])
      toast.success(`Đã thêm ${result.shapes.length} vùng đề xuất.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Auto-detect lỗi')
    } finally {
      setAutoDetecting(false)
    }
  }, [activeKeyframe, selected, ui.canvasHeight, ui.canvasWidth, ui.playheadSec])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(TOOL_META) as EditorTool[]).map((tool) => {
          const meta = TOOL_META[tool]
          const active = ui.activeTool === tool
          return (
            <Tooltip key={tool}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'outline'}
                  disabled={busy}
                  className="h-9 w-9 p-0"
                  onClick={() => ui.setActiveTool(tool)}
                  aria-label={meta.label}
                >
                  <meta.Icon className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{meta.label}</TooltipContent>
            </Tooltip>
          )
        })}

        {ui.activeTool === 'polygon' ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || polygonDraft.length < 3}
            onClick={finishPolygon}
          >
            Đóng đa giác
          </Button>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !activeKeyframe || (activeKeyframe?.shapes.length ?? 0) === 0}
                className="h-9 w-9 p-0"
                onClick={() => {
                  if (!activeKeyframe) return
                  useWatermarkRemoveUiStore.getState().popShape(activeKeyframe.id)
                }}
                aria-label="Hoàn tác"
              >
                <Undo2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Hoàn tác shape cuối</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !activeKeyframe || (activeKeyframe?.shapes.length ?? 0) === 0}
                className="h-9 w-9 p-0"
                onClick={() => {
                  if (!activeKeyframe) return
                  useWatermarkRemoveUiStore.getState().clearShapes(activeKeyframe.id)
                }}
                aria-label="Xóa toàn bộ mask"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Xóa toàn bộ mask của keyframe</TooltipContent>
          </Tooltip>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy || autoDetecting || !selected}
            onClick={() => void autoDetect()}
          >
            {autoDetecting ? (
              <Spinner className="mr-2 size-4" aria-hidden />
            ) : (
              <Sparkles className="mr-2 size-4" aria-hidden />
            )}
            Auto-detect
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label>Cỡ cọ</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{ui.brushRadius}px</span>
          </div>
          <Slider
            value={[ui.brushRadius]}
            min={4}
            max={120}
            step={1}
            disabled={busy}
            onValueChange={(v) => ui.setBrushRadius(v[0] ?? ui.brushRadius)}
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <Label>Feather</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{ui.maskFeather}px</span>
          </div>
          <Slider
            value={[ui.maskFeather]}
            min={0}
            max={32}
            step={1}
            disabled={busy}
            onValueChange={(v) => ui.setMaskFeather(v[0] ?? ui.maskFeather)}
          />
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'relative w-full overflow-hidden rounded-lg border border-border/80 bg-black/30',
          busy ? 'pointer-events-none opacity-70' : 'cursor-crosshair'
        )}
        style={{ aspectRatio: `${aspect}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {backgroundUrl ? (
          <img
            src={backgroundUrl}
            alt="Nền mask editor"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Chưa có ảnh nền để vẽ.
          </div>
        )}
        <canvas
          ref={overlayRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          width={displayWidth}
          height={displayHeight}
        />
      </div>
    </div>
  )
}
