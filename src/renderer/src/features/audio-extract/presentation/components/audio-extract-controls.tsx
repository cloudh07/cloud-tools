import { Checkbox } from '@/shared/presentation/components/ui/checkbox'
import { Label } from '@/shared/presentation/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/shared/presentation/components/ui/select'
import { AudioExtractFormat } from '@shared/domain/audio-extract-job'
import type { ReactElement } from 'react'

type Props = {
  format: AudioExtractFormat
  onFormat: (f: AudioExtractFormat) => void
  preferCopy: boolean
  onPreferCopy: (v: boolean) => void
  extractAll: boolean
  onExtractAll: (v: boolean) => void
  disabled: boolean
}

const FORMATS = [
  AudioExtractFormat.M4A,
  AudioExtractFormat.MP3,
  AudioExtractFormat.WAV,
  AudioExtractFormat.FLAC,
  AudioExtractFormat.OPUS,
  AudioExtractFormat.OGG
] as const

function formatLabel(f: AudioExtractFormat): string {
  switch (f) {
    case AudioExtractFormat.M4A:
      return 'M4A (AAC)'
    case AudioExtractFormat.MP3:
      return 'MP3'
    case AudioExtractFormat.WAV:
      return 'WAV (PCM s16)'
    case AudioExtractFormat.FLAC:
      return 'FLAC'
    case AudioExtractFormat.OPUS:
      return 'Opus'
    case AudioExtractFormat.OGG:
      return 'Ogg (Vorbis)'
    default:
      return f
  }
}

export function AudioExtractControls({
  format,
  onFormat,
  preferCopy,
  onPreferCopy,
  extractAll,
  onExtractAll,
  disabled
}: Props): ReactElement {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Định dạng đầu ra</Label>
        <Select
          value={format}
          onValueChange={(v) => onFormat(v as AudioExtractFormat)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {formatLabel(f)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col justify-end gap-3 rounded-lg border border-border/80 bg-background/40 px-4 py-3 sm:col-span-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="audio-extract-prefer-copy"
            checked={preferCopy}
            disabled={disabled}
            onCheckedChange={(v) => onPreferCopy(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="audio-extract-prefer-copy"
            className="cursor-pointer text-sm font-normal leading-snug peer-disabled:cursor-not-allowed"
          >
            Ưu tiên stream copy (không re-encode) khi container khớp codec
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="audio-extract-all-tracks"
            checked={extractAll}
            disabled={disabled}
            onCheckedChange={(v) => onExtractAll(v === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="audio-extract-all-tracks"
            className="cursor-pointer text-sm font-normal leading-snug peer-disabled:cursor-not-allowed"
          >
            Xuất tất cả luồng âm thanh (một tệp mỗi luồng, map 0:a:N rõ ràng)
          </Label>
        </div>
      </div>
    </div>
  )
}
