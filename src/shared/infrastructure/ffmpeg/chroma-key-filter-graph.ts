import { ChromaKeyingKind } from '@shared/domain/chroma-keying-kind'

export type ChromaKeyFilterParams = {
  keyingKind: ChromaKeyingKind
  keyColor: string
  similarity: number
  blend: number
}

export function buildKeyedRgbaFromInput0(p: ChromaKeyFilterParams): string {
  const head = '[0:v]setpts=PTS-STARTPTS'
  if (p.keyingKind === ChromaKeyingKind.STUDIO_CHROMA) {
    return `${head},chromakey=${p.keyColor}:${p.similarity}:${p.blend},format=rgba[ck]`
  }
  if (p.keyingKind === ChromaKeyingKind.SOLID_RGB) {
    return `${head},colorkey=${p.keyColor}:${p.similarity}:${p.blend},format=rgba[ck]`
  }
  const _bad: never = p.keyingKind
  throw new Error(`Unsupported keying kind: ${String(_bad)}`)
}

export function buildGreenscreenPlateFilterComplex(p: ChromaKeyFilterParams): string {
  return [
    buildKeyedRgbaFromInput0(p),
    '[1:v]setpts=PTS-STARTPTS[bg]',
    '[bg][ck]overlay=shortest=1:format=yuv420[outv]'
  ].join(';')
}

export function buildAlphaMovFilterComplex(p: ChromaKeyFilterParams): string {
  const head = '[0:v]setpts=PTS-STARTPTS'
  if (p.keyingKind === ChromaKeyingKind.STUDIO_CHROMA) {
    return `${head},chromakey=${p.keyColor}:${p.similarity}:${p.blend},format=yuva420p[outv]`
  }
  if (p.keyingKind === ChromaKeyingKind.SOLID_RGB) {
    return `${head},colorkey=${p.keyColor}:${p.similarity}:${p.blend},format=yuva420p[outv]`
  }
  const _bad: never = p.keyingKind
  throw new Error(`Unsupported keying kind: ${String(_bad)}`)
}
