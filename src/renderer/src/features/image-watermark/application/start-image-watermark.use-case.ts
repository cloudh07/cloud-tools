import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { StartImageWatermarkBatchRequest } from '@shared/domain/image-watermark'

export async function startImageWatermarkBatch(
  req: StartImageWatermarkBatchRequest
): Promise<{ ok: true }> {
  return getDesktop().startImageWatermarkBatch(req)
}

export async function cancelImageWatermarkBatch(batchId: string): Promise<{ ok: true }> {
  return getDesktop().cancelImageWatermarkBatch(batchId)
}
