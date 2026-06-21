import { open, stat } from 'fs/promises'
import { basename, extname, isAbsolute, normalize } from 'path'

import sharp from 'sharp'

import {
  DOCUMENT_MERGE_IMAGE_EXTENSIONS,
  DOCUMENT_MERGE_LIMITS,
  type DocumentImageDescriptor,
  type DocumentImageFormat,
  type DocumentImageRejection,
  type DocumentImageRejectionCode,
  type DocumentImageThumbnail,
  type InspectDocumentImagesResult
} from '@shared/domain/image-document-merge'

const ALLOWED_EXTENSIONS = new Set<string>(DOCUMENT_MERGE_IMAGE_EXTENSIONS)

const MIME_BY_FORMAT: Record<DocumentImageFormat, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  tiff: 'image/tiff'
}

function rejection(
  filePath: string,
  code: DocumentImageRejectionCode,
  message: string
): DocumentImageRejection {
  return { path: filePath, name: basename(filePath) || 'Unknown file', code, message }
}

function expectedFormatForExtension(extension: string): DocumentImageFormat | null {
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'jpeg'
    case 'png':
      return 'png'
    case 'webp':
      return 'webp'
    case 'avif':
      return 'avif'
    case 'tif':
    case 'tiff':
      return 'tiff'
    default:
      return null
  }
}

function signatureMatches(format: DocumentImageFormat, header: Buffer): boolean {
  if (format === 'jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
  if (format === 'png') {
    return header
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  }
  if (format === 'webp') {
    return (
      header.subarray(0, 4).toString('ascii') === 'RIFF' &&
      header.subarray(8, 12).toString('ascii') === 'WEBP'
    )
  }
  if (format === 'tiff') {
    const littleEndian = header.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]))
    const bigEndian = header.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
    return littleEndian || bigEndian
  }
  if (format === 'avif') {
    const brand = header.subarray(4, 32).toString('ascii')
    return header.subarray(4, 8).toString('ascii') === 'ftyp' && /avif|avis/.test(brand)
  }
  return false
}

async function readHeader(filePath: string): Promise<Buffer> {
  const handle = await open(filePath, 'r')
  try {
    const header = Buffer.alloc(32)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return header.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function inspectDocumentImage(filePath: string): Promise<DocumentImageDescriptor> {
  const normalized = normalize(filePath)
  const name = basename(normalized) || 'Unknown file'
  if (!isAbsolute(normalized)) throw new Error('The image path must be absolute.')

  const extension = extname(normalized).toLowerCase().replace(/^\./, '')
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new Error(`Unsupported image extension for ${name}.`)
  }
  const expectedFormat = expectedFormatForExtension(extension)
  if (!expectedFormat) throw new Error(`Unsupported image format for ${name}.`)

  const fileStat = await stat(normalized)
  if (!fileStat.isFile()) throw new Error(`${name} is not a file.`)
  if (fileStat.size > DOCUMENT_MERGE_LIMITS.maxImageBytes) {
    throw new Error(`${name} exceeds the 50 MB per-image limit.`)
  }

  const header = await readHeader(normalized)
  if (!signatureMatches(expectedFormat, header)) {
    throw new Error(`${name} content does not match its file extension.`)
  }

  const metadata = await sharp(normalized, {
    failOn: 'error',
    limitInputPixels: DOCUMENT_MERGE_LIMITS.maxInputPixels
  }).metadata()
  const width = metadata.width ?? 0
  const height = metadata.height ?? 0
  if (width <= 0 || height <= 0) throw new Error(`${name} has invalid image dimensions.`)
  if (width * height > DOCUMENT_MERGE_LIMITS.maxInputPixels) {
    throw new Error(`${name} exceeds the 80 megapixel limit.`)
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error(`${name} contains multiple pages or animation frames.`)
  }

  const detectedFormat = metadata.format === 'heif' ? 'avif' : metadata.format
  if (detectedFormat !== expectedFormat) {
    throw new Error(`${name} decoded format does not match its extension.`)
  }

  return {
    path: normalized,
    name,
    sizeBytes: fileStat.size,
    width,
    height,
    format: expectedFormat,
    mimeType: MIME_BY_FORMAT[expectedFormat],
    hasAlpha: metadata.hasAlpha === true || metadata.channels === 4
  }
}

function classifyInspectionError(filePath: string, error: unknown): DocumentImageRejection {
  const message = error instanceof Error ? error.message : 'Unable to inspect the image.'
  let code: DocumentImageRejectionCode = 'unsupported_content'
  if (/absolute/i.test(message)) code = 'invalid_path'
  else if (/content does not match|decoded format/i.test(message)) code = 'signature_mismatch'
  else if (/extension/i.test(message)) code = 'unsupported_extension'
  else if (/ENOENT|not a file/i.test(message)) code = 'missing_file'
  else if (/50 MB/i.test(message)) code = 'file_too_large'
  else if (/multiple pages|animation frames/i.test(message)) code = 'animated_or_multipage'
  else if (/megapixel|pixel limit/i.test(message)) code = 'too_many_pixels'
  return rejection(filePath, code, message)
}

export async function inspectDocumentImages(
  paths: readonly string[]
): Promise<InspectDocumentImagesResult> {
  const accepted: DocumentImageDescriptor[] = []
  const rejected: DocumentImageRejection[] = []
  let totalBytes = 0

  for (const filePath of paths) {
    if (accepted.length >= DOCUMENT_MERGE_LIMITS.maxImages) {
      rejected.push(rejection(filePath, 'too_many_files', 'The 100-image limit has been reached.'))
      continue
    }
    try {
      const descriptor = await inspectDocumentImage(filePath)
      if (totalBytes + descriptor.sizeBytes > DOCUMENT_MERGE_LIMITS.maxTotalImageBytes) {
        rejected.push(
          rejection(filePath, 'total_too_large', 'The combined image size exceeds 250 MB.')
        )
        continue
      }
      totalBytes += descriptor.sizeBytes
      accepted.push(descriptor)
    } catch (error) {
      rejected.push(classifyInspectionError(filePath, error))
    }
  }

  return { accepted, rejected }
}

export async function createDocumentImageThumbnail(
  filePath: string
): Promise<DocumentImageThumbnail> {
  const descriptor = await inspectDocumentImage(filePath)
  const data = await sharp(descriptor.path, {
    failOn: 'error',
    limitInputPixels: DOCUMENT_MERGE_LIMITS.maxInputPixels
  })
    .rotate()
    .resize(DOCUMENT_MERGE_LIMITS.thumbnailEdgePixels, DOCUMENT_MERGE_LIMITS.thumbnailEdgePixels, {
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({ quality: 72, effort: 2 })
    .toBuffer()

  return { path: descriptor.path, dataUrl: `data:image/webp;base64,${data.toString('base64')}` }
}
