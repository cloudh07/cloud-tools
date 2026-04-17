export function applyTemporalSmoothing(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray,
  mask: Uint8Array,
  alpha: number
): void {
  const a = Math.max(0.05, Math.min(1, alpha))
  const oneMinus = 1 - a
  const len = mask.length
  for (let i = 0; i < len; i++) {
    const m = mask[i]
    if (m === 0) continue
    const w = (m / 255) * oneMinus
    if (w <= 0) continue
    const off = i * 4
    current[off] = Math.round(current[off] * (1 - w) + previous[off] * w)
    current[off + 1] = Math.round(current[off + 1] * (1 - w) + previous[off + 1] * w)
    current[off + 2] = Math.round(current[off + 2] * (1 - w) + previous[off + 2] * w)
  }
}
