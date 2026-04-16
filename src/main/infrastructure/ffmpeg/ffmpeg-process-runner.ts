import { type ChildProcessWithoutNullStreams, spawn } from 'child_process'
import { mapFfmpegSpawnError } from '@main/infrastructure/ffmpeg/ffmpeg-runner'
import { computeProgressRatio, parseFfmpegTimeSeconds } from './ffmpeg-progress-parser'

export type RunnerHandlers = {
  onLog: (line: string) => void
  onProgress: (payload: { ratio: number; currentTimeSec?: number }) => void
}

export async function runFfmpeg(
  args: string[],
  ctx: { ffmpegPath: string; signal: AbortSignal }
): Promise<void> {
  await runFfmpegWithHandlers(
    args,
    { ffmpegPath: ctx.ffmpegPath, signal: ctx.signal },
    {
      onLog: () => {},
      onProgress: () => {},
      totalDurationSec: null
    }
  )
}

export async function runFfmpegWithHandlers(
  args: string[],
  ctx: { ffmpegPath: string; signal: AbortSignal },
  handlers: RunnerHandlers & {
    totalDurationSec: number | null | undefined
    onSpawn?: (child: ChildProcessWithoutNullStreams) => void
  }
): Promise<void> {
  const child = spawn(ctx.ffmpegPath, args, { windowsHide: true }) as ChildProcessWithoutNullStreams
  handlers.onSpawn?.(child)

  if (ctx.signal.aborted) {
    child.kill('SIGTERM')
    throw new Error('Aborted')
  }

  const abortListener = (): void => {
    child.kill('SIGTERM')
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL')
    }, 1500).unref?.()
  }
  ctx.signal.addEventListener('abort', abortListener, { once: true })

  const consume = (chunk: string, buffer: { value: string }): void => {
    buffer.value += chunk
    let idx = buffer.value.indexOf('\n')
    while (idx >= 0) {
      const line = buffer.value.slice(0, idx).trimEnd()
      buffer.value = buffer.value.slice(idx + 1)
      if (line.length > 0) handlers.onLog(line)
      const t = parseFfmpegTimeSeconds(line)
      if (t != null) {
        handlers.onProgress({
          currentTimeSec: t,
          ratio: computeProgressRatio(t, handlers.totalDurationSec)
        })
      }
      idx = buffer.value.indexOf('\n')
    }
  }

  const errBuf = { value: '' }
  const outBuf = { value: '' }

  child.stderr.on('data', (d) => consume(String(d), errBuf))
  child.stdout.on('data', (d) => consume(String(d), outBuf))

  const exitCode: number = await new Promise((resolvePromise, reject) => {
    child.on('error', (err) => {
      reject(mapFfmpegSpawnError(err))
    })
    child.on('close', (code) => resolvePromise(code ?? 1))
  })

  ctx.signal.removeEventListener('abort', abortListener)

  if (errBuf.value.trim().length > 0) handlers.onLog(errBuf.value.trimEnd())
  if (outBuf.value.trim().length > 0) handlers.onLog(outBuf.value.trimEnd())

  if (ctx.signal.aborted) {
    throw new Error('Cancelled')
  }
  if (exitCode !== 0) {
    throw new Error(`ffmpeg failed with exit code ${exitCode}`)
  }
}
