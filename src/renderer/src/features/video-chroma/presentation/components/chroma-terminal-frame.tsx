import { cn } from '@/shared/lib/utils'
import type { ReactElement, ReactNode } from 'react'

type ChromaTerminalFrameProps = {
  title: string
  children: ReactNode
  className?: string
  bodyClassName?: string
}

export function ChromaTerminalFrame({
  title,
  children,
  className,
  bodyClassName
}: ChromaTerminalFrameProps): ReactElement {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-border/80 bg-zinc-950/90 shadow-inner ring-1 ring-white/5',
        className
      )}
    >
      <div
        className="flex items-center gap-3 border-b border-white/10 bg-zinc-900/95 px-3 py-2"
        role="presentation"
      >
        <div className="flex shrink-0 gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-[#ff5f57]/90" />
          <span className="size-2.5 rounded-full bg-[#febc2e]/90" />
          <span className="size-2.5 rounded-full bg-[#28c840]/90" />
        </div>
        <span className="min-w-0 truncate font-mono text-[11px] font-medium tracking-wide text-zinc-400">
          {title}
        </span>
      </div>
      <div className={cn('min-h-0 bg-black/55', bodyClassName)}>{children}</div>
    </div>
  )
}
