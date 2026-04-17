import type { MaskShape } from '@shared/domain/watermark-remove'

export function rasterizeMask(params: {
  shapes: ReadonlyArray<MaskShape>
  canvasWidth: number
  canvasHeight: number
  width: number
  height: number
}): Uint8Array {
  const { shapes, canvasWidth, canvasHeight, width, height } = params
  const out = new Uint8Array(width * height)
  if (canvasWidth <= 0 || canvasHeight <= 0 || width <= 0 || height <= 0) return out
  const sx = width / canvasWidth
  const sy = height / canvasHeight
  for (const shape of shapes) {
    if (shape.kind === 'rect') {
      drawRect(out, width, height, shape.x * sx, shape.y * sy, shape.width * sx, shape.height * sy)
    } else if (shape.kind === 'brush') {
      const radius = Math.max(1, shape.radius * Math.min(sx, sy))
      drawBrushStroke(
        out,
        width,
        height,
        shape.points.map((p) => ({ x: p.x * sx, y: p.y * sy })),
        radius
      )
    } else {
      drawPolygon(
        out,
        width,
        height,
        shape.points.map((p) => ({ x: p.x * sx, y: p.y * sy }))
      )
    }
  }
  const maxFeather = shapes.reduce((m, s) => Math.max(m, s.feather), 0)
  const radiusPx = Math.round(maxFeather * Math.min(sx, sy))
  if (radiusPx > 0) return boxBlurAlpha(out, width, height, Math.min(8, radiusPx))
  return out
}

function drawRect(
  buf: Uint8Array,
  w: number,
  h: number,
  x: number,
  y: number,
  rw: number,
  rh: number
): void {
  const x0 = Math.max(0, Math.floor(x))
  const y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(w, Math.ceil(x + rw))
  const y1 = Math.min(h, Math.ceil(y + rh))
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * w
    for (let xx = x0; xx < x1; xx++) buf[row + xx] = 255
  }
}

function drawDisc(buf: Uint8Array, w: number, h: number, cx: number, cy: number, r: number): void {
  const r2 = r * r
  const x0 = Math.max(0, Math.floor(cx - r))
  const y0 = Math.max(0, Math.floor(cy - r))
  const x1 = Math.min(w, Math.ceil(cx + r))
  const y1 = Math.min(h, Math.ceil(cy + r))
  for (let yy = y0; yy < y1; yy++) {
    const dy = yy + 0.5 - cy
    const row = yy * w
    for (let xx = x0; xx < x1; xx++) {
      const dx = xx + 0.5 - cx
      if (dx * dx + dy * dy <= r2) buf[row + xx] = 255
    }
  }
}

function drawBrushStroke(
  buf: Uint8Array,
  w: number,
  h: number,
  points: ReadonlyArray<{ x: number; y: number }>,
  radius: number
): void {
  if (points.length === 0) return
  if (points.length === 1) {
    drawDisc(buf, w, h, points[0].x, points[0].y, radius)
    return
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist / Math.max(0.5, radius / 2)))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      drawDisc(buf, w, h, a.x + dx * t, a.y + dy * t, radius)
    }
  }
}

function drawPolygon(
  buf: Uint8Array,
  w: number,
  h: number,
  points: ReadonlyArray<{ x: number; y: number }>
): void {
  if (points.length < 3) return
  let minY = points[0].y
  let maxY = points[0].y
  for (const p of points) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const y0 = Math.max(0, Math.floor(minY))
  const y1 = Math.min(h, Math.ceil(maxY))
  const xs: number[] = []
  for (let yy = y0; yy < y1; yy++) {
    xs.length = 0
    const yc = yy + 0.5
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const pi = points[i]
      const pj = points[j]
      const between = pi.y > yc !== pj.y > yc
      if (between) {
        const t = (yc - pi.y) / (pj.y - pi.y)
        xs.push(pi.x + t * (pj.x - pi.x))
      }
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a - b)
    const row = yy * w
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0p = Math.max(0, Math.ceil(xs[k]))
      const x1p = Math.min(w, Math.floor(xs[k + 1]))
      for (let xx = x0p; xx < x1p; xx++) buf[row + xx] = 255
    }
  }
}

function boxBlurAlpha(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const tmp = new Uint8Array(src.length)
  const out = new Uint8Array(src.length)
  const r = Math.max(1, radius)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    const div = 2 * r + 1
    for (let x = 0; x < w; x++) {
      tmp[row + x] = Math.round(acc / div)
      const nextIn = src[row + Math.min(w - 1, x + r + 1)]
      const oldOut = src[row + Math.max(0, x - r)]
      acc += nextIn - oldOut
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    const div = 2 * r + 1
    for (let y = 0; y < h; y++) {
      out[y * w + x] = Math.round(acc / div)
      const nextIn = tmp[Math.min(h - 1, y + r + 1) * w + x]
      const oldOut = tmp[Math.max(0, y - r) * w + x]
      acc += nextIn - oldOut
    }
  }
  return out
}
