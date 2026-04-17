import { spawn } from 'child_process'

import sharp from 'sharp'

import { mapSpawnErrorToMediaBinary } from '@main/infrastructure/ffmpeg/spawn-binary-error'
import { getMediaBinaryResolver } from '@main/infrastructure/media/media-binary-resolver'
import { runFfmpegWithHandlers } from '@main/infrastructure/ffmpeg/ffmpeg-process-runner'
import type { AppConfig } from '@shared/domain/app-config'
import type {
  WatermarkRemoveSpec,
  WatermarkRemoveVideoOptions
} from '@shared/domain/watermark-remove'

import { maskHasAnyCoverage, rasterizeInterpolatedMask } from './mask-interpolator'
import { inpaintFrameAsync } from './classical-engine'
import { inpaintFrameWithLama } from './lama-engine'
import { applyTemporalSmoothing } from './temporal-smoother'

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const PNG_END = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])

export type FrameRgba = {
  rgba: Uint8ClampedArray
  width: number
  height: number
}

export async function extractVideoFrameRgba(
  cfg: AppConfig,
  inputPath: string,
  timeSec: number,
  maxSize: number
): Promise<FrameRgba> {
  const resolver = getMediaBinaryResolver()
  const ffmpeg = resolver.resolveFfmpegOrThrow(cfg)
  const args = [
    '-hide_banner',
    '-v',
    'error',
    '-ss',
    timeSec.toFixed(3),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    `scale='min(${maxSize},iw)':-2`,
    '-c:v',
    'png',
    '-f',
    'image2pipe',
    '-'
  ]
  const png = await spawnAndCollectStdout(ffmpeg.path, args)
  const decoded = await sharp(png).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
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

export type RunVideoInpaintParams = {
  cfg: AppConfig
  inputPath: string
  outputPath: string
  spec: WatermarkRemoveSpec
  options: WatermarkRemoveVideoOptions
  durationSec: number | null
  fps: number | null
  signal: AbortSignal
  onProgress: (payload: {
    ratio: number
    currentFrame?: number
    totalFrames?: number
    phase: 'probe' | 'inpaint' | 'encode' | 'mux'
  }) => void
  onLog: (line: string) => void
}

export async function runVideoInpaint(params: RunVideoInpaintParams): Promise<void> {
  const { cfg, inputPath, outputPath, spec, options, signal, onProgress, onLog } = params
  const resolver = getMediaBinaryResolver()
  const ffmpeg = resolver.resolveFfmpegOrThrow(cfg)
  const fps = params.fps && params.fps > 0 ? params.fps : 30
  const totalFrames =
    params.durationSec && params.durationSec > 0
      ? Math.max(1, Math.round(params.durationSec * fps))
      : null

  onProgress({ ratio: 0.02, phase: 'probe', totalFrames: totalFrames ?? undefined })

  const extractor = spawn(
    ffmpeg.path,
    [
      '-hide_banner',
      '-v',
      'error',
      '-i',
      inputPath,
      '-vf',
      `fps=${fps}`,
      '-c:v',
      'png',
      '-f',
      'image2pipe',
      '-'
    ],
    { windowsHide: true }
  )
  extractor.stderr.on('data', (d) => onLog(`[extract] ${String(d).trim()}`))

  const encoderArgs = buildEncoderArgs({
    fps,
    inputAudioPath: options.copyAudio ? inputPath : null,
    outputPath,
    options
  })
  const encoder = spawn(ffmpeg.path, encoderArgs, { windowsHide: true })
  encoder.stderr.on('data', (d) => onLog(`[encode] ${String(d).trim()}`))

  const abortListener = (): void => {
    extractor.kill('SIGTERM')
    encoder.kill('SIGTERM')
  }
  signal.addEventListener('abort', abortListener, { once: true })

  const encoderClosed = new Promise<number>((resolve, reject) => {
    encoder.on('error', (e) => reject(mapSpawnErrorToMediaBinary('ffmpeg', e)))
    encoder.on('close', (code) => resolve(code ?? 1))
  })

  let pendingPng: Buffer = Buffer.alloc(0)
  let frameIndex = 0
  let prevFrame: Uint8ClampedArray | null = null
  const hasShapes = spec.keyframes.some((k) => k.shapes.length > 0)

  await new Promise<void>((resolveStream, rejectStream) => {
    extractor.stdout.on('data', (chunk: Buffer) => {
      pendingPng = pendingPng.length === 0 ? chunk : Buffer.concat([pendingPng, chunk])
      while (true) {
        const png = takeNextPng(pendingPng)
        if (!png) break
        pendingPng = pendingPng.subarray(png.byteLength)
        ;(async () => {
          extractor.stdout.pause()
          try {
            const time = frameIndex / fps
            let outPng: Buffer
            if (!hasShapes) {
              outPng = png
              prevFrame = null
            } else {
              const decoded = await sharp(png)
                .raw()
                .ensureAlpha()
                .toBuffer({ resolveWithObject: true })
              const frame = new Uint8ClampedArray(
                decoded.data.buffer,
                decoded.data.byteOffset,
                decoded.data.byteLength
              )
              const mask = rasterizeInterpolatedMask({
                keyframes: spec.keyframes,
                time,
                canvasWidth: spec.canvasWidth,
                canvasHeight: spec.canvasHeight,
                width: decoded.info.width,
                height: decoded.info.height
              })
              if (maskHasAnyCoverage(mask, 16)) {
                if (spec.engine === 'ai') {
                  await inpaintFrameWithLama(frame, mask, decoded.info.width, decoded.info.height)
                } else {
                  await inpaintFrameAsync(frame, mask, decoded.info.width, decoded.info.height)
                }
                if (spec.temporalSmooth && prevFrame && prevFrame.length === frame.length) {
                  applyTemporalSmoothing(frame, prevFrame, mask, spec.temporalAlpha)
                }
              }
              prevFrame = new Uint8ClampedArray(frame)
              outPng = await sharp(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength), {
                raw: { width: decoded.info.width, height: decoded.info.height, channels: 4 }
              })
                .png({ compressionLevel: 0 })
                .toBuffer()
            }
            const writable = encoder.stdin.write(outPng)
            if (!writable) await new Promise<void>((r) => encoder.stdin.once('drain', r))
            frameIndex++
            const ratio = totalFrames
              ? Math.min(0.97, 0.05 + 0.9 * (frameIndex / totalFrames))
              : 0.5
            onProgress({
              ratio,
              currentFrame: frameIndex,
              totalFrames: totalFrames ?? undefined,
              phase: 'inpaint'
            })
          } finally {
            extractor.stdout.resume()
          }
        })().catch(rejectStream)
      }
    })
    extractor.stdout.on('end', () => {
      encoder.stdin.end()
    })
    extractor.on('error', (e) => rejectStream(mapSpawnErrorToMediaBinary('ffmpeg', e)))
    extractor.on('close', (code) => {
      if (code !== 0 && code !== null) {
        rejectStream(new Error(`ffmpeg extractor exited with code ${code}`))
      } else {
        resolveStream()
      }
    })
  })

  const code = await encoderClosed
  signal.removeEventListener('abort', abortListener)
  if (signal.aborted) throw new Error('Cancelled')
  if (code !== 0) throw new Error(`ffmpeg encoder exited with code ${code}`)
  onProgress({ ratio: 1, phase: 'mux', totalFrames: totalFrames ?? undefined })
  void runFfmpegWithHandlers
}

function buildEncoderArgs(p: {
  fps: number
  inputAudioPath: string | null
  outputPath: string
  options: WatermarkRemoveVideoOptions
}): string[] {
  const args: string[] = [
    '-hide_banner',
    '-v',
    'error',
    '-y',
    '-f',
    'image2pipe',
    '-framerate',
    String(p.fps),
    '-i',
    '-'
  ]
  if (p.inputAudioPath) {
    args.push('-i', p.inputAudioPath, '-map', '0:v', '-map', '1:a?')
  } else {
    args.push('-map', '0:v')
  }
  if (p.options.videoCodec === 'vp9') {
    args.push('-c:v', 'libvpx-vp9', '-crf', String(p.options.crf), '-b:v', '0')
  } else {
    args.push(
      '-c:v',
      'libx264',
      '-crf',
      String(p.options.crf),
      '-preset',
      p.options.preset,
      '-pix_fmt',
      'yuv420p'
    )
  }
  args.push('-c:a', p.options.copyAudio ? 'copy' : 'aac')
  if (!p.options.overwrite) args.push('-n')
  args.push(p.outputPath)
  return args
}

function takeNextPng(buf: Buffer): Buffer | null {
  if (buf.length < PNG_SIGNATURE.length) return null
  if (!startsWithPngSignature(buf)) return null
  const end = buf.indexOf(PNG_END)
  if (end < 0) return null
  return buf.subarray(0, end + PNG_END.length)
}

function startsWithPngSignature(buf: Buffer): boolean {
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) return false
  }
  return true
}

async function spawnAndCollectStdout(bin: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true })
    const chunks: Buffer[] = []
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => chunks.push(d))
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', (err) => reject(mapSpawnErrorToMediaBinary('ffmpeg', err)))
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks))
      else reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`))
    })
  })
}
