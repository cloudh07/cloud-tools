import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { StartAudioExtractBatchRequest } from '@shared/domain/audio-extract-job'

export async function startAudioExtractBatch(req: StartAudioExtractBatchRequest): Promise<void> {
  await getDesktop().startAudioExtractBatch(req)
}

export async function cancelAudioExtractJob(jobId: string): Promise<void> {
  await getDesktop().cancelAudioExtractJob(jobId)
}
