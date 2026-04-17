import { getDesktop } from '@/shared/lib/desktop-bridge'
import type {
  WatermarkRemoveModelId,
  WatermarkRemoveModelStatus
} from '@shared/domain/watermark-remove'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

const EMPTY = (id: WatermarkRemoveModelId): WatermarkRemoveModelStatus => ({
  id,
  state: 'missing',
  bytesDownloaded: 0,
  bytesTotal: 0,
  errorMessage: null
})

export function useWatermarkRemoveModel(id: WatermarkRemoveModelId): {
  status: WatermarkRemoveModelStatus
  percent: number
  isBusy: boolean
  startDownload: () => Promise<void>
  deleteModel: () => Promise<void>
} {
  const [status, setStatus] = useState<WatermarkRemoveModelStatus>(() => EMPTY(id))

  useEffect(() => {
    const desktop = getDesktop()
    let cancelled = false
    desktop
      .getWatermarkRemoveModelStatus(id)
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => undefined)
    const unsub = desktop.onWatermarkRemoveModelEvent((ev) => {
      if (ev.id !== id) return
      setStatus((prev) => {
        if (ev.type === 'progress') {
          return {
            ...prev,
            id,
            state: 'downloading',
            bytesDownloaded: ev.bytesDownloaded,
            bytesTotal: ev.bytesTotal
          }
        }
        if (ev.type === 'completed') {
          return {
            id,
            state: 'ready',
            bytesDownloaded: prev.bytesTotal || prev.bytesDownloaded,
            bytesTotal: prev.bytesTotal,
            errorMessage: null
          }
        }
        return {
          ...prev,
          id,
          state: 'error',
          errorMessage: ev.message
        }
      })
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [id])

  const percent =
    status.bytesTotal > 0
      ? Math.min(100, Math.round((status.bytesDownloaded / status.bytesTotal) * 100))
      : 0
  const isBusy = status.state === 'downloading'

  const startDownload = useCallback(async () => {
    try {
      await getDesktop().downloadWatermarkRemoveModel(id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không tải được model')
    }
  }, [id])

  const deleteModel = useCallback(async () => {
    try {
      await getDesktop().deleteWatermarkRemoveModel(id)
      setStatus(EMPTY(id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Không xóa được model')
    }
  }, [id])

  return { status, percent, isBusy, startDownload, deleteModel }
}
