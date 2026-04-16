import { useVideoChromaEnhanceStore } from '@/features/video-chroma/application/stores/video-chroma-enhance.store'
import { useVideoChromaJobStore } from '@/features/video-chroma/application/stores/video-chroma-job.store'
import { shellOpenPath } from '@/shared/lib/desktop-bridge'
import type { VideoJobStatus } from '@shared/domain/video-job'
import { VideoOutputMode } from '@shared/domain/video-output-mode'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

async function openCompletedVideo(path: string): Promise<void> {
  try {
    await shellOpenPath(path)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Không thể mở tệp')
  }
}

const TERMINAL_TOAST_IDS = {
  completed: 'video-chroma-toast-completed',
  failed: 'video-chroma-toast-failed',
  cancelled: 'video-chroma-toast-cancelled',
  enhanceFailed: 'video-chroma-toast-enhance-failed'
} as const

export function dismissVideoChromaToasts(): void {
  for (const id of Object.values(TERMINAL_TOAST_IDS)) {
    toast.dismiss(id)
  }
}

export function useVideoChromaTerminalToasts(): void {
  const status = useVideoChromaJobStore((s) => s.status)
  const errorMessage = useVideoChromaJobStore((s) => s.errorMessage)
  const enhanceStatus = useVideoChromaEnhanceStore((s) => s.status)
  const enhanceError = useVideoChromaEnhanceStore((s) => s.lastError)
  const prevRef = useRef<VideoJobStatus | null>(null)
  const prevEnhanceRef = useRef(enhanceStatus)

  useEffect(() => {
    return () => dismissVideoChromaToasts()
  }, [])

  useEffect(() => {
    const prev = prevRef.current
    const next = status

    if (prev !== null) {
      if (next === 'completed' && prev !== 'completed') {
        const { outputs, completedMode } = useVideoChromaJobStore.getState()
        const videoPath = outputs.video
        toast.success('Xử lý đã hoàn tất', {
          id: TERMINAL_TOAST_IDS.completed,
          description:
            completedMode === VideoOutputMode.ALPHA_MOV
              ? 'MOV ProRes có alpha: trình phát nhúng thường hiển thị vùng trong suốt là nền tối - thử VLC/DaVinci hoặc nút Mở tệp.'
              : undefined,
          action: videoPath
            ? {
                label: 'Mở tệp',
                onClick: () => {
                  void openCompletedVideo(videoPath)
                }
              }
            : undefined
        })
      }
      if (next === 'failed' && prev !== 'failed' && errorMessage) {
        toast.error(errorMessage, { id: TERMINAL_TOAST_IDS.failed })
      }
      if (next === 'cancelled' && prev !== 'cancelled') {
        toast.message('Đã hủy', { id: TERMINAL_TOAST_IDS.cancelled })
      }
    }

    prevRef.current = next
  }, [status, errorMessage])

  useEffect(() => {
    const prev = prevEnhanceRef.current
    if (prev !== 'failed' && enhanceStatus === 'failed' && enhanceError) {
      toast.warning('Hậu xử lý làm nét thất bại - giữ bản chroma (chưa enhance).', {
        id: TERMINAL_TOAST_IDS.enhanceFailed,
        description: enhanceError
      })
    }
    prevEnhanceRef.current = enhanceStatus
  }, [enhanceStatus, enhanceError])
}
