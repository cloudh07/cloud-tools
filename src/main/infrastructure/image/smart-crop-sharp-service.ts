import sharp from 'sharp'

import {
  validateSmartCropImageInputPath,
  validateSmartCropOutputPath
} from '@main/infrastructure/fs/path-validator'
import {
  ANALYSIS_MAX_EDGE,
  computeAlphaMaskCropRect,
  computeSaliencyCropRect
} from '@main/infrastructure/image/smart-crop-saliency'
import type {
  ImageSmartCropOutputFormat,
  SmartCropAnalysisResult,
  SmartCropAnalyzeRequest,
  StartImageSmartCropJobRequest
} from '@shared/domain/image-smart-crop'
import { outputFormatSupportsAlpha } from '@shared/domain/image-smart-crop'

function toExtractBox(rect: { x: number; y: number; width: number; height: number }): {
  left: number
  top: number
  width: number
  height: number
} {
  return {
    left: Math.max(0, Math.floor(rect.x)),
    top: Math.max(0, Math.floor(rect.y)),
    width: Math.max(1, Math.floor(rect.width)),
    height: Math.max(1, Math.floor(rect.height))
  }
}

function applyFormatPipeline(
  pipeline: sharp.Sharp,
  format: ImageSmartCropOutputFormat,
  keepAlpha: boolean,
  jpegQuality: number,
  webpQuality: number
): sharp.Sharp {
  const alphaOk = keepAlpha && outputFormatSupportsAlpha(format)
  let p = pipeline
  if (!alphaOk) {
    p = p.flatten({ background: { r: 255, g: 255, b: 255 } })
  }
  switch (format) {
    case 'png':
      return p.png({ compressionLevel: 9, effort: 7 })
    case 'jpeg':
      return p.jpeg({
        quality: Math.round(Math.max(40, Math.min(100, jpegQuality)))
      })
    case 'webp':
      return p.webp({
        quality: Math.round(Math.max(40, Math.min(100, webpQuality))),
        alphaQuality: 100,
        lossless: false
      })
    case 'avif':
      return p.avif({ quality: Math.round(Math.max(40, Math.min(90, webpQuality))) })
    case 'tiff':
      return p.tiff({ compression: 'lzw' })
    default:
      return p.png()
  }
}

export async function analyzeSmartCropImage(
  req: SmartCropAnalyzeRequest
): Promise<SmartCropAnalysisResult> {
  const input = validateSmartCropImageInputPath(req.inputPath)
  const meta = await sharp(input).rotate().metadata()
  const sW = meta.width ?? 0
  const sH = meta.height ?? 0
  if (!sW || !sH) {
    throw new Error('Could not read image width/height after orientation normalization.')
  }

  const base = sharp(input).rotate().resize({
    width: ANALYSIS_MAX_EDGE,
    height: ANALYSIS_MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true
  })

  const [greyBuf, alphaBuf] = await Promise.all([
    base.clone().greyscale().raw().toBuffer({ resolveWithObject: true }),
    meta.hasAlpha
      ? base
          .clone()
          .ensureAlpha()
          .extractChannel('alpha')
          .raw()
          .toBuffer({ resolveWithObject: true })
      : Promise.resolve(null)
  ])

  const grey = new Uint8Array(greyBuf.data.buffer, greyBuf.data.byteOffset, greyBuf.data.byteLength)

  const alphaComp =
    alphaBuf &&
    computeAlphaMaskCropRect({
      alpha: new Uint8Array(
        alphaBuf.data.buffer,
        alphaBuf.data.byteOffset,
        alphaBuf.data.byteLength
      ),
      analysisWidth: alphaBuf.info.width,
      analysisHeight: alphaBuf.info.height,
      sourceWidth: sW,
      sourceHeight: sH,
      paddingRatio: req.paddingRatio,
      aspectMode: req.aspectMode,
      alphaThreshold: 24
    })

  const comp =
    alphaComp ??
    computeSaliencyCropRect({
      grey,
      analysisWidth: greyBuf.info.width,
      analysisHeight: greyBuf.info.height,
      sourceWidth: sW,
      sourceHeight: sH,
      sensitivity: req.sensitivity,
      paddingRatio: req.paddingRatio,
      aspectMode: req.aspectMode
    })

  return {
    image: {
      width: sW,
      height: sH,
      format: meta.format,
      orientationNormalized: true
    },
    tightSaliencyRect: comp.tightSaliencyRectSource,
    paddingAppliedPx: comp.paddingAppliedPx,
    cropRect: comp.cropRectSource,
    analysisSize: comp.analysisSize,
    confidence: comp.confidence,
    fallbackUsed: comp.fallbackUsed,
    detail: comp.detail
  }
}

export async function exportSmartCropImage(
  req: StartImageSmartCropJobRequest,
  onLog: (line: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const check = (): void => {
    if (signal?.aborted) throw new Error('Aborted')
  }
  const input = validateSmartCropImageInputPath(req.inputPath)
  const output = validateSmartCropOutputPath(req.outputPath, req.outputFormat)
  check()
  onLog('Reading oriented bitmap…')
  let box = toExtractBox(req.cropRect)
  const meta = await sharp(input).rotate().metadata()
  const iw = meta.width ?? 0
  const ih = meta.height ?? 0
  if (box.left + box.width > iw) box = { ...box, width: Math.max(1, iw - box.left) }
  if (box.top + box.height > ih) box = { ...box, height: Math.max(1, ih - box.top) }
  check()
  onLog(`Extract region ${box.width}×${box.height} @ (${box.left}, ${box.top})`)
  let img = sharp(input).rotate().extract(box)
  check()
  onLog(`Encoding ${req.outputFormat}…`)
  img = applyFormatPipeline(img, req.outputFormat, req.keepAlpha, req.jpegQuality, req.webpQuality)
  await img.toFile(output)
  check()
  onLog(`Written: ${output}`)
  return output
}
