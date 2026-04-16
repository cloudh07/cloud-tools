import { buildWebpCommand, type TranscodeBuildResult } from './ffmpeg-command-builder'
import type { CompressEncodingPlan } from './video-compress-plan'

export type CompressTranscodeBuildResult = {
  args: string[]
  description: string
}

function transcodeToCompressResult(built: TranscodeBuildResult): CompressTranscodeBuildResult {
  return { args: built.args, description: built.filterDescription }
}

function isMp4Output(outputPath: string): boolean {
  return outputPath.toLowerCase().endsWith('.mp4')
}

export function buildCompressTranscodeArgs(opts: {
  inputPath: string
  outputPath: string
  plan: CompressEncodingPlan
  hasAudio: boolean
}): CompressTranscodeBuildResult {
  const { plan, inputPath, outputPath, hasAudio } = opts
  const args: string[] = ['-hide_banner', '-y', '-i', inputPath]

  if (plan.vf.length > 0) {
    args.push('-vf', plan.vf)
  }

  args.push('-pix_fmt', plan.pixelFmt, '-c:v', plan.ffmpegVideoCodec, ...plan.videoExtraArgs)

  if (hasAudio && plan.audioCodec !== 'none') {
    args.push('-c:a', plan.audioCodec, ...plan.audioExtraArgs)
  } else {
    args.push('-an')
  }

  if (isMp4Output(outputPath)) {
    args.push('-movflags', '+faststart')
  }

  args.push(outputPath)

  const description = `${plan.ffmpegVideoCodec} ${plan.pixelFmt} | ${plan.vf || 'passthrough scale'}`
  return { args, description }
}

export function buildCompressWebpAnimCommand(opts: {
  inputPath: string
  outputPath: string
  plan: CompressEncodingPlan
}): CompressTranscodeBuildResult {
  const { inputPath, outputPath, plan } = opts
  const q = plan.webpQuality ?? 82
  const maxW = plan.webpMaxWidth ?? 1280
  return transcodeToCompressResult(
    buildWebpCommand({
      inputPath,
      outputPath,
      quality: q,
      maxWidth: maxW
    })
  )
}
