import { inpaintDelogo } from './delogo-inpaint'
import type { RingLuminanceStats } from './lama-inpaint-post'

const MASK_INPAINT_THRESHOLD = 32

const RING_VARIANCE_HYBRID_SKIP = 780

const MAX_STRUCTURAL_CLASSICAL = 0.34

const STRUCT_GRAD_LOW = 22
const STRUCT_GRAD_HIGH = 95

type RgbaBuf = Uint8ClampedArray | Uint8Array

export function blendLamaWithClassicalStructural(
  lamaRgba: RgbaBuf,
  original: Uint8ClampedArray,
  mask: Uint8Array,
  width: number,
  height: number,
  ringStats: RingLuminanceStats
): void {
  if (ringStats.variance > RING_VARIANCE_HYBRID_SKIP) return

  const classical = new Uint8ClampedArray(original.length)
  classical.set(original)
  inpaintDelogo({
    rgba: classical,
    mask,
    width,
    height,
    maskThreshold: MASK_INPAINT_THRESHOLD
  })

  const gray = buildLuminanceGray(classical, width, height)
  const { gx, gy } = sobelGradient(gray, width, height)

  const noiseGate = 1 - Math.min(1, ringStats.variance / RING_VARIANCE_HYBRID_SKIP)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      if (mask[i]! <= MASK_INPAINT_THRESHOLD) continue

      const mag = Math.hypot(gx[i]!, gy[i]!)
      let t = smoothstep(STRUCT_GRAD_LOW, STRUCT_GRAD_HIGH, mag)
      t *= noiseGate * MAX_STRUCTURAL_CLASSICAL

      if (t < 1e-4) continue

      const o = i * 4
      lamaRgba[o] = Math.round(lamaRgba[o]! * (1 - t) + classical[o]! * t)
      lamaRgba[o + 1] = Math.round(lamaRgba[o + 1]! * (1 - t) + classical[o + 1]! * t)
      lamaRgba[o + 2] = Math.round(lamaRgba[o + 2]! * (1 - t) + classical[o + 2]! * t)
    }
  }
}

function buildLuminanceGray(buf: Uint8ClampedArray, width: number, height: number): Float32Array {
  const n = width * height
  const g = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 4
    g[i] = buf[o]! * 0.299 + buf[o + 1]! * 0.587 + buf[o + 2]! * 0.114
  }
  return g
}

function sobelGradient(
  gray: Float32Array,
  width: number,
  height: number
): { gx: Float32Array; gy: Float32Array } {
  const gx = new Float32Array(gray.length)
  const gy = new Float32Array(gray.length)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const a00 = gray[i - width - 1]!
      const a01 = gray[i - width]!
      const a02 = gray[i - width + 1]!
      const a10 = gray[i - 1]!
      const a12 = gray[i + 1]!
      const a20 = gray[i + width - 1]!
      const a21 = gray[i + width]!
      const a22 = gray[i + width + 1]!
      gx[i] = -a00 + a02 - 2 * a10 + 2 * a12 - a20 + a22
      gy[i] = -a00 - 2 * a01 - a02 + a20 + 2 * a21 + a22
    }
  }
  return { gx, gy }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0 + 1e-6)))
  return t * t * (3 - 2 * t)
}
