import {
  selectShowUpdateIcon,
  useAppUpdateUiStore,
  type UpdatePhase
} from '@/application/stores/app-update-ui.store'
import { getDesktop } from '@/shared/lib/desktop-bridge'
import { Button } from '@/shared/presentation/components/ui/button'
import { Progress } from '@/shared/presentation/components/ui/progress'
import { Spinner } from '@/shared/presentation/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/shared/presentation/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
import { AlertCircle, CheckCircle2, Download } from 'lucide-react'
import { useEffect, useRef, useState, type ReactElement } from 'react'
import { toast } from 'sonner'

type Props = {
  appVersion: string
}

function dialogTitle(phase: UpdatePhase): string {
  switch (phase) {
    case 'checking':
      return 'Đang kiểm tra cập nhật…'
    case 'update-available':
      return 'Đã tìm thấy bản cập nhật'
    case 'downloading':
      return 'Đang tải bản cập nhật'
    case 'downloaded':
      return 'Sẵn sàng cài đặt'
    case 'installing':
      return 'Đang cài đặt…'
    case 'failed':
      return 'Không thể cập nhật'
    default:
      return 'Cập nhật ứng dụng'
  }
}

type TriggerIconProps = {
  phase: UpdatePhase
}

function TriggerIcon({ phase }: TriggerIconProps): ReactElement {
  if (phase === 'downloading' || phase === 'update-available' || phase === 'installing') {
    return <Spinner className="size-4" aria-hidden />
  }
  if (phase === 'failed') {
    return <AlertCircle className="size-4" aria-hidden />
  }
  return <Download className="size-4" aria-hidden />
}

type DialogBodyProps = {
  phase: UpdatePhase
  version: string | null
  downloadPercent: number
  errorMessage: string | null
  appVersion: string
  checking: boolean
  onCheck: () => void
  onInstall: () => void
  onClose: () => void
}

function DialogBody({
  phase,
  version,
  downloadPercent,
  errorMessage,
  appVersion,
  checking,
  onCheck,
  onInstall,
  onClose
}: DialogBodyProps): ReactElement {
  if (phase === 'checking') {
    return (
      <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
        <Spinner className="size-4 shrink-0" aria-hidden />
        <span>Đang kết nối máy chủ cập nhật…</span>
      </div>
    )
  }

  if (phase === 'update-available' || phase === 'downloading') {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Phiên bản{' '}
          {version ? <span className="font-medium text-foreground">{version}</span> : 'mới'} đang
          được tải về tự động.
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Spinner className="size-3.5" aria-hidden />
              Đang tải…
            </span>
            <span className="tabular-nums">{downloadPercent}%</span>
          </div>
          <Progress value={downloadPercent} className="h-1.5" />
        </div>
      </div>
    )
  }

  if (phase === 'downloaded') {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Phiên bản <span className="font-medium text-foreground">{version}</span> đã tải xong.
            Ứng dụng sẽ khởi động lại sau khi cài đặt.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Để sau
          </Button>
          <Button type="button" size="sm" onClick={onInstall}>
            Cài đặt ngay
          </Button>
        </div>
      </div>
    )
  }

  if (phase === 'installing') {
    return (
      <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground">
        <Spinner className="size-4 shrink-0" aria-hidden />
        <span>Đang cài đặt, ứng dụng sẽ tắt và khởi động lại…</span>
      </div>
    )
  }

  if (phase === 'failed') {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {errorMessage ?? 'Đã xảy ra lỗi không xác định.'}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Đóng
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={checking} onClick={onCheck}>
            {checking ? <Spinner className="mr-2 size-3.5" aria-hidden /> : null}
            Thử lại
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Phiên bản hiện tại: <span className="font-medium text-foreground/90">{appVersion}</span>
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Đóng
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={checking} onClick={onCheck}>
          {checking ? <Spinner className="mr-2 size-3.5" aria-hidden /> : null}
          {checking ? 'Đang kiểm tra…' : 'Kiểm tra'}
        </Button>
      </div>
    </div>
  )
}

export function ShellAppUpdate({ appVersion }: Props): ReactElement {
  const phase = useAppUpdateUiStore((s) => s.phase)
  const version = useAppUpdateUiStore((s) => s.version)
  const downloadPercent = useAppUpdateUiStore((s) => s.downloadPercent)
  const errorMessage = useAppUpdateUiStore((s) => s.errorMessage)
  const applyEvent = useAppUpdateUiStore((s) => s.applyEvent)
  const markInstalling = useAppUpdateUiStore((s) => s.markInstalling)
  const showIcon = useAppUpdateUiStore(selectShowUpdateIcon)

  const [open, setOpen] = useState<boolean>(false)
  const [checking, setChecking] = useState<boolean>(false)

  const prevPhaseRef = useRef<UpdatePhase>(phase)
  useEffect(() => {
    if (prevPhaseRef.current !== 'downloaded' && phase === 'downloaded') {
      toast.success('Đã tải xong bản cập nhật. Sẵn sàng cài đặt.', { duration: 6000 })
      setOpen(true)
    }
    prevPhaseRef.current = phase
  }, [phase])

  useEffect(() => {
    try {
      const desktop = getDesktop()
      return desktop.onAppUpdateEvent((ev) => {
        applyEvent(ev)
        if (ev.type === 'error') {
          toast.error(`Lỗi cập nhật: ${ev.message}`)
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
        toast.message('Chế độ dev - không kiểm tra cập nhật (chỉ bản đã đóng gói).')
        return
      }
      if (!r.ok) {
        toast.error(r.message)
      }
    } finally {
      setChecking(false)
    }
  }

  const onInstall = async (): Promise<void> => {
    markInstalling()
    const r = await getDesktop().installAppUpdate()
    if (!r.ok && r.reason === 'not_packaged') {
      toast.message('Chỉ khả dụng trên bản đã đóng gói.')
    }
  }

  const showTooltip = phase === 'downloaded' || phase === 'failed'

  const triggerButton = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'size-8 shrink-0 p-0',
        phase === 'downloaded' && 'text-emerald-500 hover:text-emerald-400',
        phase === 'failed' && 'text-destructive hover:text-destructive/80',
        (phase === 'downloading' || phase === 'update-available') && 'text-primary'
      )}
      aria-label={dialogTitle(phase)}
    >
      <TriggerIcon phase={phase} />
    </Button>
  )

  return (
    <div className="flex items-center justify-between gap-2 border-t border-border/80 px-4 py-3">
      <p className="min-w-0 flex-1 truncate text-xs leading-snug text-muted-foreground">
        Version <span className="tabular-nums text-foreground/90">{appVersion}</span>
      </p>

      {showIcon ? (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <TooltipProvider delayDuration={300}>
            {showTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Dialog.Trigger asChild>{triggerButton}</Dialog.Trigger>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {phase === 'downloaded'
                    ? 'Cập nhật sẵn sàng - bấm để cài đặt'
                    : 'Lỗi cập nhật - bấm để xem chi tiết'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Dialog.Trigger asChild>{triggerButton}</Dialog.Trigger>
            )}
          </TooltipProvider>

          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Dialog.Content
              className={cn(
                'fixed top-1/2 left-1/2 z-50 w-[min(100vw-2rem,22rem)] -translate-x-1/2 -translate-y-1/2',
                'rounded-xl border border-border bg-card shadow-lg',
                'data-[state=open]:animate-in data-[state=closed]:animate-out',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
              )}
            >
              <div className="space-y-4 p-6">
                <Dialog.Title className="text-base font-semibold leading-none tracking-tight">
                  {dialogTitle(phase)}
                </Dialog.Title>

                <DialogBody
                  phase={phase}
                  version={version}
                  downloadPercent={downloadPercent}
                  errorMessage={errorMessage}
                  appVersion={appVersion}
                  checking={checking}
                  onCheck={() => void onCheck()}
                  onInstall={() => void onInstall()}
                  onClose={() => setOpen(false)}
                />
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </div>
  )
}
