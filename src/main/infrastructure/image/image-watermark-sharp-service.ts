import { existsSync, statSync } from 'fs'
import { extname, resolve } from 'path'

import sharp, { type Metadata, type OverlayOptions } from 'sharp'

import {
  validateImageWatermarkOutputPath,
  validateSmartCropImageInputPath
} from '@main/infrastructure/fs/path-validator'
import type { ImageFormatProbeResult } from '@shared/domain/image-format-convert'
import type {
  ImageWatermarkPreviewRequest,
  ImageWatermarkPreviewResult,
  ImageWatermarkSource,
  ImageWatermarkSpec,
  WatermarkAnchorPosition,
  WatermarkOutputFormat
} from '@shared/domain/image-watermark'

const LOGO_INPUT_EXT = new Set(['.png', '.svg', '.webp'])
const SOURCE_EXT_TO_FORMAT: Record<string, Exclude<WatermarkOutputFormat, 'keep'>> = {
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.png': 'png',
  '.webp': 'webp'
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function throwProbeError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e)
  if (/unsupported|unsupported image|input file|Vips|heif|svg/i.test(msg)) {
    throw new Error(
      `Không đọc được ảnh (Sharp/libvips): ${msg}. Định dạng có thể chưa được build hỗ trợ trên máy này.`
    )
  }
  throw new Error(`Không đọc được metadata ảnh: ${msg}`)
}

export async function probeImageForWatermark(inputPath: string): Promise<ImageFormatProbeResult> {
  const abs = validateSmartCropImageInputPath(inputPath)
  let st: ReturnType<typeof statSync>
  try {
    st = statSync(abs)
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : 'Không đọc được kích thước tệp')
  }

  try {
    const meta = await sharp(abs, { failOn: 'none' }).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    const hasAlpha = meta.hasAlpha === true || meta.channels === 4

    return {
      width,
      height,
      format: meta.format ?? 'unknown',
      orientation: meta.orientation ?? null,
      hasAlpha: Boolean(hasAlpha),
      fileSizeBytes: st.size,
      pages: meta.pages != null && meta.pages > 1 ? meta.pages : null,
      hint: null
    }
  } catch (e) {
    throwProbeError(e)
  }
}

function escapeSvgText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildSvgFontFamily(raw: string): string {
  const trimmed = (raw || '').trim()
  if (!trimmed) return escapeSvgText("'Arial', sans-serif")
  if (trimmed.includes(',')) return escapeSvgText(trimmed)
  const sanitized = trimmed.replace(/['"\\]/g, '')
  return escapeSvgText(`'${sanitized}', sans-serif`)
}

function escapePangoMarkup(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

type TextBox = { width: number; height: number }

async function measureTextBoxWithPango(
  src: Extract<ImageWatermarkSource, { kind: 'text' }>,
  fontSize: number
): Promise<TextBox | null> {
  try {
    const family = (src.fontFamily || 'sans-serif').trim() || 'sans-serif'
    const weight = Math.max(100, Math.min(900, Math.round(src.fontWeight || 400)))
    const markup = `<span weight="${weight}">${escapePangoMarkup(src.text)}</span>`
    const meta = await sharp({
      text: {
        text: markup,
        font: `${family} ${fontSize}`,
        rgba: true,
        dpi: 72
      }
    }).metadata()
    const width = meta.width ?? 0
    const height = meta.height ?? 0
    if (width <= 0 || height <= 0) return null
    return { width, height }
  } catch {
    return null
  }
}

function estimateTextBoxHeuristic(
  src: Extract<ImageWatermarkSource, { kind: 'text' }>,
  fontSize: number,
  fontWeight: number
): TextBox {
  const weightFactor = 0.62 + (fontWeight - 400) / 1200
  const charWidth = fontSize * clamp(weightFactor, 0.62, 0.95)
  const width = Math.ceil(Math.max(1, src.text.length) * charWidth)
  const height = Math.ceil(fontSize * 1.4)
  return { width, height }
}

async function renderTextWatermarkSvg(
  src: Extract<ImageWatermarkSource, { kind: 'text' }>,
  baseW: number,
  baseH: number
): Promise<Buffer> {
  const minBase = Math.max(1, Math.min(baseW, baseH))
  const fontSize = Math.max(8, Math.round((src.fontSizePercent / 100) * minBase))
  const fontWeight = Math.max(100, Math.min(900, Math.round(src.fontWeight || 600)))
  const strokeWidth = src.strokeColorHex && src.strokeWidthPx > 0 ? src.strokeWidthPx : 0
  const strokePad = Math.ceil(strokeWidth / 2)
  const padding = Math.round(fontSize * 0.3) + strokePad

  const fontFamily = buildSvgFontFamily(src.fontFamily)
  const fill = escapeSvgText(src.colorHex || '#ffffff')
  const text = escapeSvgText(src.text)

  const measured =
    (await measureTextBoxWithPango(src, fontSize)) ??
    estimateTextBoxHeuristic(src, fontSize, fontWeight)

  const width = Math.max(1, measured.width + padding * 2)
  const height = Math.max(1, measured.height + padding * 2)
  const baselineY = padding + Math.round(measured.height * 0.8)

  const strokeAttrs =
    strokeWidth > 0
      ? `stroke="${escapeSvgText(src.strokeColorHex!)}" stroke-width="${strokeWidth}" paint-order="stroke"`
      : ''

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" overflow="visible">
  <text x="${padding}" y="${baselineY}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}" ${strokeAttrs} xml:space="preserve">${text}</text>
</svg>`

  return Buffer.from(svg, 'utf8')
}

async function buildWatermarkBuffer(
  spec: ImageWatermarkSpec,
  baseW: number,
  baseH: number
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const minBase = Math.max(1, Math.min(baseW, baseH))
  const scale = clamp(spec.common.scalePercent, 1, 100) / 100
  const opacity = clamp(spec.common.opacity, 0, 1)
  const rotation = ((spec.common.rotationDeg % 360) + 360) % 360

  let source: sharp.Sharp
  if (spec.source.kind === 'image') {
    const abs = resolve(spec.source.logoPath)
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      throw new Error('Tệp logo không tồn tại.')
    }
    const ext = extname(abs).toLowerCase()
    if (!LOGO_INPUT_EXT.has(ext)) {
      throw new Error('Logo phải là tệp PNG, SVG hoặc WebP có kênh trong suốt.')
    }
    source = sharp(abs, { failOn: 'none' }).ensureAlpha()
  } else {
    const svg = await renderTextWatermarkSvg(spec.source, baseW, baseH)
    source = sharp(svg, { failOn: 'none' }).ensureAlpha()
  }

  const targetWidth = Math.max(1, Math.round(minBase * scale))
  source = source.resize({ width: targetWidth, fit: 'inside', withoutEnlargement: false })

  if (rotation !== 0) {
    source = source.rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
  }

  if (opacity < 1) {
    source = source.composite([
      {
        input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: 'dest-in'
      }
    ])
  }

  const out = await source.png().toBuffer({ resolveWithObject: true })
  return {
    buffer: out.data,
    width: out.info.width,
    height: out.info.height
  }
}

function computeAnchorTopLeft(
  position: WatermarkAnchorPosition,
  baseW: number,
  baseH: number,
  wmW: number,
  wmH: number,
  marginPx: number,
  offsetXpx: number,
  offsetYpx: number
): { top: number; left: number } {
  const maxLeft = Math.max(0, baseW - wmW)
  const maxTop = Math.max(0, baseH - wmH)
  const centerLeft = Math.round((baseW - wmW) / 2)
  const centerTop = Math.round((baseH - wmH) / 2)

  let left: number
  let top: number

  if (position === 'top-left' || position === 'left' || position === 'bottom-left') {
    left = marginPx
  } else if (position === 'top' || position === 'center' || position === 'bottom') {
    left = centerLeft
  } else {
    left = maxLeft - marginPx
  }

  if (position === 'top-left' || position === 'top' || position === 'top-right') {
    top = marginPx
  } else if (position === 'left' || position === 'center' || position === 'right') {
    top = centerTop
  } else {
    top = maxTop - marginPx
  }

  left = clamp(left + offsetXpx, -wmW + 1, baseW - 1)
  top = clamp(top + offsetYpx, -wmH + 1, baseH - 1)
  return { top, left }
}

function buildCompositeEntries(
  wm: { buffer: Buffer; width: number; height: number },
  spec: ImageWatermarkSpec,
  baseW: number,
  baseH: number
): OverlayOptions[] {
  const marginPx = Math.round(
    (clamp(spec.common.marginPercent, 0, 50) / 100) * Math.min(baseW, baseH)
  )

  if (spec.layout === 'anchor') {
    const { top, left } = computeAnchorTopLeft(
      spec.anchor.position,
      baseW,
      baseH,
      wm.width,
      wm.height,
      marginPx,
      Math.round(spec.anchor.offsetXpx),
      Math.round(spec.anchor.offsetYpx)
    )
    return [{ input: wm.buffer, top, left }]
  }

  const spacingX = Math.max(
    wm.width + 8,
    Math.round((clamp(spec.tile.spacingXpercent, 5, 100) / 100) * baseW)
  )
  const spacingY = Math.max(
    wm.height + 8,
    Math.round((clamp(spec.tile.spacingYpercent, 5, 100) / 100) * baseH)
  )
  const staggerShift = spec.tile.staggerOddRows ? Math.round(spacingX / 2) : 0
  const startLeft = marginPx - spacingX
  const startTop = marginPx - spacingY

  const entries: OverlayOptions[] = []
  let row = 0
  for (let top = startTop; top < baseH + spacingY; top += spacingY) {
    const rowShift = row % 2 === 1 ? staggerShift : 0
    for (let left = startLeft + rowShift; left < baseW + spacingX; left += spacingX) {
      if (top + wm.height <= 0 || left + wm.width <= 0) continue
      if (top >= baseH || left >= baseW) continue
      entries.push({ input: wm.buffer, top, left })
    }
    row++
  }
  return entries
}

function resolveOutputFormat(
  target: WatermarkOutputFormat,
  outputPath: string
): Exclude<WatermarkOutputFormat, 'keep'> {
  if (target !== 'keep') return target
  const ext = extname(outputPath).toLowerCase()
  const mapped = SOURCE_EXT_TO_FORMAT[ext]
  if (!mapped) {
    throw new Error(
      `Phần mở rộng đầu ra không hỗ trợ cho chế độ "giữ định dạng": ${ext || '(none)'}`
    )
  }
  return mapped
}

export type ComposeWatermarkOptions = {
  inputPath: string
  outputPath: string
  spec: ImageWatermarkSpec
  outputFormat: WatermarkOutputFormat
  jpegQuality: number
  webpQuality: number
  pngCompressionLevel: number
  keepMetadata: boolean
  overwrite: boolean
  signal?: AbortSignal
}

export async function composeWatermarkOnImage(params: ComposeWatermarkOptions): Promise<void> {
  const inputAbs = validateSmartCropImageInputPath(params.inputPath)
  const outAbs = validateImageWatermarkOutputPath(params.outputPath)

  if (resolve(inputAbs) === resolve(outAbs)) {
    throw new Error('Đường dẫn đầu ra trùng tệp nguồn. Chọn thư mục khác hoặc bật đổi tên tự động.')
  }
  if (!params.overwrite && existsSync(outAbs)) {
    throw new Error(`Tệp đích đã tồn tại: ${outAbs}. Bật ghi đè hoặc đổi tên đầu ra.`)
  }
  if (params.signal?.aborted) throw new Error('Đã hủy')

  const pipeline = sharp(inputAbs, { failOn: 'none' }).rotate()
  const meta: Metadata = await pipeline.metadata()
  const baseW = meta.width ?? 0
  const baseH = meta.height ?? 0
  if (baseW <= 0 || baseH <= 0) {
    throw new Error('Ảnh không có kích thước hợp lệ.')
  }

  const wm = await buildWatermarkBuffer(params.spec, baseW, baseH)
  if (params.signal?.aborted) throw new Error('Đã hủy')

  const entries = buildCompositeEntries(wm, params.spec, baseW, baseH)
  if (entries.length === 0) {
    throw new Error('Không có vị trí watermark nào khớp với ảnh. Kiểm tra khoảng cách/chế độ tile.')
  }

  let composed = pipeline.composite(entries)
  if (params.keepMetadata) {
    composed = composed.withMetadata()
  }

  const format = resolveOutputFormat(params.outputFormat, outAbs)
  const jpegQ = clamp(Math.round(params.jpegQuality), 1, 100)
  const webpQ = clamp(Math.round(params.webpQuality), 1, 100)
  const pngLevel = clamp(Math.round(params.pngCompressionLevel), 0, 9)

  try {
    switch (format) {
      case 'jpeg':
        await composed
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: jpegQ, mozjpeg: true })
          .toFile(outAbs)
        return
      case 'png':
        await composed.png({ compressionLevel: pngLevel }).toFile(outAbs)
        return
      case 'webp':
        await composed.webp({ quality: webpQ }).toFile(outAbs)
        return
      default: {
        const _exhaustive: never = format
        throw new Error(`Định dạng đích không được hỗ trợ: ${_exhaustive}`)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Lỗi khi đóng dấu watermark: ${msg}`)
  }
}

export async function renderImageWatermarkPreview(
  req: ImageWatermarkPreviewRequest
): Promise<ImageWatermarkPreviewResult> {
  const inputAbs = validateSmartCropImageInputPath(req.inputPath)
  const pipeline = sharp(inputAbs, { failOn: 'none' }).rotate()
  const meta: Metadata = await pipeline.metadata()
  const baseW = meta.width ?? 0
  const baseH = meta.height ?? 0
  if (baseW <= 0 || baseH <= 0) {
    throw new Error('Ảnh không có kích thước hợp lệ.')
  }

  const wm = await buildWatermarkBuffer(req.spec, baseW, baseH)
  const entries = buildCompositeEntries(wm, req.spec, baseW, baseH)
  if (entries.length === 0) {
    throw new Error('Không có vị trí watermark nào khớp với ảnh.')
  }

  const max = Math.max(64, Math.min(4096, Math.round(req.maxPreviewSize)))
  const scale = Math.min(1, max / Math.max(baseW, baseH))
  const outW = Math.max(1, Math.round(baseW * scale))
  const outH = Math.max(1, Math.round(baseH * scale))

  const input = await pipeline.composite(entries).png().toBuffer()
  const out = await sharp(input, { failOn: 'none' })
    .resize({ width: outW, height: outH, fit: 'inside', withoutEnlargement: true })
    .png({ compressionLevel: 6 })
    .toBuffer({ resolveWithObject: true })

  return {
    pngBase64: out.data.toString('base64'),
    width: out.info.width,
    height: out.info.height
  }
}
