import { useRouteContext } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import type { WatermarkRemoveSpec } from '@shared/domain/watermark-remove'

export type WatermarkRemovePreviewSlice = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  dataUrl: string | null
  width: number | null
  height: number | null
  message: string | null
}

const PREVIEW_DEBOUNCE_MS = 260
const MAX_PREVIEW_SIZE = 1024

function idle(): WatermarkRemovePreviewSlice {
  return {
    status: 'idle',
    dataUrl: null,
    width: null,
    height: null,
    message: null
  }
}

function isSpecReady(spec: WatermarkRemoveSpec): boolean {
  if (!spec.keyframes || spec.keyframes.length === 0) return false
  return spec.keyframes.some((k) => k.shapes.length > 0)
}

export function useWatermarkRemovePreview(params: {
  inputPath: string | null | undefined
  previewTime: number
  spec: WatermarkRemoveSpec
  enabled: boolean
}): WatermarkRemovePreviewSlice {
  const { desktop } = useRouteContext({ from: '/tools' })
  const [preview, setPreview] = useState<WatermarkRemovePreviewSlice>(idle)

  const specKey = useMemo(
    () => `${JSON.stringify(params.spec)}@${params.previewTime.toFixed(3)}`,
    [params.spec, params.previewTime]
  )

  useEffect(() => {
    const p = params.inputPath?.trim()
    if (!p || !params.enabled || !isSpecReady(params.spec)) {
      queueMicrotask(() => setPreview(idle()))
      return
    }

    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setPreview((s) => ({ ...s, status: 'loading', message: null }))
    })

    const timer = setTimeout(() => {
      desktop
        .renderWatermarkRemovePreview({
          inputPath: p,
          previewTime: params.previewTime,
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
  }, [desktop, params.enabled, params.inputPath, params.previewTime, params.spec, specKey])

  return preview
}
