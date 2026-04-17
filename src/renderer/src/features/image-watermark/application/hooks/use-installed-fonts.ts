import { useRouteContext } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

export type InstalledFontsStatus = 'idle' | 'loading' | 'ready' | 'error'

export type InstalledFontsSlice = {
  fonts: string[]
  status: InstalledFontsStatus
  error: string | null
  reload: () => void
}

let cachedFonts: string[] | null = null
let inflight: Promise<string[]> | null = null

type DesktopLike = {
  listSystemFonts: (refresh?: boolean) => Promise<string[]>
}

function loadOnce(desktop: DesktopLike, refresh: boolean): Promise<string[]> {
  if (!refresh && cachedFonts) return Promise.resolve(cachedFonts)
  if (!refresh && inflight) return inflight

  const task = desktop
    .listSystemFonts(refresh)
    .then((data) => {
      cachedFonts = Array.isArray(data) ? data : []
      return cachedFonts
    })
    .finally(() => {
      inflight = null
    })

  inflight = task
  return task
}

export function useInstalledFonts(): InstalledFontsSlice {
  const { desktop } = useRouteContext({ from: '/tools' })
  const [fonts, setFonts] = useState<string[]>(() => cachedFonts ?? [])
  const [status, setStatus] = useState<InstalledFontsStatus>(() => (cachedFonts ? 'ready' : 'idle'))
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState<number>(0)

  useEffect(() => {
    let cancelled = false

    const snapshot = cachedFonts
    if (snapshot && reloadToken === 0) {
      queueMicrotask(() => {
        if (cancelled) return
        setFonts(snapshot)
        setStatus('ready')
        setError(null)
      })
      return () => {
        cancelled = true
      }
    }

    queueMicrotask(() => {
      if (cancelled) return
      setStatus('loading')
      setError(null)
    })

    loadOnce(desktop, reloadToken > 0)
      .then((data) => {
        if (cancelled) return
        setFonts(data)
        setStatus('ready')
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Không tải được danh sách font')
        setStatus('error')
      })

    return () => {
      cancelled = true
    }
  }, [desktop, reloadToken])

  const reload = useCallback(() => {
    cachedFonts = null
    inflight = null
    setReloadToken((n) => n + 1)
  }, [])

  return { fonts, status, error, reload }
}
