const MASK_APPLY_THRESHOLD = 8

const RING_GROW_PX = 4

const MAX_LUMA_SHIFT = 28

const UNSHARP_AMOUNT = 0.38

const LOCAL_CONTRAST_AMOUNT = 0.22

const LOCAL_MEAN_RADIUS = 2

const RING_VAR_REF = 220

type RgbaBuf = Uint8ClampedArray | Uint8Array

export type RingLuminanceStats = {
  mean: number
  variance: number
}

export function computeRingLuminanceStats(
  original: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number
): RingLuminanceStats {
  const ring = buildOuterRingMask(mask, width, height, RING_GROW_PX)
  let sum = 0
  let n = 0
  for (let i = 0; i < mask.length; i++) {
    if (ring[i]! > 0 && mask[i]! <= MASK_APPLY_THRESHOLD) {
      sum += luminanceAt(original, i * 4)
      n++
    }
  }
  if (n < 8) return { mean: 128, variance: 400 }

  const mean = sum / n
  let varSum = 0
  for (let i = 0; i < mask.length; i++) {
    if (ring[i]! > 0 && mask[i]! <= MASK_APPLY_THRESHOLD) {
      const d = luminanceAt(original, i * 4) - mean
      varSum += d * d
    }
  }
  return { mean, variance: varSum / n }
}

export function postProcessLamaInpaintRegion(
  rgba: RgbaBuf,
  original: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  ringStats: RingLuminanceStats
): void {
  const len = width * height
  if (mask.length !== len) return

  const work = new Uint8ClampedArray(rgba.length)
  work.set(rgba)

  alignRingLuminance(work, original, mask, width, height)
  applyMaskedUnsharpAndLocalContrast(work, mask, width, height, ringStats.variance)

  for (let i = 0; i < len; i++) {
    if (mask[i]! <= MASK_APPLY_THRESHOLD) continue
    const o = i * 4
    rgba[o] = work[o]!
    rgba[o + 1] = work[o + 1]!
    rgba[o + 2] = work[o + 2]!
  }
}

function alignRingLuminance(
  rgba: Uint8ClampedArray,
  original: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number
): void {
  const ring = buildOuterRingMask(mask, width, height, RING_GROW_PX)
  let sumRing = 0
  let nRing = 0
  let sumIn = 0
  let nIn = 0

  for (let i = 0; i < mask.length; i++) {
    const m = mask[i]!
    const r = ring[i]!
    const lumO = luminanceAt(original, i * 4)
    if (r > 0 && m <= MASK_APPLY_THRESHOLD) {
      sumRing += lumO
      nRing++
    }
    if (m > MASK_APPLY_THRESHOLD) {
      sumIn += luminanceAt(rgba, i * 4)
      nIn++
    }
  }
  if (nRing < 8 || nIn < 1) return

  const meanRing = sumRing / nRing
  const meanIn = sumIn / nIn
  let shift = meanRing - meanIn
  if (shift > MAX_LUMA_SHIFT) shift = MAX_LUMA_SHIFT
  if (shift < -MAX_LUMA_SHIFT) shift = -MAX_LUMA_SHIFT
  if (Math.abs(shift) < 1.5) return

  for (let i = 0; i < mask.length; i++) {
    if (mask[i]! <= MASK_APPLY_THRESHOLD) continue
    const o = i * 4
    const r = rgba[o]! + shift
    const g = rgba[o + 1]! + shift
    const b = rgba[o + 2]! + shift
    rgba[o] = clampByte(r)
    rgba[o + 1] = clampByte(g)
    rgba[o + 2] = clampByte(b)
  }
}

function dilateOnceBinary(mask: Uint8Array, width: number, height: number): Uint8Array {
  const len = mask.length
  const out = new Uint8Array(len)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (mask[idx]) {
        out[idx] = 1
        continue
      }
      let hit = 0
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        for (let dx = -1; dx <= 1 && !hit; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= width) continue
          if (mask[ny * width + nx]) hit = 1
        }
      }
      out[idx] = hit
    }
  }
  return out
}

function buildOuterRingMask(
  mask: Uint8Array,
  width: number,
  height: number,
  grow: number
): Uint8Array {
  const len = mask.length
  const core = new Uint8Array(len)
  for (let i = 0; i < len; i++) core[i] = mask[i]! > MASK_APPLY_THRESHOLD ? 1 : 0
  let dilated: Uint8Array = core
  for (let k = 0; k < grow; k++) {
    dilated = dilateOnceBinary(dilated, width, height)
  }
  const ring = new Uint8Array(len)
  for (let i = 0; i < len; i++) ring[i] = dilated[i]! && !core[i] ? 1 : 0
  return ring
}

function applyMaskedUnsharpAndLocalContrast(
  rgba: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  ringVariance: number
): void {
  const { unsharp, localContrast } = deriveAdaptiveStrengths(ringVariance)
  const len = width * height
  const lum = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    lum[i] = mask[i]! > MASK_APPLY_THRESHOLD ? luminanceAt(rgba, i * 4) : 0
  }

  const blur3 = boxBlurGray(lum, width, height, 1)
  const localMean = boxBlurGray(lum, width, height, LOCAL_MEAN_RADIUS)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (mask[i]! <= MASK_APPLY_THRESHOLD) continue
      const o = i * 4
      const L = lum[i]!
      const Lb = blur3[i]!
      const high = L - Lb
      let L2 = L + unsharp * high

      const Lm = localMean[i]!
      L2 = Lm + (L2 - Lm) * (1 + localContrast)
      L2 = clamp(L2, 0, 255)

      const scale = L > 1e-3 ? L2 / L : 1
      rgba[o] = clampByte(rgba[o]! * scale)
      rgba[o + 1] = clampByte(rgba[o + 1]! * scale)
      rgba[o + 2] = clampByte(rgba[o + 2]! * scale)
    }
  }
}

function deriveAdaptiveStrengths(ringVariance: number): { unsharp: number; localContrast: number } {
  const noisy = ringVariance / (ringVariance + RING_VAR_REF)
  const unsharpScale = Math.max(0.44, 1.0 - 0.56 * noisy)
  const contrastScale = Math.max(0.52, 1.0 - 0.48 * noisy)
  return {
    unsharp: UNSHARP_AMOUNT * unsharpScale,
    localContrast: LOCAL_CONTRAST_AMOUNT * contrastScale
  }
}

function boxBlurGray(src: Float32Array, width: number, height: number, r: number): Float32Array {
  const len = src.length
  const tmp = new Float32Array(len)
  const out = new Float32Array(len)
  const w = 2 * r + 1
  const inv = 1 / w

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0
      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.min(width - 1, Math.max(0, x + dx))
        s += src[y * width + nx]!
      }
      tmp[y * width + x] = s * inv
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let s = 0
      for (let dy = -r; dy <= r; dy++) {
        const ny = Math.min(height - 1, Math.max(0, y + dy))
        s += tmp[ny * width + x]!
      }
      out[y * width + x] = s * inv
    }
  }
  return out
}

function luminanceAt(buf: Uint8ClampedArray | Uint8Array, off: number): number {
  return buf[off]! * 0.299 + buf[off + 1]! * 0.587 + buf[off + 2]! * 0.114
}

function clampByte(v: number): number {
  if (v < 0) return 0
  if (v > 255) return 255
  return Math.round(v)
}

function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}
