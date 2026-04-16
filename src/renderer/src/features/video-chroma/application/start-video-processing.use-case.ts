import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { StartVideoJobRequest } from '@shared/domain/video-job'

export async function startVideoProcessing(request: StartVideoJobRequest): Promise<void> {
  await getDesktop().startVideoJob(request)
}

export async function cancelVideoProcessing(jobId: string): Promise<void> {
  await getDesktop().cancelVideoJob(jobId)
}
