import { cn } from '@/shared/lib/utils'
import { motion } from 'motion/react'
import { FileImage, Images, type LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

export type ImageFormatConvertMode = 'single' | 'batch'

export type ImageFormatConvertAnimatedModeTabsProps = {
  value: ImageFormatConvertMode
  onValueChange: (mode: ImageFormatConvertMode) => void
  disabled?: boolean
  className?: string
}

const MODES: readonly {
  id: ImageFormatConvertMode
  label: string
  hint: string
  Icon: LucideIcon
}[] = [
  {
    id: 'single',
    label: 'Một ảnh',
    hint: 'Một tệp, cùng pipeline Sharp',
    Icon: FileImage
  },
  {
    id: 'batch',
    label: 'Hàng loạt',
    hint: 'Hàng đợi, nhiều ảnh',
    Icon: Images
  }
]

export function ImageFormatConvertAnimatedModeTabs({
  value,
  onValueChange,
  disabled = false,
  className
}: ImageFormatConvertAnimatedModeTabsProps): ReactElement {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-border/70 bg-muted/35 p-1.5 shadow-sm ring-1 ring-black/4 dark:ring-white/6',
        className
      )}
      role="tablist"
      aria-label="Chế độ đổi định dạng ảnh"
    >
      <div className="grid grid-cols-2 gap-1.5">
        {MODES.map((tab) => {
          const isActive = value === tab.id
          const Icon = tab.Icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => onValueChange(tab.id)}
              className={cn(
                'relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2 text-center transition-colors sm:min-h-13 sm:flex-row sm:gap-2 sm:py-2.5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:pointer-events-none disabled:opacity-50',
                !isActive &&
                  'text-muted-foreground hover:bg-black/6 dark:text-white/90 dark:hover:bg-white/10'
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId="format-convert-mode-pill"
                  className="absolute inset-0 z-0 rounded-lg bg-white shadow-md ring-1 ring-black/8"
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
