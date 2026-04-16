import { getDesktop } from '@/shared/lib/desktop-bridge'
import type { StartImageFormatConvertBatchRequest } from '@shared/domain/image-format-convert'

export async function startImageFormatConvertBatch(
  req: StartImageFormatConvertBatchRequest
): Promise<{ ok: true }> {
  return getDesktop().startImageFormatConvertBatch(req)
}

export async function cancelImageFormatConvertBatch(batchId: string): Promise<{ ok: true }> {
  return getDesktop().cancelImageFormatConvertBatch(batchId)
}
