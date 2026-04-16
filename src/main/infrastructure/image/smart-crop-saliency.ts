import type { CropRect, SmartCropAspectMode } from '@shared/domain/image-smart-crop'
import { aspectModeToRatio } from '@shared/domain/image-smart-crop'

export const ANALYSIS_MAX_EDGE = 384
const GRID_COLS = 40

function sobelMagnitude(grey: Uint8Array, w: number, h: number): Float32Array {
  const mag = new Float32Array(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        -grey[i - 1 - w] +
        grey[i + 1 - w] -
        2 * grey[i - 1] +
        2 * grey[i + 1] -
        grey[i - 1 + w] +
        grey[i + 1 + w]
      const gy =
        -grey[i - 1 - w] -
        2 * grey[i - w] -
        grey[i + 1 - w] +
        grey[i - 1 + w] +
        2 * grey[i + w] +
        grey[i + 1 + w]
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return mag
}

function clampRect(r: CropRect, imgW: number, imgH: number): CropRect {
  const x = Math.max(0, Math.floor(r.x))
  const y = Math.max(0, Math.floor(r.y))
  let width = Math.max(1, Math.floor(r.width))
  let height = Math.max(1, Math.floor(r.height))
  if (x >= imgW || y >= imgH) {
    return { x: 0, y: 0, width: Math.min(imgW, 4), height: Math.min(imgH, 4) }
  }
  if (x + width > imgW) width = imgW - x
  if (y + height > imgH) height = imgH - y
  if (width < 1 || height < 1) {
    return { x: 0, y: 0, width: Math.min(imgW, 4), height: Math.min(imgH, 4) }
  }
  return { x, y, width, height }
}

function applyPadding(
  r: CropRect,
  imgW: number,
  imgH: number,
  paddingRatio: number
): { rect: CropRect; padPx: number } {
  const bboxMin = Math.min(r.width, r.height)
  const cap = 0.08 * Math.min(imgW, imgH)
  let padPx = Math.max(0, paddingRatio) * bboxMin
  padPx = Math.min(padPx, cap)
  const rect = clampRect(
    {
      x: r.x - padPx,
      y: r.y - padPx,
      width: r.width + 2 * padPx,
      height: r.height + 2 * padPx
    },
    imgW,
    imgH
  )
  return { rect, padPx }
}

function expandRectToAspect(inner: CropRect, W: number, H: number, ar: number): CropRect {
  let w = inner.width
  let h = inner.height
  const cx = inner.x + inner.width / 2
  const cy = inner.y + inner.height / 2
  const cur = w / h
  if (cur > ar) {
    h = w / ar
  } else {
    w = h * ar
  }
  if (w > W) {
    w = W
    h = w / ar
  }
  if (h > H) {
    h = H
    w = h * ar
  }
  let x = Math.round(cx - w / 2)
  let y = Math.round(cy - h / 2)
  x = Math.max(0, Math.min(x, W - w))
  y = Math.max(0, Math.min(y, H - h))
  return clampRect({ x, y, width: w, height: h }, W, H)
}

function quantile(sorted: Float32Array, q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]!
  const t = pos - lo
  return sorted[lo]! * (1 - t) + sorted[hi]! * t
}

type GridBlob = {
  minX: number
  minY: number
  maxX: number
  maxY: number
  saliencySum: number
  cells: number
}

function largestSaliencyBlob(
  binary: boolean[],
  gridMeans: Float32Array,
  cols: number,
  rows: number
): GridBlob | null {
  const seen = new Uint8Array(cols * rows)
  let best: GridBlob | null = null
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const idx = gy * cols + gx
      if (!binary[idx] || seen[idx]) continue
      const stack: number[] = [idx]
      seen[idx] = 1
      let minX = gx
      let minY = gy
      let maxX = gx
      let maxY = gy
      let saliencySum = 0
      let cells = 0
      while (stack.length) {
        const cur = stack.pop()!
        cells++
        saliencySum += gridMeans[cur]!
        const cx = cur % cols
        const cy = Math.floor(cur / cols)
        minX = Math.min(minX, cx)
        minY = Math.min(minY, cy)
        maxX = Math.max(maxX, cx)
        maxY = Math.max(maxY, cy)
        const neigh = [cur - 1, cur + 1, cur - cols, cur + cols]
        for (const n of neigh) {
          if (n < 0 || n >= cols * rows) continue
          const nx = n % cols
          const ny = Math.floor(n / cols)
          if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue
          if (!binary[n] || seen[n]) continue
          seen[n] = 1
          stack.push(n)
        }
      }
      if (!best || saliencySum > best.saliencySum) {
        best = { minX, minY, maxX, maxY, saliencySum, cells }
      }
    }
  }
  return best
}

function weightedCentroidFromMag(
  mag: Float32Array,
  w: number,
  h: number
): { cx: number; cy: number } {
  let sum = 0
  let sx = 0
  let sy = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = mag[y * w + x]
      sum += v
      sx += v * (x + 0.5)
      sy += v * (y + 0.5)
    }
  }
  if (sum < 1e-6) return { cx: w / 2, cy: h / 2 }
  return { cx: sx / sum, cy: sy / sum }
}

function refineTightPixelRect(
  mag: Float32Array,
  w: number,
  h: number,
  seed: CropRect,
  quantileInRoi: number
): CropRect {
  const margin = 4
  const sx0 = Math.max(0, Math.floor(seed.x) - margin)
  const sy0 = Math.max(0, Math.floor(seed.y) - margin)
  const sx1 = Math.min(w, Math.ceil(seed.x + seed.width) + margin)
  const sy1 = Math.min(h, Math.ceil(seed.y + seed.height) + margin)
  const roi = clampRect({ x: sx0, y: sy0, width: sx1 - sx0, height: sy1 - sy0 }, w, h)

  const rx = Math.floor(roi.x)
  const ry = Math.floor(roi.y)
  const rw = Math.floor(roi.width)
  const rh = Math.floor(roi.height)
  const vals: number[] = []
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      vals.push(mag[y * w + x]!)
    }
  }
  if (vals.length === 0) return clampRect(seed, w, h)
  vals.sort((a, b) => a - b)
  const sorted = Float32Array.from(vals)
  const tryThreshold = (q: number): CropRect | null => {
    const thr = quantile(sorted, q)
    let minX = w
    let minY = h
    let maxX = 0
    let maxY = 0
    let count = 0
    for (let y = ry; y < ry + rh; y++) {
      for (let x = rx; x < rx + rw; x++) {
        if (mag[y * w + x]! >= thr) {
          count++
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
    }
    if (count < 6) return null
    return clampRect(
      {
        x: minX,
        y: minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      },
      w,
      h
    )
  }

  let tight = tryThreshold(quantileInRoi)
  if (!tight) tight = tryThreshold(0.55)
  if (!tight) tight = tryThreshold(0.4)
  if (!tight) return clampRect(seed, w, h)
  return tight
}

function tightRectFromGlobalMag(
  mag: Float32Array,
  w: number,
  h: number,
  q: number
): CropRect | null {
  const flat: number[] = []
  for (let i = 0; i < mag.length; i++) flat.push(mag[i]!)
  flat.sort((a, b) => a - b)
  const sorted = Float32Array.from(flat)
  const thr = quantile(sorted, q)
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let count = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const v = mag[y * w + x]!
      if (v >= thr) {
        count++
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (count < 16) return null
  const area = (maxX - minX + 1) * (maxY - minY + 1)
  if (area > 0.94 * w * h) return null
  return clampRect({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }, w, h)
}

function conservativeFallbackBox(
  mag: Float32Array,
  w: number,
  h: number,
  aspectMode: SmartCropAspectMode
): { rect: CropRect; detail: string } {
  const globalTight = tightRectFromGlobalMag(mag, w, h, 0.82)
  if (globalTight) {
    return {
      rect: globalTight,
      detail:
        'Low blob confidence - tight box from global high-gradient band (avoids oversized center window).'
    }
  }
  const { cx, cy } = weightedCentroidFromMag(mag, w, h)
  const frac = 0.58
  const side = Math.min(w, h) * frac
  let rw = side
  let rh = side
  const ar = aspectModeToRatio(aspectMode)
  if (ar != null) {
    if (rw / rh > ar) rh = rw / ar
    else rw = rh * ar
  }
  const x = Math.round(cx - rw / 2)
  const y = Math.round(cy - rh / 2)
  const rect = clampRect({ x, y, width: rw, height: rh }, w, h)
  return {
    rect,
    detail:
      'Low saliency separation - conservative window around energy-weighted centroid (reduced default span).'
  }
}

function scaleAnalRectToSource(
  rectAnal: CropRect,
  sW: number,
  sH: number,
  w: number,
  h: number
): CropRect {
  const sx = sW / w
  const sy = sH / h
  return clampRect(
    {
      x: Math.round(rectAnal.x * sx),
      y: Math.round(rectAnal.y * sy),
      width: Math.round(rectAnal.width * sx),
      height: Math.round(rectAnal.height * sy)
    },
    sW,
    sH
  )
}

export type SaliencyCropParams = {
  grey: Uint8Array
  analysisWidth: number
  analysisHeight: number
  sourceWidth: number
  sourceHeight: number
  sensitivity: number
  paddingRatio: number
  aspectMode: SmartCropAspectMode
}

export type SaliencyCropComputation = {
  cropRectSource: CropRect
  tightSaliencyRectSource: CropRect
  paddingAppliedPx: number
  analysisSize: { width: number; height: number }
  confidence: number
  fallbackUsed: boolean
  detail: string
}

function tightRectFromAlpha(
  alpha: Uint8Array,
  w: number,
  h: number,
  alphaThreshold: number
): { rect: CropRect; opaqueRatio: number } | null {
  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  let count = 0
  const thr = Math.max(1, Math.min(254, Math.floor(alphaThreshold)))
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      if (alpha[row + x]! >= thr) {
        count++
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (count < 16 || maxX < 0 || maxY < 0) return null
  const rect = clampRect(
    { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
    w,
    h
  )
  return { rect, opaqueRatio: count / (w * h) }
}

export function computeSaliencyCropRect(params: SaliencyCropParams): SaliencyCropComputation {
  const { grey, analysisWidth: w, analysisHeight: h, sourceWidth: sW, sourceHeight: sH } = params
  const mag = sobelMagnitude(grey, w, h)

  const flat: number[] = []
  for (let i = 0; i < mag.length; i++) flat.push(mag[i]!)
  flat.sort((a, b) => a - b)
  const sorted = Float32Array.from(flat)
  const pLow = 0.32 + Math.max(0, Math.min(1, params.sensitivity)) * 0.48
  const maxV = sorted[sorted.length - 1] ?? 0
  const minV = sorted[0] ?? 0
  const confidence = maxV > 1e-6 ? Math.min(1, (maxV - minV) / (maxV + 1e-3)) : 0

  const rows = Math.max(4, Math.round((GRID_COLS * h) / w))
  const cols = GRID_COLS
  const cellW = w / cols
  const cellH = h / rows
  const gridMeans = new Float32Array(cols * rows)
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      let sum = 0
      let n = 0
      const x0 = Math.floor(gx * cellW)
      const y0 = Math.floor(gy * cellH)
      const x1 = Math.min(w, Math.ceil((gx + 1) * cellW))
      const y1 = Math.min(h, Math.ceil((gy + 1) * cellH))
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          sum += mag[y * w + x]!
          n++
        }
      }
      gridMeans[gy * cols + gx] = n > 0 ? sum / n : 0
    }
  }

  const gmFlat = Array.from(gridMeans).sort((a, b) => a - b)
  const gmSorted = Float32Array.from(gmFlat)
  const gTh = quantile(gmSorted, pLow)
  const binary: boolean[] = []
  for (let i = 0; i < gridMeans.length; i++) {
    binary.push(gridMeans[i]! >= gTh)
  }

  const blob = largestSaliencyBlob(binary, gridMeans, cols, rows)
  const totalCells = cols * rows
  const minBlobCells = Math.max(3, Math.floor(totalCells * 0.012))

  let rectCoarseAnal: CropRect
  let fallbackUsed = false
  let detail = 'Primary saliency: weighted largest blob + pixel-tight refine (Sobel).'

  if (!blob || blob.cells < minBlobCells || blob.saliencySum < 1e-6 || confidence < 0.1) {
    const fb = conservativeFallbackBox(mag, w, h, params.aspectMode)
    rectCoarseAnal = fb.rect
    fallbackUsed = true
    detail = fb.detail
  } else {
    const px0 = Math.floor(blob.minX * cellW)
    const py0 = Math.floor(blob.minY * cellH)
    const px1 = Math.min(w, Math.ceil((blob.maxX + 1) * cellW))
    const py1 = Math.min(h, Math.ceil((blob.maxY + 1) * cellH))
    rectCoarseAnal = clampRect({ x: px0, y: py0, width: px1 - px0, height: py1 - py0 }, w, h)
  }

  const qRefine = 0.62 + (1 - Math.max(0, Math.min(1, params.sensitivity))) * 0.18
  const rectTightAnal = refineTightPixelRect(mag, w, h, rectCoarseAnal, qRefine)

  let tightSource = scaleAnalRectToSource(rectTightAnal, sW, sH, w, h)
  tightSource = clampRect(tightSource, sW, sH)

  const padded = applyPadding(tightSource, sW, sH, params.paddingRatio)
  let sourceRect = padded.rect
  const paddingAppliedPx = padded.padPx

  const ar = aspectModeToRatio(params.aspectMode)
  if (ar != null) {
    sourceRect = expandRectToAspect(sourceRect, sW, sH, ar)
  }

  sourceRect = clampRect(sourceRect, sW, sH)

  const tw = tightSource.width
  const th = tightSource.height
  const fw = sourceRect.width
  const fh = sourceRect.height
  const detailLine = `${detail} | tight ${Math.round(tw)}×${Math.round(th)} px; pad ±${Math.round(paddingAppliedPx)} px; final ${Math.round(fw)}×${Math.round(fh)} px; conf ${(confidence * 100).toFixed(0)}%.`

  return {
    cropRectSource: sourceRect,
    tightSaliencyRectSource: tightSource,
    paddingAppliedPx,
    analysisSize: { width: w, height: h },
    confidence,
    fallbackUsed,
    detail: detailLine
  }
}

export function computeAlphaMaskCropRect(params: {
  alpha: Uint8Array
  analysisWidth: number
  analysisHeight: number
  sourceWidth: number
  sourceHeight: number
  paddingRatio: number
  aspectMode: SmartCropAspectMode
  alphaThreshold?: number
}): SaliencyCropComputation | null {
  const { alpha, analysisWidth: w, analysisHeight: h, sourceWidth: sW, sourceHeight: sH } = params
  const alphaBox = tightRectFromAlpha(alpha, w, h, params.alphaThreshold ?? 10)
  if (!alphaBox) return null
  const areaRatio = (alphaBox.rect.width * alphaBox.rect.height) / (w * h)
  if (areaRatio > 0.92 || alphaBox.opaqueRatio > 0.96) return null

  const tightSource = scaleAnalRectToSource(alphaBox.rect, sW, sH, w, h)
  const padded = applyPadding(tightSource, sW, sH, params.paddingRatio)
  let sourceRect = padded.rect
  const ar = aspectModeToRatio(params.aspectMode)
  if (ar != null) sourceRect = expandRectToAspect(sourceRect, sW, sH, ar)
  sourceRect = clampRect(sourceRect, sW, sH)

  const detail = `Alpha-mask bbox (thr=${params.alphaThreshold ?? 10}) | tight ${Math.round(tightSource.width)}×${Math.round(tightSource.height)} px; pad ±${Math.round(padded.padPx)} px; final ${Math.round(sourceRect.width)}×${Math.round(sourceRect.height)} px.`
  return {
    cropRectSource: sourceRect,
    tightSaliencyRectSource: tightSource,
    paddingAppliedPx: padded.padPx,
    analysisSize: { width: w, height: h },
    confidence: 1,
    fallbackUsed: false,
    detail
  }
}
