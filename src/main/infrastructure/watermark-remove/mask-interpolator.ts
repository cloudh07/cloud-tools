import type { MaskKeyframe, MaskShape } from '@shared/domain/watermark-remove'

import { rasterizeMask } from './mask-rasterizer'

const KF_CACHE_MAX = 6
const keyframeRasterCache: Array<{ key: string; mask: Uint8Array }> = []

function getKeyframeRaster(
  kf: MaskKeyframe,
  canvasWidth: number,
  canvasHeight: number,
  width: number,
  height: number
): Uint8Array {
  const key = `${kf.id}:${kf.shapes.length}@${canvasWidth}x${canvasHeight}->${width}x${height}`
  for (let i = 0; i < keyframeRasterCache.length; i++) {
    const entry = keyframeRasterCache[i]!
    if (entry.key === key) {
      if (i > 0) {
        keyframeRasterCache.splice(i, 1)
        keyframeRasterCache.unshift(entry)
      }
      return entry.mask
    }
  }
  const mask = rasterizeMask({
    shapes: kf.shapes,
    canvasWidth,
    canvasHeight,
    width,
    height
  })
  keyframeRasterCache.unshift({ key, mask })
  if (keyframeRasterCache.length > KF_CACHE_MAX) keyframeRasterCache.length = KF_CACHE_MAX
  return mask
}

export function clearMaskRasterCache(): void {
  keyframeRasterCache.length = 0
}

export function resolveKeyframeBracket(
  keyframes: ReadonlyArray<MaskKeyframe>,
  time: number
): { left: MaskKeyframe; right: MaskKeyframe; t: number } {
  if (keyframes.length === 0) {
    throw new Error('Cannot interpolate mask: no keyframes provided')
  }
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  if (time <= sorted[0].time) return { left: sorted[0], right: sorted[0], t: 0 }
  if (time >= sorted[sorted.length - 1].time) {
    const last = sorted[sorted.length - 1]
    return { left: last, right: last, t: 0 }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].time >= time) {
      const left = sorted[i - 1]
      const right = sorted[i]
      const span = right.time - left.time
      const t = span > 0 ? (time - left.time) / span : 0
      return { left, right, t }
    }
  }
  return { left: sorted[0], right: sorted[0], t: 0 }
}

export function rasterizeInterpolatedMask(params: {
  keyframes: ReadonlyArray<MaskKeyframe>
  time: number
  canvasWidth: number
  canvasHeight: number
  width: number
  height: number
}): Uint8Array {
  const { keyframes, time, canvasWidth, canvasHeight, width, height } = params
  const { left, right, t } = resolveKeyframeBracket(keyframes, time)
  const leftMask = getKeyframeRaster(left, canvasWidth, canvasHeight, width, height)
  if (left === right || t === 0) return leftMask
  const rightMask = getKeyframeRaster(right, canvasWidth, canvasHeight, width, height)
  return blendAlpha(leftMask, rightMask, t)
}

function blendAlpha(a: Uint8Array, b: Uint8Array, t: number): Uint8Array {
  const len = a.length
  const out = new Uint8Array(len)
  const ti = Math.max(0, Math.min(1, t))
  const oneMinus = 1 - ti
  for (let i = 0; i < len; i++) {
    out[i] = Math.round(a[i] * oneMinus + b[i] * ti)
  }
  return out
}

export function maskHasAnyCoverage(mask: Uint8Array, threshold = 8): boolean {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > threshold) return true
  }
  return false
}

export function computeMaskBoundingBox(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold = 8
): { x: number; y: number; width: number; height: number } | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (mask[row + x] > threshold) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export function shapesEqual(a: MaskShape, b: MaskShape): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
