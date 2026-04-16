import { existsSync, statSync } from 'fs'
import { resolve } from 'path'

import sharp from 'sharp'

import {
  validateFormatConvertOutputPath,
  validateSmartCropImageInputPath
} from '@main/infrastructure/fs/path-validator'
import type {
  ImageFormatConvertOptions,
  ImageFormatProbeResult,
  ImageFormatTarget
} from '@shared/domain/image-format-convert'

function throwProbeError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e)
  if (/unsupported|unsupported image|input file|Vips|heif|svg/i.test(msg)) {
    throw new Error(
      `Không đọc được ảnh (Sharp/libvips): ${msg}. Định dạng có thể chưa được build hỗ trợ trên máy này.`
    )
  }
  throw new Error(`Không đọc được metadata ảnh: ${msg}`)
}

export function assertOutputCompatibleWithProbe(
  probe: ImageFormatProbeResult,
  target: ImageFormatTarget
): void {
  if (target === 'jpeg' && probe.hasAlpha) {
    throw new Error(
      'Ảnh có kênh alpha nhưng JPEG không lưu được trong suốt, vui lòng chọn PNG, WebP, AVIF, TIFF hoặc GIF.'
    )
  }
}

export async function probeImageForFormatConvert(
  inputPath: string
): Promise<ImageFormatProbeResult> {
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

    let hint: string | null = null
    const pages = meta.pages != null && meta.pages > 1 ? meta.pages : null
    if (pages != null) {
      hint =
        'Nguồn có nhiều khung/trang; Sharp sẽ xử lý khung đầu khi chuyển định dạng (trừ khi pipeline hỗ trợ khác ở bản sau).'
    }

    return {
      width,
      height,
      format: meta.format ?? 'unknown',
      orientation: meta.orientation ?? null,
      hasAlpha: Boolean(hasAlpha),
      fileSizeBytes: st.size,
      pages,
      hint
    }
  } catch (e) {
    throwProbeError(e)
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export async function convertImageFormatWithSharp(params: {
  inputPath: string
  outputPath: string
  target: ImageFormatTarget
  options: ImageFormatConvertOptions
  signal?: AbortSignal
}): Promise<void> {
  const { target, options, signal } = params
  const inputAbs = validateSmartCropImageInputPath(params.inputPath)
  const outAbs = validateFormatConvertOutputPath(params.outputPath, target)

  if (resolve(inputAbs) === resolve(outAbs)) {
    throw new Error('Đường dẫn đầu ra trùng tệp nguồn. Chọn thư mục khác hoặc bật đổi tên tự động.')
  }

  if (!options.overwrite && existsSync(outAbs)) {
    throw new Error(`Tệp đích đã tồn tại: ${outAbs}. Bật ghi đè hoặc đổi tên đầu ra.`)
  }

  const probe = await probeImageForFormatConvert(inputAbs)
  assertOutputCompatibleWithProbe(probe, target)

  if (signal?.aborted) {
    throw new Error('Đã hủy')
  }

  let pipeline = sharp(inputAbs, { failOn: 'none' }).rotate()

  if (options.keepMetadata) {
    pipeline = pipeline.withMetadata()
  }

  const jpegQ = clamp(Math.round(options.jpegQuality), 1, 100)
  const webpQ = clamp(Math.round(options.webpQuality), 1, 100)
  const avifQ = clamp(Math.round(options.avifQuality), 1, 100)
  const pngLevel = clamp(Math.round(options.pngCompressionLevel), 0, 9)

  try {
    switch (target) {
      case 'jpeg':
        await pipeline.jpeg({ quality: jpegQ, mozjpeg: true }).toFile(outAbs)
        break
      case 'png':
        await pipeline.png({ compressionLevel: pngLevel }).toFile(outAbs)
        break
      case 'webp':
        await pipeline.webp({ quality: webpQ }).toFile(outAbs)
        break
      case 'avif':
        await pipeline.avif({ quality: avifQ, effort: 4 }).toFile(outAbs)
        break
      case 'tiff':
        await pipeline.tiff({ compression: 'lzw', quality: 100 }).toFile(outAbs)
        break
      case 'gif':
        await pipeline.gif({ colours: 256, effort: 7 }).toFile(outAbs)
        break
      default: {
        const _exhaustive: never = target
        throw new Error(`Định dạng đích không được hỗ trợ: ${_exhaustive}`)
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/avif|heif|gif|tiff|unsupported/i.test(msg)) {
      throw new Error(
        `Không ghi được ${target.toUpperCase()}: ${msg}. Thử định dạng khác hoặc cập nhật Sharp/libvips.`
      )
    }
    throw new Error(`Lỗi khi chuyển đổi: ${msg}`)
  }
}
