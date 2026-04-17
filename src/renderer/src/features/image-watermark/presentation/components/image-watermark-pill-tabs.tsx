import { cn } from '@/shared/lib/utils'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import type { ReactElement } from 'react'

export type ImageWatermarkPillTabItem<T extends string> = {
  id: T
  label: string
  Icon: LucideIcon
}

export type ImageWatermarkPillTabsProps<T extends string> = {
  value: T
  items: readonly ImageWatermarkPillTabItem<T>[]
  onValueChange: (id: T) => void
  disabled?: boolean
  layoutId: string
  ariaLabel: string
  className?: string
}

export function ImageWatermarkPillTabs<T extends string>({
  value,
  items,
  onValueChange,
  disabled = false,
  layoutId,
  ariaLabel,
  className
}: ImageWatermarkPillTabsProps<T>): ReactElement {
  return (
    <div
      className={cn(
        'w-full rounded-xl border border-border/70 bg-muted/35 p-1 shadow-sm ring-1 ring-black/4 dark:ring-white/6',
        className
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'grid gap-1',
          items.length === 2 && 'grid-cols-2',
          items.length === 3 && 'grid-cols-1 sm:grid-cols-3',
          items.length > 3 && 'grid-cols-2 sm:grid-cols-4'
        )}
      >
        {items.map((tab) => {
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
                'relative flex min-h-10 w-full min-w-0 cursor-pointer flex-row items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-center',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                'disabled:pointer-events-none disabled:opacity-50',
                !isActive &&
                  'text-muted-foreground hover:bg-black/6 dark:text-white/90 dark:hover:bg-white/10'
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 z-0 rounded-lg bg-white shadow-md ring-1 ring-black/8 dark:bg-white"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.48 }}
                />
              ) : null}
              <Icon
                className={cn(
                  'relative z-1 size-3.5 shrink-0',
                  isActive ? 'text-zinc-950' : 'opacity-90'
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'relative z-1 min-w-0 truncate text-[13px] font-semibold leading-none tracking-tight',
                  isActive ? 'text-zinc-950' : undefined
                )}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
