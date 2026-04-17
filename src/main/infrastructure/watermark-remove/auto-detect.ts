import sharp from 'sharp'

import {
  classifyWatermarkRemoveMediaKind,
  validateWatermarkRemoveInputPath
} from '@main/infrastructure/fs/path-validator'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  MaskShape,
  WatermarkRemoveAutoDetectRequest,
  WatermarkRemoveAutoDetectResult
} from '@shared/domain/watermark-remove'

import { acquireOnnxSession, getOrt } from './onnx-session-loader'
import { extractVideoFrameRgba } from './video-frame-pipeline'

const ANALYSIS_MAX_SIZE = 512
const U2NET_INPUT_SIZE = 320
const U2NET_MEAN: readonly [number, number, number] = [0.485, 0.456, 0.406]
const U2NET_STD: readonly [number, number, number] = [0.229, 0.224, 0.225]
const SUBJECT_SUPPRESSION_THRESHOLD = 0.55
const SUBJECT_DILATION_PX = 6
const MAX_CANDIDATES = 5

type Rect = { x: number; y: number; width: number; height: number }

export async function autoDetectWatermark(
  cfg: AppConfig,
  req: WatermarkRemoveAutoDetectRequest
): Promise<WatermarkRemoveAutoDetectResult> {
  const kind = classifyWatermarkRemoveMediaKind(req.inputPath)
  if (!kind) throw new Error(`Định dạng không hỗ trợ: ${req.inputPath}`)
  const inputPath = validateWatermarkRemoveInputPath(req.inputPath, kind)

  const frame =
    kind === 'image'
      ? await loadImageRgba(inputPath, ANALYSIS_MAX_SIZE)
      : await extractVideoFrameRgba(cfg, inputPath, req.previewTime, ANALYSIS_MAX_SIZE)

  const gray = toGrayscale(frame.rgba, frame.width, frame.height)
  const edges = sobelMagnitude(gray, frame.width, frame.height)
  const edgeMask = binarizeAdaptive(edges, frame.width, frame.height)
  morphologyClose(edgeMask, frame.width, frame.height, 2)

  const subjectMask = await tryComputeSubjectSuppressionMask(frame.rgba, frame.width, frame.height)
  const usedAi = subjectMask !== null
  if (subjectMask) suppressMaskedPixels(edgeMask, subjectMask)

  const components = findConnectedRectangles(edgeMask, frame.width, frame.height)

  const sx = req.canvasWidth / frame.width
  const sy = req.canvasHeight / frame.height
  const shapes: MaskShape[] = components.map((c) => ({
    kind: 'rect',
    x: Math.max(0, c.x * sx - 4),
    y: Math.max(0, c.y * sy - 4),
    width: Math.min(req.canvasWidth, c.width * sx + 8),
    height: Math.min(req.canvasHeight, c.height * sy + 8),
    feather: 4
  }))

  const baseConfidence = shapes.length === 0 ? 0 : 0.4 + shapes.length * 0.1
  return {
    shapes,
    usedAi,
    confidence: Math.min(1, usedAi ? baseConfidence + 0.2 : baseConfidence)
  }
}

async function tryComputeSubjectSuppressionMask(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  try {
    const session = await acquireOnnxSession('u2net-detect')
    if (!session) return null
    const ort = await getOrt()
    if (!ort) return null

    const input = prepareU2NetInput(rgba, width, height)
    const tensor = new ort.Tensor('float32', input, [1, 3, U2NET_INPUT_SIZE, U2NET_INPUT_SIZE])
    const feeds: Record<string, import('onnxruntime-node').Tensor> = {}
    feeds[session.inputNames[0]!] = tensor
    const outputs = await session.run(feeds)
    const saliency = pickSaliency(outputs)
    if (!saliency) return null

    const mask = thresholdAndResize(saliency, width, height, SUBJECT_SUPPRESSION_THRESHOLD)
    dilateBinary(mask, width, height, SUBJECT_DILATION_PX)
    return mask
  } catch {
    return null
  }
}

function prepareU2NetInput(rgba: Uint8ClampedArray, width: number, height: number): Float32Array {
  const size = U2NET_INPUT_SIZE
  const out = new Float32Array(3 * size * size)
  const plane = size * size
  const sx = width / size
  const sy = height / size
  for (let dy = 0; dy < size; dy++) {
    const srcY = Math.min(height - 1, Math.max(0, Math.floor(dy * sy)))
    for (let dx = 0; dx < size; dx++) {
      const srcX = Math.min(width - 1, Math.max(0, Math.floor(dx * sx)))
      const srcIdx = (srcY * width + srcX) * 4
      const outIdx = dy * size + dx
      const r = rgba[srcIdx] / 255
      const g = rgba[srcIdx + 1] / 255
      const b = rgba[srcIdx + 2] / 255
      out[outIdx] = (r - U2NET_MEAN[0]) / U2NET_STD[0]
      out[plane + outIdx] = (g - U2NET_MEAN[1]) / U2NET_STD[1]
      out[2 * plane + outIdx] = (b - U2NET_MEAN[2]) / U2NET_STD[2]
    }
  }
  return out
}

function pickSaliency(
  outputs: import('onnxruntime-node').InferenceSession.OnnxValueMapType
): Float32Array | null {
  let best: { data: Float32Array; area: number } | null = null
  for (const key of Object.keys(outputs)) {
    const value = outputs[key]
    if (!value || !('data' in value) || !('dims' in value)) continue
    const dims = (value as { dims: readonly number[] }).dims
    if (dims.length !== 4) continue
    const data = (value as { data: Float32Array | Uint8Array }).data
    if (!(data instanceof Float32Array)) continue
    const h = dims[2] ?? 0
    const w = dims[3] ?? 0
    const area = h * w
    if (!best || area > best.area) best = { data, area }
  }
  return best?.data ?? null
}

function thresholdAndResize(
  saliency: Float32Array,
  width: number,
  height: number,
  threshold: number
): Uint8Array {
  const size = U2NET_INPUT_SIZE
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < saliency.length; i++) {
    const v = saliency[i]!
    if (v < min) min = v
    if (v > max) max = v
  }
  const range = Math.max(1e-6, max - min)
  const out = new Uint8Array(width * height)
  const sx = size / width
  const sy = size / height
  for (let y = 0; y < height; y++) {
    const srcY = Math.min(size - 1, Math.max(0, Math.floor(y * sy)))
    for (let x = 0; x < width; x++) {
      const srcX = Math.min(size - 1, Math.max(0, Math.floor(x * sx)))
      const normalized = (saliency[srcY * size + srcX]! - min) / range
      out[y * width + x] = normalized > threshold ? 1 : 0
    }
  }
  return out
}

function suppressMaskedPixels(target: Uint8Array, suppression: Uint8Array): void {
  const len = Math.min(target.length, suppression.length)
  for (let i = 0; i < len; i++) {
    if (suppression[i]) target[i] = 0
  }
}

async function loadImageRgba(
  inputPath: string,
  maxSize: number
): Promise<{ rgba: Uint8ClampedArray; width: number; height: number }> {
  const decoded = await sharp(inputPath, { failOn: 'none' })
    .rotate()
    .resize(maxSize, maxSize, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return {
    rgba: new Uint8ClampedArray(
      decoded.data.buffer,
      decoded.data.byteOffset,
      decoded.data.byteLength
    ),
    width: decoded.info.width,
    height: decoded.info.height
  }
}

function toGrayscale(rgba: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h)
  for (let i = 0; i < out.length; i++) {
    const off = i * 4
    out[i] = (rgba[off]! * 76 + rgba[off + 1]! * 150 + rgba[off + 2]! * 29) >> 8
  }
  return out
}

function sobelMagnitude(gray: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x
      const a = gray[idx - w - 1]!
      const b = gray[idx - w]!
      const c = gray[idx - w + 1]!
      const d = gray[idx - 1]!
      const f = gray[idx + 1]!
      const g = gray[idx + w - 1]!
      const hh = gray[idx + w]!
      const i = gray[idx + w + 1]!
      const gx = -a + c - 2 * d + 2 * f - g + i
      const gy = -a - 2 * b - c + g + 2 * hh + i
      out[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy))
    }
  }
  return out
}

function binarizeAdaptive(edges: Uint8ClampedArray, w: number, h: number): Uint8Array {
  let sum = 0
  for (let i = 0; i < edges.length; i++) sum += edges[i]!
  const mean = sum / edges.length
  const threshold = Math.max(20, mean * 2.2)
  const out = new Uint8Array(w * h)
  for (let i = 0; i < edges.length; i++) out[i] = edges[i]! >= threshold ? 1 : 0
  return out
}

function morphologyClose(buf: Uint8Array, w: number, h: number, radius: number): void {
  dilateBinary(buf, w, h, radius)
  erodeBinary(buf, w, h, radius)
}

function dilateBinary(buf: Uint8Array, w: number, h: number, r: number): void {
  if (r <= 0) return
  const tmp = new Uint8Array(buf.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let any = 0
      for (let dy = -r; dy <= r && !any; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -r; dx <= r && !any; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          if (buf[ny * w + nx]) any = 1
        }
      }
      tmp[y * w + x] = any
    }
  }
  buf.set(tmp)
}

function erodeBinary(buf: Uint8Array, w: number, h: number, r: number): void {
  const tmp = new Uint8Array(buf.length)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let all = 1
      for (let dy = -r; dy <= r && all; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) {
          all = 0
          break
        }
        for (let dx = -r; dx <= r && all; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= w) {
            all = 0
            break
          }
          if (!buf[ny * w + nx]) all = 0
        }
      }
      tmp[y * w + x] = all
    }
  }
  buf.set(tmp)
}

function findConnectedRectangles(buf: Uint8Array, w: number, h: number): Rect[] {
  const labels = new Int32Array(buf.length)
  let nextLabel = 1
  const stack: number[] = []
  const rects: Rect[] = []
  const minArea = Math.round(w * h * 0.0008)
  const maxArea = Math.round(w * h * 0.18)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (!buf[idx] || labels[idx]) continue
      const label = nextLabel++
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let area = 0
      stack.push(idx)
      labels[idx] = label
      while (stack.length > 0) {
        const cur = stack.pop()!
        const cy = (cur / w) | 0
        const cx = cur - cy * w
        area++
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy
        const neighbours = [
          cx > 0 ? cur - 1 : -1,
          cx < w - 1 ? cur + 1 : -1,
          cy > 0 ? cur - w : -1,
          cy < h - 1 ? cur + w : -1
        ]
        for (let i = 0; i < 4; i++) {
          const n = neighbours[i]!
          if (n < 0 || labels[n] || !buf[n]) continue
          labels[n] = label
          stack.push(n)
        }
      }
      if (area < minArea || area > maxArea) continue
      const rectArea = (maxX - minX + 1) * (maxY - minY + 1)
      if (area / rectArea < 0.18) continue
      rects.push({ x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    }
  }
  rects.sort((a, b) => b.width * b.height - a.width * a.height)
  return rects.slice(0, MAX_CANDIDATES)
}
