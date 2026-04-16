import { useRouteContext } from '@tanstack/react-router'
import type { ImageFormatProbeResult } from '@shared/domain/image-format-convert'
import { useEffect, useState } from 'react'

export type ImageFormatConvertProbeSlice = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  data: ImageFormatProbeResult | null
  message: string | null
}

const idleProbe = (): ImageFormatConvertProbeSlice => ({
  status: 'idle',
  data: null,
  message: null
})

export function useImageFormatConvertProbe(
  inputPath: string | null | undefined
): ImageFormatConvertProbeSlice {
  const { desktop } = useRouteContext({ from: '/tools' })
  const [probe, setProbe] = useState<ImageFormatConvertProbeSlice>(idleProbe)

  useEffect(() => {
    const p = inputPath?.trim()
    if (!p) {
      queueMicrotask(() => setProbe(idleProbe()))
      return
    }
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setProbe((s) => ({ ...s, status: 'loading', message: null }))
    })
    void desktop
      .probeImageFormat(p)
      .then((r) => {
        if (cancelled) return
        setProbe({ status: 'ready', data: r, message: null })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setProbe({
          status: 'error',
          data: null,
          message: e instanceof Error ? e.message : 'Không đọc được ảnh'
        })
      })
    return () => {
      cancelled = true
    }
  }, [desktop, inputPath])

  return probe
}
