const KNOWN = 0
const BAND = 1
const INSIDE = 2

export type InpaintParams = {
  width: number
  height: number
  rgba: Uint8ClampedArray | Uint8Array
  mask: Uint8Array
  maskThreshold?: number
  radius?: number
}

export function inpaintTelea(params: InpaintParams): void {
  const { width, height, rgba, mask } = params
  const threshold = params.maskThreshold ?? 128
  const radius = params.radius ?? 6
  if (width * height === 0) return

  const flag = new Uint8Array(width * height)
  for (let i = 0; i < flag.length; i++) flag[i] = mask[i] > threshold ? INSIDE : KNOWN

  const distance = computeDistanceField(flag, width, height)
  const order = orderInsidePixels(flag, distance, width, height)
  const radius2 = radius * radius

  for (let k = 0; k < order.length; k++) {
    const idx = order[k]
    const py = (idx / width) | 0
    const px = idx - py * width
    let sumR = 0
    let sumG = 0
    let sumB = 0
    let sumW = 0
    const dxT = sampleGradient(distance, width, height, px, py, 0)
    const dyT = sampleGradient(distance, width, height, px, py, 1)
    const x0 = Math.max(0, px - radius)
    const x1 = Math.min(width - 1, px + radius)
    const y0 = Math.max(0, py - radius)
    const y1 = Math.min(height - 1, py + radius)
    for (let qy = y0; qy <= y1; qy++) {
      for (let qx = x0; qx <= x1; qx++) {
        const dx = qx - px
        const dy = qy - py
        const dist2 = dx * dx + dy * dy
        if (dist2 === 0 || dist2 > radius2) continue
        const qIdx = qy * width + qx
        if (flag[qIdx] === INSIDE) continue
        const dist = Math.sqrt(dist2)
        const dirComponent = Math.abs(dx * dxT + dy * dyT) / dist
        const wDir = dirComponent + 1e-3
        const wDst = 1 / (dist2 + 1e-3)
        const wLev = 1 / (1 + Math.abs(distance[idx] - distance[qIdx]))
        const w = wDir * wDst * wLev
        const off = qIdx * 4
        sumR += rgba[off] * w
        sumG += rgba[off + 1] * w
        sumB += rgba[off + 2] * w
        sumW += w
      }
    }
    const off = idx * 4
    if (sumW > 0) {
      rgba[off] = Math.round(sumR / sumW)
      rgba[off + 1] = Math.round(sumG / sumW)
      rgba[off + 2] = Math.round(sumB / sumW)
    }
    flag[idx] = KNOWN
  }
}

function computeDistanceField(flag: Uint8Array, w: number, h: number): Float32Array {
  const dist = new Float32Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (flag[idx] !== INSIDE) {
        dist[idx] = 0
        continue
      }
      dist[idx] = Number.POSITIVE_INFINITY
      const left = x > 0 && flag[idx - 1] !== INSIDE
      const right = x < w - 1 && flag[idx + 1] !== INSIDE
      const top = y > 0 && flag[idx - w] !== INSIDE
      const bottom = y < h - 1 && flag[idx + w] !== INSIDE
      if (left || right || top || bottom) {
        dist[idx] = 1
        flag[idx] = BAND
        queue[tail++] = idx
      }
    }
  }
  while (head < tail) {
    const idx = queue[head++]
    const y = (idx / w) | 0
    const x = idx - y * w
    const baseDist = dist[idx]
    const neighbours = [
      x > 0 ? idx - 1 : -1,
      x < w - 1 ? idx + 1 : -1,
      y > 0 ? idx - w : -1,
      y < h - 1 ? idx + w : -1
    ]
    for (let i = 0; i < 4; i++) {
      const n = neighbours[i]
      if (n < 0 || flag[n] !== INSIDE) continue
      const candidate = baseDist + 1
      if (candidate < dist[n]) {
        dist[n] = candidate
        flag[n] = BAND
        queue[tail++] = n
      }
    }
  }
  for (let i = 0; i < flag.length; i++) {
    if (flag[i] === BAND) flag[i] = INSIDE
  }
  return dist
}

function orderInsidePixels(
  flag: Uint8Array,
  distance: Float32Array,
  w: number,
  h: number
): Int32Array {
  let count = 0
  let maxDist = 0
  for (let i = 0; i < flag.length; i++) {
    if (flag[i] === INSIDE) {
      count++
      if (distance[i] > maxDist) maxDist = distance[i]
    }
  }
  const result = new Int32Array(count)
  if (count === 0) return result
  const buckets = Math.min(2048, Math.max(8, Math.ceil(maxDist) + 1))
  const histogram = new Int32Array(buckets + 1)
  for (let i = 0; i < flag.length; i++) {
    if (flag[i] === INSIDE) {
      const b = Math.min(buckets, Math.floor(distance[i]))
      histogram[b]++
    }
  }
  const offsets = new Int32Array(buckets + 1)
  for (let b = 1; b <= buckets; b++) offsets[b] = offsets[b - 1] + histogram[b - 1]
  const cursor = new Int32Array(buckets + 1)
  for (let i = 0; i < flag.length; i++) {
    if (flag[i] === INSIDE) {
      const b = Math.min(buckets, Math.floor(distance[i]))
      result[offsets[b] + cursor[b]++] = i
    }
  }
  void w
  void h
  return result
}

function sampleGradient(
  distance: Float32Array,
  w: number,
  h: number,
  x: number,
  y: number,
  axis: 0 | 1
): number {
  if (axis === 0) {
    const left = distance[y * w + Math.max(0, x - 1)]
    const right = distance[y * w + Math.min(w - 1, x + 1)]
    return (right - left) * 0.5
  }
  const top = distance[Math.max(0, y - 1) * w + x]
  const bottom = distance[Math.min(h - 1, y + 1) * w + x]
  return (bottom - top) * 0.5
}
