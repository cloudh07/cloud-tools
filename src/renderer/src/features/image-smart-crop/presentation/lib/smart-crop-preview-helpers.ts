import type { CropRect } from '@shared/domain/image-smart-crop'

export const AUTO_ANALYZE_DEBOUNCE_MS = 320

export function rectAlmostEqual(a: CropRect, b: CropRect, eps = 0.5): boolean {
  return (
    Math.abs(a.x - b.x) <= eps &&
    Math.abs(a.y - b.y) <= eps &&
    Math.abs(a.width - b.width) <= eps &&
    Math.abs(a.height - b.height) <= eps
  )
}

export const SMART_CROP_PREVIEW_CHECKER_SURFACE =
  'bg-zinc-100 [background-image:linear-gradient(45deg,#d4d4d8_25%,transparent_25%),linear-gradient(-45deg,#d4d4d8_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#d4d4d8_75%),linear-gradient(-45deg,transparent_75%,#d4d4d8_75%)] [background-size:12px_12px] [background-position:0_0,0_6px,6px_-6px,-6px_0] dark:bg-zinc-950 dark:[background-image:linear-gradient(45deg,#3f3f46_25%,transparent_25%),linear-gradient(-45deg,#3f3f46_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#3f3f46_75%),linear-gradient(-45deg,transparent_75%,#3f3f46_75%)]'
