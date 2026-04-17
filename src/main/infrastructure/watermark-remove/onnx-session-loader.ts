import { cpus } from 'os'

import type { InferenceSession } from 'onnxruntime-node'

import { getModelFilePath } from '@main/infrastructure/models/model-manager'
import type { WatermarkRemoveModelId } from '@shared/domain/watermark-remove'

type OrtModule = typeof import('onnxruntime-node')

let ortPromise: Promise<OrtModule | null> | null = null
const sessionPromises = new Map<WatermarkRemoveModelId, Promise<InferenceSession>>()

export async function getOrt(): Promise<OrtModule | null> {
  if (!ortPromise) {
    ortPromise = (async () => {
      try {
        return (await import('onnxruntime-node')) as OrtModule
      } catch {
        return null
      }
    })()
  }
  return ortPromise
}

export async function acquireOnnxSession(
  modelId: WatermarkRemoveModelId
): Promise<InferenceSession | null> {
  const existing = sessionPromises.get(modelId)
  if (existing) return existing
  const promise = createSession(modelId).catch((err) => {
    sessionPromises.delete(modelId)
    throw err
  })
  sessionPromises.set(modelId, promise)
  return promise
}

export function disposeOnnxSessions(): void {
  for (const entry of sessionPromises.values()) {
    entry
      .then((session) => {
        try {
          session.release()
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        /* ignore */
      })
  }
  sessionPromises.clear()
}

async function createSession(modelId: WatermarkRemoveModelId): Promise<InferenceSession> {
  const ort = await getOrt()
  if (!ort) throw new Error('onnxruntime-node không khả dụng trong môi trường hiện tại')
  const path = await getModelFilePath(modelId)
  if (!path) throw new Error(`Model ${modelId} chưa được tải về`)
  return ort.InferenceSession.create(path, {
    executionProviders: ['cpu'],
    graphOptimizationLevel: 'all',
    intraOpNumThreads: Math.max(1, Math.floor((cpus()?.length ?? 2) / 2))
  })
}
