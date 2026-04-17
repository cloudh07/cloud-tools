import { useRouteContext } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import type { ImageWatermarkSpec } from '@shared/domain/image-watermark'

export type ImageWatermarkPreviewSlice = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  dataUrl: string | null
  width: number | null
  height: number | null
  message: string | null
}

const idlePreview = (): ImageWatermarkPreviewSlice => ({
  status: 'idle',
  dataUrl: null,
  width: null,
  height: null,
  message: null
})

const PREVIEW_DEBOUNCE_MS = 220
const MAX_PREVIEW_SIZE = 1200

function isSpecReadyForPreview(spec: ImageWatermarkSpec): boolean {
  if (spec.source.kind === 'image') {
    return spec.source.logoPath.trim().length > 0
  }
  return spec.source.text.trim().length > 0 && spec.source.fontFamily.trim().length > 0
}

export function useImageWatermarkPreview(params: {
  inputPath: string | null | undefined
  spec: ImageWatermarkSpec
  enabled: boolean
}): ImageWatermarkPreviewSlice {
  const { desktop } = useRouteContext({ from: '/tools' })
  const [preview, setPreview] = useState<ImageWatermarkPreviewSlice>(idlePreview)

  const specKey = useMemo(() => JSON.stringify(params.spec), [params.spec])

  useEffect(() => {
    const p = params.inputPath?.trim()
    if (!p || !params.enabled || !isSpecReadyForPreview(params.spec)) {
      queueMicrotask(() => setPreview(idlePreview()))
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setPreview((s) => ({ ...s, status: 'loading', message: null }))
    })

    const timer = setTimeout(() => {
      desktop
        .renderImageWatermarkPreview({
          inputPath: p,
          spec: params.spec,
          maxPreviewSize: MAX_PREVIEW_SIZE
        })
        .then((r) => {
          if (cancelled) return
          setPreview({
            status: 'ready',
            dataUrl: `data:image/png;base64,${r.pngBase64}`,
            width: r.width,
            height: r.height,
            message: null
          })
        })
        .catch((e: unknown) => {
          if (cancelled) return
          setPreview({
            status: 'error',
            dataUrl: null,
            width: null,
            height: null,
            message: e instanceof Error ? e.message : 'Không tạo được xem trước'
          })
        })
    }, PREVIEW_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [desktop, params.enabled, params.inputPath, params.spec, specKey])

  return preview
}
