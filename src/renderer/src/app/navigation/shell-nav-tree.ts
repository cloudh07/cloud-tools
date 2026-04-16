import { linkOptions } from '@tanstack/react-router'

export const chromaVideoLink = linkOptions({ to: '/tools/chroma-video' })
export const videoCompressLink = linkOptions({ to: '/tools/video-compress' })
export const audioExtractLink = linkOptions({ to: '/tools/audio-extract' })
export const imageSmartCropLink = linkOptions({ to: '/tools/image-smart-crop' })
export const imageFormatConvertLink = linkOptions({ to: '/tools/image-format-convert' })
export const settingsLink = linkOptions({ to: '/settings' })

export type ShellNavLeaf = {
  id: string
  label: string
  link:
    | typeof chromaVideoLink
    | typeof videoCompressLink
    | typeof audioExtractLink
    | typeof imageSmartCropLink
    | typeof imageFormatConvertLink
    | typeof settingsLink
}

export type ShellNavGroup = {
  kind: 'group'
  id: string
  label: string
  items: readonly ShellNavLeaf[]
}

export type ShellNavEntry = ShellNavGroup | ({ kind: 'leaf' } & ShellNavLeaf)

export const SHELL_NAV_TREE: readonly ShellNavEntry[] = [
  {
    kind: 'group',
    id: 'tools',
    label: 'Công cụ',
    items: [
      { id: 'chroma-video', label: 'Chroma video', link: chromaVideoLink },
      { id: 'video-compress', label: 'Tối ưu video', link: videoCompressLink },
      { id: 'audio-extract', label: 'Tách âm thanh', link: audioExtractLink },
      { id: 'image-smart-crop', label: 'Auto-Crop ảnh', link: imageSmartCropLink },
      { id: 'image-format-convert', label: 'Đổi định dạng ảnh', link: imageFormatConvertLink }
    ]
  },
  { kind: 'leaf', id: 'settings', label: 'Cài đặt', link: settingsLink }
]
