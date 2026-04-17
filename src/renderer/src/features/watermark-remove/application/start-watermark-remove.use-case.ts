import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { StartWatermarkRemoveBatchRequest } from '@shared/domain/watermark-remove'

export async function startWatermarkRemoveBatch(
  req: StartWatermarkRemoveBatchRequest
): Promise<{ ok: true }> {
  return getDesktop().startWatermarkRemoveBatch(req)
}

export async function cancelWatermarkRemoveBatch(batchId: string): Promise<{ ok: true }> {
  return getDesktop().cancelWatermarkRemoveBatch(batchId)
}
