import {
  ChromaEnhancePreset,
  type ChromaEnhanceStrength,
  type ChromaEnhancePreset as ChromaEnhancePresetId
} from '@shared/domain/chroma-enhance'

const PRESET_TABLE: Record<ChromaEnhancePresetId, ChromaEnhanceStrength> = {
  [ChromaEnhancePreset.LIGHT]: {
    dnLumaSpatial: 2,
    dnChromaSpatial: 1.5,
    dnLumaTemporal: 3,
    dnChromaTemporal: 2.25,
    unsharpLumaMsize: 3,
    unsharpLumaAmount: 0.35,
    unsharpChromaMsize: 3,
    unsharpChromaAmount: 0.1
  },
  [ChromaEnhancePreset.BALANCED]: {
    dnLumaSpatial: 4,
    dnChromaSpatial: 3,
    dnLumaTemporal: 6,
    dnChromaTemporal: 4.5,
    unsharpLumaMsize: 5,
    unsharpLumaAmount: 0.48,
    unsharpChromaMsize: 5,
    unsharpChromaAmount: 0.16
  },
  [ChromaEnhancePreset.STRONG]: {
    dnLumaSpatial: 6,
    dnChromaSpatial: 4,
    dnLumaTemporal: 8,
    dnChromaTemporal: 6,
    unsharpLumaMsize: 5,
    unsharpLumaAmount: 0.58,
    unsharpChromaMsize: 5,
    unsharpChromaAmount: 0.22
  }
}

export function resolveChromaEnhanceStrength(preset: ChromaEnhancePresetId): ChromaEnhanceStrength {
  return PRESET_TABLE[preset]
}

export function buildHqdn3dFilter(s: ChromaEnhanceStrength): string {
  const a = s.dnLumaSpatial
  const b = s.dnChromaSpatial
  const c = s.dnLumaTemporal
  const d = s.dnChromaTemporal
  return `hqdn3d=${a}:${b}:${c}:${d}`
}

export function buildUnsharpFilter(s: ChromaEnhanceStrength): string {
  const lx = s.unsharpLumaMsize
  const ly = s.unsharpLumaMsize
  const la = s.unsharpLumaAmount
  const cx = s.unsharpChromaMsize
  const cy = s.unsharpChromaMsize
  const ca = s.unsharpChromaAmount
  return `unsharp=luma_msize_x=${lx}:luma_msize_y=${ly}:luma_amount=${la}:chroma_msize_x=${cx}:chroma_msize_y=${cy}:chroma_amount=${ca}`
}

export function buildChromaEnhanceVfForGreenScreen(preset: ChromaEnhancePresetId): string {
  const s = resolveChromaEnhanceStrength(preset)
  return `${buildHqdn3dFilter(s)},${buildUnsharpFilter(s)}`
}

export function buildChromaEnhanceFilterComplexForAlpha(preset: ChromaEnhancePresetId): string {
  const s = resolveChromaEnhanceStrength(preset)
  const hq = buildHqdn3dFilter(s)
  const us = buildUnsharpFilter(s)
  return `[0:v]split=2[color_src][alpha_src];[alpha_src]alphaextract[alpha];[color_src]format=yuv444p,${hq},${us}[yuv];[yuv][alpha]alphamerge,format=yuva444p10le[outv]`
}

export function describeChromaEnhancePreset(preset: ChromaEnhancePresetId): string {
  switch (preset) {
    case ChromaEnhancePreset.LIGHT:
      return 'Denoise rất nhẹ + sharpen rất nhẹ (luma chủ đạo)'
    case ChromaEnhancePreset.BALANCED:
      return 'Denoise vừa + sharpen vừa'
    case ChromaEnhancePreset.STRONG:
      return 'Denoise/sharpen mạnh hơn nhưng vẫn trong ngưỡng an toàn'
  }
}
