const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1]
]

const DEFAULT_MASK_THRESHOLD = 32
const DEFAULT_BAND_SAMPLES = 4
const DEFAULT_MAX_RAY_CAP = 512

export type DelogoInpaintParams = {
  rgba: Uint8ClampedArray | Uint8Array
  mask: Uint8Array
  width: number
  height: number
  maskThreshold?: number
  bandSamples?: number
  maxRay?: number
}

export function inpaintDelogo(params: DelogoInpaintParams): void {
  const { rgba, mask, width, height } = params
  const threshold = params.maskThreshold ?? DEFAULT_MASK_THRESHOLD
  const bandSamples = Math.max(1, params.bandSamples ?? DEFAULT_BAND_SAMPLES)
  const maxRay = Math.min(DEFAULT_MAX_RAY_CAP, params.maxRay ?? Math.max(width, height))
  const total = width * height
  if (total === 0) return

  const targets = collectMaskedIndices(mask, threshold)
  if (targets.length === 0) return

  const outR = new Uint8ClampedArray(targets.length)
  const outG = new Uint8ClampedArray(targets.length)
  const outB = new Uint8ClampedArray(targets.length)

  for (let t = 0; t < targets.length; t++) {
    const idx = targets[t]
    const y = (idx / width) | 0
    const x = idx - y * width

    let sumR = 0
    let sumG = 0
    let sumB = 0
    let sumW = 0

    for (let dirI = 0; dirI < DIRECTIONS.length; dirI++) {
      const [dx, dy] = DIRECTIONS[dirI]!
      const stepLen = dx !== 0 && dy !== 0 ? 1.41421356 : 1
      let picked = 0
      let d = 1
      while (picked < bandSamples && d <= maxRay) {
        const nx = x + dx * d
        const ny = y + dy * d
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) break
        const nidx = ny * width + nx
        if (mask[nidx] > threshold) {
          d++
          continue
        }
        const dist = d * stepLen
        const w = 1 / (1 + dist * dist)
        const off = nidx * 4
        sumR += rgba[off] * w
        sumG += rgba[off + 1] * w
        sumB += rgba[off + 2] * w
        sumW += w
        picked++
        d++
      }
    }

    if (sumW > 0) {
      outR[t] = Math.round(sumR / sumW)
      outG[t] = Math.round(sumG / sumW)
      outB[t] = Math.round(sumB / sumW)
    } else {
      const off = idx * 4
      outR[t] = rgba[off]
      outG[t] = rgba[off + 1]
      outB[t] = rgba[off + 2]
    }
  }

  for (let t = 0; t < targets.length; t++) {
    const off = targets[t] * 4
    rgba[off] = outR[t]
    rgba[off + 1] = outG[t]
    rgba[off + 2] = outB[t]
  }
}

function collectMaskedIndices(mask: Uint8Array, threshold: number): Int32Array {
  let count = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] > threshold) count++
  const out = new Int32Array(count)
  let cursor = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > threshold) out[cursor++] = i
  }
  return out
}
