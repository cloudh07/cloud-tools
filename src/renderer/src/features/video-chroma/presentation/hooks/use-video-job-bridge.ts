import { useVideoChromaEnhanceStore } from '@/features/video-chroma/application/stores/video-chroma-enhance.store'
import { useVideoChromaJobStore } from '@/features/video-chroma/application/stores/video-chroma-job.store'
import { getDesktop } from '@/shared/lib/desktop-bridge'
import { useEffect } from 'react'

export function useVideoJobBridge(): void {
  const applyEvent = useVideoChromaJobStore((s) => s.applyEvent)
  const applyEnhance = useVideoChromaEnhanceStore((s) => s.onVideoJobEvent)

  useEffect(() => {
    try {
      const desktop = getDesktop()
      return desktop.onVideoJobEvent((event) => {
        applyEvent(event)
        applyEnhance(event)
      })
    } catch (error) {
      console.error('[video-job-bridge]', error)
      return undefined
    }
  }, [applyEvent, applyEnhance])
}
