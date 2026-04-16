import { useSettingsStore } from '@/application/stores/settings.store'
import { Button } from '@/shared/presentation/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/shared/presentation/components/ui/card'
import { Input } from '@/shared/presentation/components/ui/input'
import { Label } from '@/shared/presentation/components/ui/label'
import type { AppConfig } from '@shared/domain/app-config'
import { useState, type ReactElement } from 'react'
import { toast } from 'sonner'

function SettingsEditor({
  initial,
  onSave
}: {
  initial: AppConfig
  onSave: (partial: Partial<AppConfig>) => Promise<void>
}): ReactElement {
  const [ffmpegPath, setFfmpegPath] = useState<string>(initial.ffmpegPath)
  const [ffprobePath, setFfprobePath] = useState<string>(initial.ffprobePath)

  return (
    <Card className="border-border shadow-none ring-1 ring-white/6">
      <CardHeader className="space-y-1">
        <CardTitle>Công cụ bên ngoài</CardTitle>
        <CardDescription>
          Tham chiếu file mẫu{' '}
          <code className="text-foreground/80">config/ffmpeg.settings.example.json</code> trong
          source để sao chép cấu hình.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ffmpegPath">Đường dẫn ffmpeg</Label>
          <Input
            id="ffmpegPath"
            value={ffmpegPath}
            onChange={(e) => setFfmpegPath(e.target.value)}
            placeholder="ffmpeg"
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ffprobePath">Đường dẫn ffprobe (tuỳ chọn)</Label>
          <Input
            id="ffprobePath"
            value={ffprobePath}
            onChange={(e) => setFfprobePath(e.target.value)}
            placeholder="..."
            spellCheck={false}
          />
        </div>
        <Button
          type="button"
          onClick={async () => {
            try {
              await onSave({ ffmpegPath, ffprobePath })
              toast.success('Đã lưu cài đặt')
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Không thể lưu cài đặt')
            }
          }}
        >
          Lưu
        </Button>
      </CardContent>
    </Card>
  )
}

export function SettingsPage(): ReactElement {
  const config = useSettingsStore((s) => s.config)
  const loaded = useSettingsStore((s) => s.loaded)
  const save = useSettingsStore((s) => s.save)

  return (
    <div className="h-full overflow-auto px-8 py-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cài đặt</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Cấu hình thực thi ffmpeg và ffprobe. Để trống ffprobe khi có thể suy ra từ đường dẫn
            ffmpeg.
          </p>
        </div>

        {!loaded || !config ? (
          <div className="text-sm text-muted-foreground">Đang tải…</div>
        ) : (
          <SettingsEditor
            key={`${config.ffmpegPath}|${config.ffprobePath}`}
            initial={config}
            onSave={save}
          />
        )}
      </div>
    </div>
  )
}
