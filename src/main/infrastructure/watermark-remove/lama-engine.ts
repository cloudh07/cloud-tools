import sharp from 'sharp'

import type { MaskKeyframe } from '@shared/domain/watermark-remove'

import { inpaintImageClassical, inpaintFrameAsync } from './classical-engine'
import { blendLamaWithClassicalStructural } from './lama-hybrid-classical'
import { computeRingLuminanceStats, postProcessLamaInpaintRegion } from './lama-inpaint-post'
import { maskHasAnyCoverage, rasterizeInterpolatedMask } from './mask-interpolator'
import { acquireOnnxSession, getOrt } from './onnx-session-loader'

const MASK_HARD_THRESHOLD = 32
const BBOX_CONTEXT_PADDING = 48
const LAMA_MULTIPLE = 8
const LAMA_TILE_LIMIT = 1024

export type LamaInpaintParams = {
  inputPath: string
  canvasWidth: number
  canvasHeight: number
  keyframes: ReadonlyArray<MaskKeyframe>
  time: number
}

export type LamaInpaintResult = {
  rgba: Uint8ClampedArray
  width: number
  height: number
  usedAi: boolean
}

export async function inpaintImageWithLama(params: LamaInpaintParams): Promise<LamaInpaintResult> {
  const image = sharp(params.inputPath, { failOn: 'none' }).rotate()
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width === 0 || height === 0) throw new Error('Invalid image dimensions')

  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const rgba = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  const mask = rasterizeInterpolatedMask({
    keyframes: params.keyframes,
    time: params.time,
    canvasWidth: params.canvasWidth,
    canvasHeight: params.canvasHeight,
    width: info.width,
    height: info.height
  })

  if (!maskHasAnyCoverage(mask, MASK_HARD_THRESHOLD)) {
    return { rgba, width: info.width, height: info.height, usedAi: false }
  }

  const usedAi = await tryLamaInpaintInPlace(rgba, mask, info.width, info.height)
  if (usedAi) {
    return { rgba, width: info.width, height: info.height, usedAi: true }
  }

  const fallback = await inpaintImageClassical(params)
  return { ...fallback, usedAi: false }
}

export async function inpaintFrameWithLama(
  rgba: Uint8ClampedArray | Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number
): Promise<{ usedAi: boolean }> {
  const usedAi = await tryLamaInpaintInPlace(rgba, mask, width, height)
  if (!usedAi) await inpaintFrameAsync(rgba, mask, width, height)
  return { usedAi }
}

async function tryLamaInpaintInPlace(
  rgba: Uint8ClampedArray | Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number
): Promise<boolean> {
  const bbox = computeMaskBbox(mask, width, height, MASK_HARD_THRESHOLD)
  if (!bbox) return false
  const padded = padBbox(bbox, BBOX_CONTEXT_PADDING, width, height)

  try {
    const session = await acquireOnnxSession('lama-inpaint')
    if (!session) return false
    const ort = await getOrt()
    if (!ort) return false

    const original = new Uint8ClampedArray(rgba.length)
    original.set(rgba)

    const accR = new Float32Array(width * height)
    const accG = new Float32Array(width * height)
    const accB = new Float32Array(width * height)
    const accW = new Float32Array(width * height)

    const tiles = planTiles(padded, LAMA_TILE_LIMIT, BBOX_CONTEXT_PADDING)
    for (const tile of tiles) {
      await runLamaTile(session, ort, accR, accG, accB, accW, original, mask, width, height, tile)
    }
    flushLamaTileAccumulation(rgba, accR, accG, accB, accW, mask, MASK_HARD_THRESHOLD)
    const ringStats = computeRingLuminanceStats(original, mask, width, height)
    postProcessLamaInpaintRegion(rgba, original, mask, width, height, ringStats)
    blendLamaWithClassicalStructural(rgba, original, mask, width, height, ringStats)
    blendWithOriginal(rgba, original, mask)
    return true
  } catch {
    return false
  }
}

function blendWithOriginal(
  result: Uint8ClampedArray | Uint8Array,
  original: Uint8ClampedArray,
  mask: Uint8Array
): void {
  for (let i = 0; i < mask.length; i++) {
    const m = mask[i]!
    const off = i * 4
    if (m === 0) {
      result[off] = original[off]!
      result[off + 1] = original[off + 1]!
      result[off + 2] = original[off + 2]!
      continue
    }
    if (m >= 255) continue
    const a = m / 255
    const inv = 1 - a
    result[off] = Math.round(result[off]! * a + original[off]! * inv)
    result[off + 1] = Math.round(result[off + 1]! * a + original[off + 1]! * inv)
    result[off + 2] = Math.round(result[off + 2]! * a + original[off + 2]! * inv)
  }
}

type Box = { x: number; y: number; width: number; height: number }

function computeMaskBbox(
  mask: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Box | null {
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

function padBbox(bbox: Box, pad: number, width: number, height: number): Box {
  const x = Math.max(0, bbox.x - pad)
  const y = Math.max(0, bbox.y - pad)
  const right = Math.min(width, bbox.x + bbox.width + pad)
  const bottom = Math.min(height, bbox.y + bbox.height + pad)
  return { x, y, width: right - x, height: bottom - y }
}

function planTiles(region: Box, maxDim: number, overlap: number): Box[] {
  if (region.width <= maxDim && region.height <= maxDim) return [region]
  const stride = Math.max(1, maxDim - overlap)
  const tiles: Box[] = []
  for (let y = region.y; y < region.y + region.height; y += stride) {
    for (let x = region.x; x < region.x + region.width; x += stride) {
      const tileW = Math.min(maxDim, region.x + region.width - x)
      const tileH = Math.min(maxDim, region.y + region.height - y)
      tiles.push({ x, y, width: tileW, height: tileH })
      if (x + tileW >= region.x + region.width) break
    }
    if (y + Math.min(maxDim, region.y + region.height - y) >= region.y + region.height) break
  }
  return tiles
}

/** LaMa input uses unmodified source pixels; tile outputs are merged with distance weights to reduce seams. */
async function runLamaTile(
  session: import('onnxruntime-node').InferenceSession,
  ort: typeof import('onnxruntime-node'),
  accR: Float32Array,
  accG: Float32Array,
  accB: Float32Array,
  accW: Float32Array,
  sourceRgba: Uint8ClampedArray | Uint8Array,
  mask: Uint8Array,
  width: number,
  height: number,
  tile: Box
): Promise<void> {
  const target = roundUpToMultiple(Math.max(tile.width, tile.height), LAMA_MULTIPLE)
  const infW = Math.min(LAMA_TILE_LIMIT, Math.max(LAMA_MULTIPLE, target))
  const infH = infW
  const rgbTile = extractRgbResized(sourceRgba, width, height, tile, infW, infH)
  const maskTile = extractMaskResized(mask, width, height, tile, infW, infH, MASK_HARD_THRESHOLD)

  const feeds = buildLamaFeeds(ort, session.inputNames, rgbTile, maskTile, infW, infH)
  const outputs = await session.run(feeds)
  const outputTensor = pickOutputTensor(outputs)
  if (!outputTensor) throw new Error('LaMa output tensor missing')

  const outData = outputTensor.data as Float32Array
  accumulateTileOutput(
    outData,
    infW,
    infH,
    accR,
    accG,
    accB,
    accW,
    width,
    height,
    tile,
    mask,
    MASK_HARD_THRESHOLD
  )
}

function buildLamaFeeds(
  ort: typeof import('onnxruntime-node'),
  inputNames: readonly string[],
  rgb: Float32Array,
  mask: Float32Array,
  w: number,
  h: number
): Record<string, import('onnxruntime-node').Tensor> {
  const feeds: Record<string, import('onnxruntime-node').Tensor> = {}
  if (inputNames.length === 1) {
    const concat = concatRgbMask(rgb, mask, w, h)
    feeds[inputNames[0]!] = new ort.Tensor('float32', concat, [1, 4, h, w])
    return feeds
  }
  const imageTensor = new ort.Tensor('float32', rgb, [1, 3, h, w])
  const maskTensor = new ort.Tensor('float32', mask, [1, 1, h, w])
  const imageName = inputNames.find((n) => /image|input|x/i.test(n)) ?? inputNames[0]!
  const maskName =
    inputNames.find((n) => /mask/i.test(n)) ??
    inputNames.find((n) => n !== imageName) ??
    inputNames[0]!
  feeds[imageName] = imageTensor
  feeds[maskName] = maskTensor
  return feeds
}

function concatRgbMask(rgb: Float32Array, mask: Float32Array, w: number, h: number): Float32Array {
  const plane = w * h
  const out = new Float32Array(4 * plane)
  out.set(rgb, 0)
  out.set(mask, 3 * plane)
  return out
}

function pickOutputTensor(
  outputs: import('onnxruntime-node').InferenceSession.OnnxValueMapType
): import('onnxruntime-node').Tensor | null {
  for (const key of Object.keys(outputs)) {
    const value = outputs[key]
    if (value && 'data' in value && 'dims' in value) {
      return value as import('onnxruntime-node').Tensor
    }
  }
  return null
}

function roundUpToMultiple(value: number, multiple: number): number {
  return Math.ceil(value / multiple) * multiple
}

function extractRgbResized(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  tile: Box,
  targetW: number,
  targetH: number
): Float32Array {
  const out = new Float32Array(3 * targetH * targetW)
  const sx = tile.width / targetW
  const sy = tile.height / targetH
  const planeSize = targetH * targetW
  for (let dy = 0; dy < targetH; dy++) {
    const srcYf = tile.y + dy * sy
    const srcY = Math.min(height - 1, Math.max(0, Math.floor(srcYf)))
    for (let dx = 0; dx < targetW; dx++) {
      const srcXf = tile.x + dx * sx
      const srcX = Math.min(width - 1, Math.max(0, Math.floor(srcXf)))
      const srcIdx = (srcY * width + srcX) * 4
      const dstIdx = dy * targetW + dx
      out[dstIdx] = rgba[srcIdx] / 255
      out[planeSize + dstIdx] = rgba[srcIdx + 1] / 255
      out[2 * planeSize + dstIdx] = rgba[srcIdx + 2] / 255
    }
  }
  return out
}

function extractMaskResized(
  mask: Uint8Array,
  width: number,
  height: number,
  tile: Box,
  targetW: number,
  targetH: number,
  threshold: number
): Float32Array {
  const out = new Float32Array(targetH * targetW)
  const sx = tile.width / targetW
  const sy = tile.height / targetH
  for (let dy = 0; dy < targetH; dy++) {
    const srcYf = tile.y + dy * sy
    const srcY = Math.min(height - 1, Math.max(0, Math.floor(srcYf)))
    for (let dx = 0; dx < targetW; dx++) {
      const srcXf = tile.x + dx * sx
      const srcX = Math.min(width - 1, Math.max(0, Math.floor(srcXf)))
      out[dy * targetW + dx] = mask[srcY * width + srcX] > threshold ? 1 : 0
    }
  }
  return out
}

function accumulateTileOutput(
  output: Float32Array,
  infW: number,
  infH: number,
  accR: Float32Array,
  accG: Float32Array,
  accB: Float32Array,
  accW: Float32Array,
  width: number,
  height: number,
  tile: Box,
  mask: Uint8Array,
  threshold: number
): void {
  const planeSize = infH * infW
  const sx = infW / tile.width
  const sy = infH / tile.height
  for (let ty = 0; ty < tile.height; ty++) {
    const dstY = tile.y + ty
    if (dstY < 0 || dstY >= height) continue
    const srcYf = ty * sy
    const srcY = Math.min(infH - 1, Math.max(0, Math.floor(srcYf)))
    for (let tx = 0; tx < tile.width; tx++) {
      const dstX = tile.x + tx
      if (dstX < 0 || dstX >= width) continue
      const p = dstY * width + dstX
      if (mask[p]! <= threshold) continue
      const srcXf = tx * sx
      const srcX = Math.min(infW - 1, Math.max(0, Math.floor(srcXf)))
      const srcIdx = srcY * infW + srcX
      const r = modelOutputToLinearRgb(output[srcIdx]!)
      const g = modelOutputToLinearRgb(output[planeSize + srcIdx]!)
      const b = modelOutputToLinearRgb(output[2 * planeSize + srcIdx]!)
      const wgt = tileInteriorBlendWeight(tx, ty, tile.width, tile.height)
      accR[p] += r * wgt
      accG[p] += g * wgt
      accB[p] += b * wgt
      accW[p] += wgt
    }
  }
}

function tileInteriorBlendWeight(tx: number, ty: number, tw: number, th: number): number {
  if (tw <= 1 || th <= 1) return 1
  const dx = Math.min(tx, tw - 1 - tx)
  const dy = Math.min(ty, th - 1 - ty)
  const edgeDist = Math.min(dx, dy)
  const half = Math.max(1, Math.min(tw, th) / 2 - 0.5)
  const t = Math.min(1, edgeDist / half)
  return 0.06 + 0.94 * t * t
}

function modelOutputToLinearRgb(v: number): number {
  const scaled = v * 255
  if (scaled < 0) return 0
  if (scaled > 255) return 255
  return scaled
}

function flushLamaTileAccumulation(
  rgba: Uint8ClampedArray | Uint8Array,
  accR: Float32Array,
  accG: Float32Array,
  accB: Float32Array,
  accW: Float32Array,
  mask: Uint8Array,
  threshold: number
): void {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]! <= threshold) continue
    const w = accW[i]!
    if (w <= 1e-6) continue
    const o = i * 4
    rgba[o] = Math.round(accR[i]! / w)
    rgba[o + 1] = Math.round(accG[i]! / w)
    rgba[o + 2] = Math.round(accB[i]! / w)
  }
}
