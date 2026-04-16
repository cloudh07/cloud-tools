import { cn } from '@/shared/lib/utils'
import { motion } from 'motion/react'
import { FileImage, Film, Images, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

export type ImageFormatConvertMode = 'single' | 'batch'

export type FormatConvertWorkspaceTab = 'video' | 'image-single' | 'image-batch'

export type FormatConvertWorkspaceTabsProps = {
  value: FormatConvertWorkspaceTab
  onValueChange: (tab: FormatConvertWorkspaceTab) => void
  disabledVideo?: boolean
  disabledImageSingle?: boolean
  disabledImageBatch?: boolean
  className?: string
}

const TABS: readonly {
  id: FormatConvertWorkspaceTab
  label: string
  hint: string
  Icon: LucideIcon
}[] = [
  {
    id: 'video',
    label: 'Video',
    hint: 'ffmpeg · ffprobe',
    Icon: Film
  },
  {
    id: 'image-single',
    label: 'Ảnh · một tệp',
    hint: 'Sharp',
    Icon: FileImage
  },
  {
    id: 'image-batch',
    label: 'Ảnh · hàng loạt',
    hint: 'Hàng đợi',
    Icon: Images
  }
]

function tabDisabled(
  id: FormatConvertWorkspaceTab,
  p: Pick<
    FormatConvertWorkspaceTabsProps,
    'disabledVideo' | 'disabledImageSingle' | 'disabledImageBatch'
  >
): boolean {
  switch (id) {
    case 'video':
      return p.disabledVideo === true
    case 'image-single':
      return p.disabledImageSingle === true
    case 'image-batch':
      return p.disabledImageBatch === true
    default:
      return false
  }
}

export function FormatConvertWorkspaceTabs({
  value,
  onValueChange,
  disabledVideo = false,
  disabledImageSingle = false,
  disabledImageBatch = false,
  className
}: FormatConvertWorkspaceTabsProps): ReactElement {
  return (
    <div
      className={cn(
        'w-full max-w-3xl rounded-xl border border-border/70 bg-muted/35 p-1.5 shadow-sm ring-1 ring-black/4 dark:ring-white/6',
        className
      )}
      role="tablist"
      aria-label="Chế độ công cụ đổi định dạng"
    >
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:grid-rows-1">
        {TABS.map((tab) => {
          const isActive = value === tab.id
          const Icon = tab.Icon
          const disabled = tabDisabled(tab.id, {
            disabledVideo,
            disabledImageSingle,
            disabledImageBatch
          })
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => onValueChange(tab.id)}
              className={cn(
                'relative flex w-full min-w-0 min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center sm:min-h-13 sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:pointer-events-none disabled:opacity-50',
                !isActive &&
                  'text-muted-foreground hover:bg-black/6 dark:text-white/90 dark:hover:bg-white/10'
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId="format-convert-workspace-pill"
                  className="absolute inset-0 z-0 rounded-lg bg-white shadow-md ring-1 ring-black/8 dark:bg-white"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.48 }}
                />
              ) : null}
              <Icon
                className={cn(
                  'relative z-1 size-4 shrink-0 sm:size-4.5',
                  isActive ? 'text-zinc-950' : 'opacity-90'
                )}
                aria-hidden
              />
              <span className="relative z-1 flex min-w-0 flex-col items-center gap-0 sm:items-start">
                <span
                  className={cn(
                    'text-sm font-semibold leading-tight tracking-tight',
                    isActive ? 'text-zinc-950' : undefined
                  )}
                >
                  {tab.label}
                </span>
                <span
                  className={cn(
                    'hidden text-[11px] leading-snug sm:block',
                    isActive ? 'text-zinc-600' : 'text-muted-foreground dark:text-white/65'
                  )}
                >
                  {tab.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
