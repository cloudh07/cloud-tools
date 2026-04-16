import { spawn } from 'child_process'

import { mapSpawnErrorToMediaBinary } from '@main/infrastructure/ffmpeg/spawn-binary-error'

export function runFfprobeCapture(
  ffprobePath: string,
  argsBeforeInput: string[],
  inputPath: string
): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(ffprobePath, [...argsBeforeInput, inputPath], { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += String(d)
    })
    child.stderr.on('data', (d) => {
      stderr += String(d)
    })
    child.on('error', (err) => {
      reject(mapSpawnErrorToMediaBinary('ffprobe', err))
    })
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout)
      else reject(new Error(stderr.trim() || `ffprobe exited with code ${code}`))
    })
  })
}
