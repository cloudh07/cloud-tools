import { existsSync, statSync } from 'fs'
import { basename, dirname, extname, isAbsolute, normalize } from 'path'

import type { ImageFormatTarget } from '@shared/domain/image-format-convert'
import {
  buildChromaEnhancePartialVideoPath as sharedBuildChromaEnhancePartial,
  buildChromaStagingVideoPath as sharedBuildChromaStaging
} from '@shared/infrastructure/paths/chroma-work-paths'
import type { ImageSmartCropOutputFormat } from '@shared/domain/image-smart-crop'

const MP4_EXT = '.mp4'
const MOV_EXT = '.mov'
const WEBM_EXT = '.webm'
const MKV_EXT = '.mkv'
const AVI_EXT = '.avi'
const M4V_EXT = '.m4v'
const WEBP_EXT = '.webp'
export const PLAYABLE_VIDEO_EXT = new Set([MP4_EXT, MOV_EXT, WEBM_EXT])
const COMPRESS_INPUT_EXT = new Set([MP4_EXT, MOV_EXT, WEBM_EXT, MKV_EXT, AVI_EXT, M4V_EXT])
const AUDIO_EXTRACT_OUT_EXT = new Set(['.m4a', '.mp3', '.wav', '.flac', '.opus', '.ogg'])

export const SMART_CROP_IMAGE_INPUT_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.tif',
  '.tiff',
  '.avif',
  '.bmp',
  '.heic',
  '.heif',
  '.jxl',
  '.svg'
])

export function isSmartCropImageInputExt(extLower: string): boolean {
  return SMART_CROP_IMAGE_INPUT_EXT.has(extLower)
}

const LOCAL_MEDIA_STREAM_EXT = new Set<string>([
  ...PLAYABLE_VIDEO_EXT,
  ...SMART_CROP_IMAGE_INPUT_EXT
])

const SMART_CROP_OUTPUT_EXT: Record<ImageSmartCropOutputFormat, string> = {
  png: '.png',
  jpeg: '.jpg',
  webp: '.webp',
  avif: '.avif',
  tiff: '.tif'
}

const FORMAT_CONVERT_OUTPUT_EXT: Record<ImageFormatTarget, string> = {
  jpeg: '.jpg',
  png: '.png',
  webp: '.webp',
  avif: '.avif',
  tiff: '.tif',
  gif: '.gif'
}

function assertAbsolute(p: string, label: string): string {
  const n = normalize(p)
  if (!isAbsolute(n)) {
    throw new Error(`${label} must be an absolute path`)
  }
  return n
}

export function validateCompressInputPath(inputPath: string): string {
  const abs = assertAbsolute(inputPath, 'Input')
  if (!existsSync(abs)) {
    throw new Error('Input file does not exist')
  }
  if (!statSync(abs).isFile()) {
    throw new Error('Input path must be a file')
  }
  const ext = extname(abs).toLowerCase()
  if (!COMPRESS_INPUT_EXT.has(ext)) {
    throw new Error('Unsupported input type for compression')
  }
  return abs
}

export function validateMp4InputPath(inputPath: string): string {
  const abs = assertAbsolute(inputPath, 'Input')
  if (!existsSync(abs)) {
    throw new Error('Input file does not exist')
  }
  if (!statSync(abs).isFile()) {
    throw new Error('Input path must be a file')
  }
  if (extname(abs).toLowerCase() !== MP4_EXT) {
    throw new Error('Input must be an .mp4 file')
  }
  return abs
}

export function validateOutputVideoPath(
  outputPath: string,
  mode: 'green_screen' | 'alpha_mov'
): string {
  const abs = assertAbsolute(outputPath, 'Output')
  const ext = extname(abs).toLowerCase()
  if (mode === 'green_screen' && ext !== MP4_EXT) {
    throw new Error('Green screen mode expects an .mp4 output path')
  }
  if (mode === 'alpha_mov' && ext !== MOV_EXT) {
    throw new Error('Alpha mode expects a .mov output path (ProRes 4444)')
  }
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    throw new Error(`Output directory does not exist: ${dir}`)
  }
  return abs
}

export function buildChromaStagingVideoPath(userOutput: string, jobId: string): string {
  return sharedBuildChromaStaging(assertAbsolute(userOutput, 'Output'), jobId)
}

export function buildChromaEnhancePartialVideoPath(userOutput: string, jobId: string): string {
  return sharedBuildChromaEnhancePartial(assertAbsolute(userOutput, 'Output'), jobId)
}

export function validateWebpOutputPath(webpPath: string): string {
  const abs = assertAbsolute(webpPath, 'WebP output')
  if (extname(abs).toLowerCase() !== WEBP_EXT) {
    throw new Error('WebP export path must end with .webp')
  }
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    throw new Error(`WebP output directory does not exist: ${dir}`)
  }
  return abs
}

export function validateKeyColor(keyColor: string): string {
  const trimmed = keyColor.trim()
  if (!/^0x[0-9a-fA-F]{6}$/.test(trimmed)) {
    throw new Error('Key color must look like 0x00FF00 (RGB hex with 0x prefix)')
  }
  return trimmed
}

export function safeBasename(p: string): string {
  return basename(p)
}

export function validateCompressOutputPath(outputPath: string): string {
  const abs = assertAbsolute(outputPath, 'Output')
  const ext = extname(abs).toLowerCase()
  const allowed = new Set([MP4_EXT, MOV_EXT, WEBM_EXT, WEBP_EXT])
  if (!allowed.has(ext)) {
    throw new Error('Output must be .mp4, .mov, .webm, or .webp')
  }
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    throw new Error(`Output directory does not exist: ${dir}`)
  }
  return abs
}

export function validateOutputDirectoryPath(dirPath: string): string {
  const abs = assertAbsolute(dirPath, 'Output directory')
  if (!existsSync(abs) || !statSync(abs).isDirectory()) {
    throw new Error('Output directory does not exist or is not a folder')
  }
  return abs
}

export function validateExistingDirectoryPath(dirPath: string): string {
  const abs = assertAbsolute(dirPath, 'Folder')
  if (!existsSync(abs)) {
    throw new Error('Folder does not exist')
  }
  if (!statSync(abs).isDirectory()) {
    throw new Error('Path must be a folder')
  }
  return abs
}

export function validateAudioExtractOutputPath(outputPath: string): string {
  const abs = assertAbsolute(outputPath, 'Output')
  const ext = extname(abs).toLowerCase()
  if (!AUDIO_EXTRACT_OUT_EXT.has(ext)) {
    throw new Error('Audio output must be .m4a, .mp3, .wav, .flac, .opus, or .ogg')
  }
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    throw new Error(`Output directory does not exist: ${dir}`)
  }
  return abs
}

export function validateExistingFilePath(filePath: string): string {
  const abs = assertAbsolute(filePath, 'Path')
  if (!existsSync(abs) || !statSync(abs).isFile()) {
    throw new Error('File does not exist')
  }
  return abs
}

export function validateLocalMediaPlaybackPath(filePath: string): string {
  const abs = validateExistingFilePath(filePath)
  const ext = extname(abs).toLowerCase()
  if (!LOCAL_MEDIA_STREAM_EXT.has(ext)) {
    throw new Error(
      'Local media stream supports video (.mp4, .mov, .webm) and image formats used for preview'
    )
  }
  return abs
}

export function validateSmartCropImageInputPath(inputPath: string): string {
  const abs = assertAbsolute(inputPath, 'Input')
  if (!existsSync(abs)) {
    throw new Error('Input file does not exist')
  }
  if (!statSync(abs).isFile()) {
    throw new Error('Input path must be a file')
  }
  const ext = extname(abs).toLowerCase()
  if (!SMART_CROP_IMAGE_INPUT_EXT.has(ext)) {
    throw new Error(`Unsupported image input extension: ${ext || '(none)'}`)
  }
  return abs
}

export function validateSmartCropOutputPath(
  outputPath: string,
  format: ImageSmartCropOutputFormat
): string {
  const abs = assertAbsolute(outputPath, 'Output')
  const want = SMART_CROP_OUTPUT_EXT[format]
  const ext = extname(abs).toLowerCase()
  if (ext !== want) {
    throw new Error(`Output path extension must be ${want} for format "${format}"`)
  }
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    throw new Error(`Output directory does not exist: ${dir}`)
  }
  return abs
}

export function validateFormatConvertOutputPath(
  outputPath: string,
  format: ImageFormatTarget
): string {
  const abs = assertAbsolute(outputPath, 'Output')
  const want = FORMAT_CONVERT_OUTPUT_EXT[format]
  const ext = extname(abs).toLowerCase()
  if (ext !== want) {
    throw new Error(`Đường dẫn đầu ra phải có phần mở rộng ${want} cho định dạng "${format}".`)
  }
  const dir = dirname(abs)
  if (!existsSync(dir)) {
    throw new Error(`Thư mục đầu ra không tồn tại: ${dir}`)
  }
  return abs
}
