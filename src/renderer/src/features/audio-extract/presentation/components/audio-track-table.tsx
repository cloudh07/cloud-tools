import { formatMediaDurationSeconds } from '@/features/video-chroma/presentation/lib/format-media-time'
import type { AudioTrack } from '@shared/domain/audio-extract-job'
import { cn } from '@/shared/lib/utils'
import type { ReactElement } from 'react'

type Props = {
  tracks: AudioTrack[]
  extractAll: boolean
  selectedOrdinal: number
  onSelectOrdinal: (n: number) => void
  disabled: boolean
}

function fmtBitrate(b?: number): string {
  if (b == null || !Number.isFinite(b) || b <= 0) return '-'
  return `${Math.round(b / 1000)} kbps`
}

export function AudioTrackTable({
  tracks,
  extractAll,
  selectedOrdinal,
  onSelectOrdinal,
  disabled
}: Props): ReactElement {
  if (tracks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Chưa có luồng âm thanh (hoặc chưa phân tích).</p>
    )
  }

  return (
    <div className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-md border border-border/80">
      <table className="w-max min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-border/80 bg-muted/30 text-xs font-medium text-muted-foreground">
            <th className="w-10 px-2 py-2">Chọn</th>
            <th className="px-2 py-2">0:a</th>
            <th className="px-2 py-2"># stream</th>
            <th className="px-2 py-2">Codec</th>
            <th className="px-2 py-2">Hz</th>
            <th className="px-2 py-2">CH</th>
            <th className="px-2 py-2">Bitrate</th>
            <th className="px-2 py-2">Thời lượng</th>
            <th className="px-2 py-2">Mặc định</th>
            <th className="px-2 py-2">Ngôn ngữ</th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((t) => {
            const selected = !extractAll && selectedOrdinal === t.audioOrdinal
            return (
              <tr
                key={t.streamIndex}
                className={cn('border-b border-border/50 last:border-0', selected && 'bg-muted/40')}
              >
                <td className="px-2 py-2">
                  <input
                    type="radio"
                    name="audio-track"
                    className="size-4 accent-foreground"
                    checked={selected}
                    disabled={disabled || extractAll}
                    onChange={() => onSelectOrdinal(t.audioOrdinal)}
                    aria-label={`Chọn luồng 0:a:${t.audioOrdinal}`}
                  />
                </td>
                <td className="px-2 py-2 font-mono text-xs tabular-nums">0:a:{t.audioOrdinal}</td>
                <td className="px-2 py-2 tabular-nums">{t.streamIndex}</td>
                <td className="px-2 py-2 font-mono text-xs">{t.codec}</td>
                <td className="px-2 py-2 tabular-nums">{t.sampleRate > 0 ? t.sampleRate : '-'}</td>
                <td className="px-2 py-2 tabular-nums">{t.channels > 0 ? t.channels : '-'}</td>
                <td className="px-2 py-2 text-xs">{fmtBitrate(t.bitrate)}</td>
                <td className="px-2 py-2 text-xs tabular-nums">
                  {t.durationSec != null && t.durationSec > 0
                    ? formatMediaDurationSeconds(t.durationSec)
                    : '-'}
                </td>
                <td className="px-2 py-2 text-xs">{t.isDefault ? 'Có' : ''}</td>
                <td className="px-2 py-2 text-xs">{t.language ?? '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
