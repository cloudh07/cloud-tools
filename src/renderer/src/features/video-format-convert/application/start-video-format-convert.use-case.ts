import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { StartVideoFormatConvertJobRequest } from '@shared/domain/video-format-convert'

export async function startVideoFormatConvertJob(
  req: StartVideoFormatConvertJobRequest
): Promise<{ ok: true }> {
  return getDesktop().startVideoFormatConvertJob(req)
}

export async function cancelVideoFormatConvertJob(jobId: string): Promise<{ ok: true }> {
  return getDesktop().cancelVideoFormatConvertJob(jobId)
}
