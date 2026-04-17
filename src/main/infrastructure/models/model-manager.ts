import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  statSync,
  createReadStream,
  createWriteStream,
  renameSync,
  unlinkSync
} from 'fs'
import { dirname, join } from 'path'

import { app, net, type BrowserWindow } from 'electron'

import { IpcChannels } from '@shared/constants/ipc-channels'
import type {
  WatermarkRemoveModelEvent,
  WatermarkRemoveModelId,
  WatermarkRemoveModelStatus
} from '@shared/domain/watermark-remove'

type ModelManifestEntry = {
  id: WatermarkRemoveModelId
  fileName: string
  url: string
  sha256: string
  sizeBytes: number
}

const MODEL_MANIFEST: Record<WatermarkRemoveModelId, ModelManifestEntry> = {
  'lama-inpaint': {
    id: 'lama-inpaint',
    fileName: 'lama-fp32.onnx',
    url: 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx?download=true',
    sha256: '',
    sizeBytes: 207_000_000
  },
  'u2net-detect': {
    id: 'u2net-detect',
    fileName: 'u2netp.onnx',
    url: 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx',
    sha256: '',
    sizeBytes: 4_700_000
  }
}

let mainWindowGetter: (() => BrowserWindow | null) | null = null
const downloadingState = new Map<WatermarkRemoveModelId, Promise<void>>()

export function configureModelManager(getter: () => BrowserWindow | null): void {
  mainWindowGetter = getter
}

function emit(event: WatermarkRemoveModelEvent): void {
  const win = mainWindowGetter?.()
  if (!win || win.isDestroyed()) return
  win.webContents.send(IpcChannels.WATERMARK_REMOVE_MODEL_EVENT, event)
}

function modelsDir(): string {
  const dir = join(app.getPath('userData'), 'models', 'watermark-remove')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function modelFilePath(id: WatermarkRemoveModelId): string {
  return join(modelsDir(), MODEL_MANIFEST[id].fileName)
}

export async function isModelReady(id: WatermarkRemoveModelId): Promise<boolean> {
  const path = modelFilePath(id)
  if (!existsSync(path)) return false
  try {
    const st = statSync(path)
    if (!st.isFile() || st.size === 0) return false
    const expected = MODEL_MANIFEST[id].sha256
    if (!expected) return true
    const actual = await sha256OfFile(path)
    return actual === expected
  } catch {
    return false
  }
}

export async function getModelFilePath(id: WatermarkRemoveModelId): Promise<string | null> {
  return (await isModelReady(id)) ? modelFilePath(id) : null
}

export async function getModelStatus(
  id: WatermarkRemoveModelId
): Promise<WatermarkRemoveModelStatus> {
  const downloading = downloadingState.has(id)
  if (downloading) {
    return {
      id,
      state: 'downloading',
      bytesDownloaded: 0,
      bytesTotal: MODEL_MANIFEST[id].sizeBytes,
      errorMessage: null
    }
  }
  const ready = await isModelReady(id)
  return {
    id,
    state: ready ? 'ready' : 'missing',
    bytesDownloaded: ready ? MODEL_MANIFEST[id].sizeBytes : 0,
    bytesTotal: MODEL_MANIFEST[id].sizeBytes,
    errorMessage: null
  }
}

export async function deleteModel(id: WatermarkRemoveModelId): Promise<void> {
  const path = modelFilePath(id)
  if (existsSync(path)) {
    try {
      unlinkSync(path)
    } catch (err) {
      throw new Error(`Không xóa được model: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
  const partialPath = `${path}.part`
  if (existsSync(partialPath)) {
    try {
      unlinkSync(partialPath)
    } catch {
      // ignore
    }
  }
}

export async function startModelDownload(id: WatermarkRemoveModelId): Promise<void> {
  if (await isModelReady(id)) return
  const inflight = downloadingState.get(id)
  if (inflight) return inflight
  const promise = downloadModel(id).finally(() => downloadingState.delete(id))
  downloadingState.set(id, promise)
  return promise
}

async function downloadModel(id: WatermarkRemoveModelId): Promise<void> {
  const entry = MODEL_MANIFEST[id]
  const finalPath = modelFilePath(id)
  const partialPath = `${finalPath}.part`
  mkdirSync(dirname(finalPath), { recursive: true })
  let bytesDownloaded = 0
  if (existsSync(partialPath)) {
    try {
      bytesDownloaded = statSync(partialPath).size
    } catch {
      bytesDownloaded = 0
    }
  }

  const totalGuess = entry.sizeBytes
  emit({ type: 'progress', id, bytesDownloaded, bytesTotal: totalGuess })

  await new Promise<void>((resolve, reject) => {
    const req = net.request({ method: 'GET', url: entry.url, redirect: 'follow' })
    req.setHeader('Accept', 'application/octet-stream, */*;q=0.8')
    req.setHeader('User-Agent', 'cloud-tools/1.0 (+electron)')
    if (bytesDownloaded > 0) req.setHeader('Range', `bytes=${bytesDownloaded}-`)

    let writeStream: ReturnType<typeof createWriteStream> | null = null
    const fail = (err: Error, dropPartial: boolean): void => {
      if (writeStream) writeStream.destroy()
      if (dropPartial) removeIfExists(partialPath)
      reject(err)
    }

    req.on('response', (response) => {
      const status = response.statusCode
      if (status !== 200 && status !== 206) {
        response.removeAllListeners('data')
        fail(new Error(formatDownloadError(id, status, entry.url)), status >= 400 && status < 500)
        return
      }
      const reportedTotal = parseContentLength(response.headers['content-length'])
      const totalBytes = reportedTotal > 0 ? reportedTotal + bytesDownloaded : totalGuess
      writeStream = createWriteStream(partialPath, { flags: bytesDownloaded > 0 ? 'a' : 'w' })
      writeStream.on('error', (err) => fail(err, false))
      response.on('data', (chunk: Buffer) => {
        bytesDownloaded += chunk.byteLength
        writeStream?.write(chunk)
        emit({ type: 'progress', id, bytesDownloaded, bytesTotal: totalBytes })
      })
      response.on('end', () => {
        writeStream?.end(() => {
          verifyAndCommit(id, partialPath, finalPath)
            .then(() => {
              emit({ type: 'completed', id })
              resolve()
            })
            .catch((err: Error) => fail(err, true))
        })
      })
      response.on('error', (err) => fail(err, false))
    })
    req.on('error', (err) => fail(err, false))
    req.end()
  }).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    emit({ type: 'failed', id, message: msg })
    throw err
  })
}

function parseContentLength(header: string | string[] | undefined): number {
  const raw = Array.isArray(header) ? header[0] : header
  const value = Number(raw ?? 0)
  return Number.isFinite(value) && value > 0 ? value : 0
}

function removeIfExists(path: string): void {
  if (!existsSync(path)) return
  try {
    unlinkSync(path)
  } catch {
    // ignore
  }
}

function formatDownloadError(id: WatermarkRemoveModelId, status: number, url: string): string {
  if (status === 401 || status === 403) {
    return `HTTP ${status} khi tải model ${id}: nguồn yêu cầu xác thực hoặc bị chặn. URL: ${url}`
  }
  if (status === 404) {
    return `HTTP 404: không tìm thấy model ${id} tại ${url}`
  }
  return `HTTP ${status} khi tải model ${id}`
}

async function verifyAndCommit(
  id: WatermarkRemoveModelId,
  partialPath: string,
  finalPath: string
): Promise<void> {
  const expected = MODEL_MANIFEST[id].sha256
  if (expected) {
    const actual = await sha256OfFile(partialPath)
    if (actual !== expected) {
      try {
        unlinkSync(partialPath)
      } catch {
        // ignore
      }
      throw new Error(`SHA256 không khớp cho model ${id}`)
    }
  }
  renameSync(partialPath, finalPath)
}

function sha256OfFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}
