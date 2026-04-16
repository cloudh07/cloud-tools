import type { ImageFormatTarget } from '@shared/domain/image-format-convert'

export function formatTargetLabel(t: ImageFormatTarget): string {
  switch (t) {
    case 'jpeg':
      return 'JPEG'
    case 'png':
      return 'PNG'
    case 'webp':
      return 'WebP'
    case 'avif':
      return 'AVIF'
    case 'tiff':
      return 'TIFF'
    case 'gif':
      return 'GIF'
    default:
      return t
  }
}
