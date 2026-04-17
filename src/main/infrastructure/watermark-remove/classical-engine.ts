import sharp from 'sharp'

import type { MaskKeyframe } from '@shared/domain/watermark-remove'

import { inpaintDelogo } from './delogo-inpaint'
import { maskHasAnyCoverage, rasterizeInterpolatedMask } from './mask-interpolator'

const INPAINT_MASK_THRESHOLD = 32
const COVERAGE_CHECK_THRESHOLD = 16

export type ClassicalInpaintImageParams = {
  inputPath: string
  canvasWidth: number
  canvasHeight: number
  keyframes: ReadonlyArray<MaskKeyframe>
  time: number
}

export type ClassicalInpaintImageResult = {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

export async function inpaintImageClassical(
  params: ClassicalInpaintImageParams
): Promise<ClassicalInpaintImageResult> {
  const { inputPath, canvasWidth, canvasHeight, keyframes, time } = params
  const image = sharp(inputPath, { failOn: 'none' }).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width === 0 || height === 0) throw new Error('Invalid image dimensions')

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const originalRgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  const workRgba = new Uint8ClampedArray(originalRgba)

  const mask = rasterizeInterpolatedMask({
    keyframes,
    time,
    canvasWidth,
    canvasHeight,
    width: info.width,
    height: info.height
  })
  if (!maskHasAnyCoverage(mask, COVERAGE_CHECK_THRESHOLD)) {
    return { rgba: workRgba, width: info.width, height: info.height }
  }

  inpaintDelogo({
    rgba: workRgba,
    mask,
    width: info.width,
    height: info.height,
    maskThreshold: INPAINT_MASK_THRESHOLD
  })
  compositeInpaint(workRgba, originalRgba, mask)

  return { rgba: workRgba, width: info.width, height: info.height }
}

export async function inpaintFrameAsync(
  rgba: Uint8ClampedArray | Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number
): Promise<void> {
  const original = new Uint8ClampedArray(rgba.length)
  original.set(rgba)
  inpaintDelogo({ rgba, mask, width, height, maskThreshold: INPAINT_MASK_THRESHOLD })
  compositeInpaint(rgba, original, mask)
}

function compositeInpaint(
  inpainted: Uint8ClampedArray | Uint8Array,
  original: Uint8ClampedArray | Uint8Array,
  mask: Uint8Array
): void {
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i]
    const off = i * 4
    if (m === 0) {
      inpainted[off] = original[off]
      inpainted[off + 1] = original[off + 1]
      inpainted[off + 2] = original[off + 2]
      continue
    }
    if (m >= 255) continue
    const a = m / 255
    const inv = 1 - a
    inpainted[off] = Math.round(inpainted[off] * a + original[off] * inv)
    inpainted[off + 1] = Math.round(inpainted[off + 1] * a + original[off + 1] * inv)
    inpainted[off + 2] = Math.round(inpainted[off + 2] * a + original[off + 2] * inv)
  }
}
