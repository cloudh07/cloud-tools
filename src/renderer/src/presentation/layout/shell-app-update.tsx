import {
  selectAppUpdateSidebarIconVisible,
  useAppUpdateUiStore
} from '@/application/stores/app-update-ui.store'
import { getDesktop } from '@/shared/lib/desktop-bridge'
import { Button } from '@/shared/presentation/components/ui/button'
import { cn } from '@/shared/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, Loader2 } from 'lucide-react'
import { useEffect, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

type ShellAppUpdateProps = {
  appVersion: string
}

export function ShellAppUpdate({ appVersion }: ShellAppUpdateProps): ReactElement {
  const applyEvent = useAppUpdateUiStore((s) => s.applyEvent)
  const incomingVersion = useAppUpdateUiStore((s) => s.incomingVersion)
  const readyInstallVersion = useAppUpdateUiStore((s) => s.readyInstallVersion)
  const downloadPercent = useAppUpdateUiStore((s) => s.downloadPercent)
  const lastHint = useAppUpdateUiStore((s) => s.lastHint)
  const lastError = useAppUpdateUiStore((s) => s.lastError)
  const showIcon = useAppUpdateUiStore(selectAppUpdateSidebarIconVisible)

  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    try {
      const desktop = getDesktop()
      return desktop.onAppUpdateEvent((ev) => {
        applyEvent(ev)
        if (ev.type === 'error') {
          toast.error(ev.message)
        }
      })
    } catch {
      return
    }
  }, [applyEvent])

  const onCheck = async (): Promise<void> => {
    setChecking(true)
    try {
      const r = await getDesktop().checkForAppUpdate()
      if ('skipped' in r && r.skipped === 'not_packaged') {
        toast.message('Chế độ dev: không kiểm tra cập nhật (chỉ bản cài đặt).')
        return
      }
      if (!r.ok) {
        toast.error(r.message)
      }
    } finally {
      setChecking(false)
    }
  }

  const onRestart = async (): Promise<void> => {
    const r = await getDesktop().installAppUpdate()
    if (!r.ok && r.reason === 'not_packaged') {
      toast.message('Chỉ khả dụng trên bản đã đóng gói.')
    }
  }

  const busyDownload = incomingVersion != null && downloadPercent != null && downloadPercent < 100

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-t border-border/80 px-4 py-3">
        <p className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
          Version <span className="tabular-nums text-foreground/90">{appVersion}</span>
        </p>
        {showIcon ? (
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 p-0 text-primary"
                aria-label="Cập nhật ứng dụng"
                title="Cập nhật ứng dụng"
              >
                {busyDownload ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Download className="size-4" aria-hidden />
                )}
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
              <Dialog.Content
                className={cn(
                  'fixed top-1/2 left-1/2 z-50 w-[min(100vw-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-lg',
                  'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                )}
              >
                <Dialog.Title className="text-lg font-semibold leading-none tracking-tight">
                  Cập nhật ứng dụng
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                  Phiên bản hiện tại:{' '}
                  <span className="font-medium text-foreground/90">{appVersion}</span>. Kênh cập
                  nhật theo cấu hình đóng gói (electron-updater).
                </Dialog.Description>
                <div className="mt-4 space-y-3">
                  {lastHint ? <p className="text-sm text-muted-foreground">{lastHint}</p> : null}
                  {lastError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {lastError}
                    </p>
                  ) : null}
                  {downloadPercent != null ? (
                    <p className="text-sm tabular-nums text-muted-foreground">
                      Tiến độ tải: {downloadPercent}%
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={checking}
                      onClick={() => void onCheck()}
                    >
                      {checking ? 'Đang gửi…' : 'Kiểm tra cập nhật'}
                    </Button>
                    {readyInstallVersion ? (
                      <Button type="button" size="sm" onClick={() => void onRestart()}>
                        Khởi động lại ({readyInstallVersion})
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Dialog.Close asChild>
                  <Button type="button" variant="ghost" size="sm" className="mt-4 w-full">
                    Đóng
                  </Button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        ) : null}
      </div>
    </>
  )
}
