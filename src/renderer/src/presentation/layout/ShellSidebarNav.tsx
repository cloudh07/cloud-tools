import {
  SHELL_NAV_TREE,
  type ShellNavGroup,
  type ShellNavLeaf
} from '@/app/navigation/shell-nav-tree'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/presentation/components/ui/button'
import { Link, useMatchRoute } from '@tanstack/react-router'
import {
  ChevronRight,
  Clapperboard,
  Crop,
  FileImage,
  Gauge,
  Headphones,
  LayoutGrid,
  Settings2,
  Stamp,
  type LucideIcon
} from 'lucide-react'
import { useId, useState, type ReactElement } from 'react'

const LEAF_ICONS: Record<string, LucideIcon> = {
  'chroma-video': Clapperboard,
  'video-compress': Gauge,
  'audio-extract': Headphones,
  'image-smart-crop': Crop,
  'image-format-convert': FileImage,
  'image-watermark': Stamp,
  settings: Settings2
}

function LeafIcon({ leafId }: { leafId: string }): ReactElement {
  const Icon = LEAF_ICONS[leafId] ?? LayoutGrid
  return <Icon className="size-4 shrink-0" aria-hidden />
}

function NavLeafLink({ leaf, nested }: { leaf: ShellNavLeaf; nested: boolean }): ReactElement {
  const matchRoute = useMatchRoute()
  const isActive = !!matchRoute({ ...leaf.link, fuzzy: true })

  return (
    <Button
      asChild
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        'h-10 justify-start gap-3 rounded-md px-3 text-[15px] font-medium',
        nested && 'ml-0.5'
      )}
    >
      <Link
        {...leaf.link}
        preload="intent"
        className="flex w-full min-w-0 items-center gap-3 no-underline"
      >
        <LeafIcon leafId={leaf.id} />
        <span className="truncate">{leaf.label}</span>
      </Link>
    </Button>
  )
}

function NavGroupSection({ group }: { group: ShellNavGroup }): ReactElement {
  const panelId = useId()
  const matchRoute = useMatchRoute()
  const childActive = group.items.some((leaf) => !!matchRoute({ ...leaf.link, fuzzy: true }))
  const [userOpen, setUserOpen] = useState<boolean>(true)
  const expanded = userOpen || childActive

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={cn(
          'flex h-10 w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground',
          childActive && 'bg-muted/25 text-foreground'
        )}
        onClick={() => setUserOpen((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <ChevronRight
          className={cn(
            'size-4 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none',
            expanded && 'rotate-90'
          )}
          aria-hidden
        />
        <LayoutGrid className="size-4 shrink-0 opacity-80" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        )}
      >
        <div
          className={cn('min-h-0 overflow-hidden', !expanded && 'pointer-events-none')}
          aria-hidden={!expanded}
        >
          <div
            id={panelId}
            className="ml-1.5 flex flex-col gap-0.5 border-l border-border/80 py-0.5 pl-2.5"
            role="group"
            aria-label={group.label}
          >
            {group.items.map((leaf) => (
              <NavLeafLink key={leaf.id} leaf={leaf} nested />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ShellSidebarNav(): ReactElement {
  return (
    <nav className="flex flex-1 flex-col gap-2 p-3" aria-label="Điều hướng chính">
      {SHELL_NAV_TREE.map((entry) =>
        entry.kind === 'group' ? (
          <NavGroupSection key={entry.id} group={entry} />
        ) : (
          <NavLeafLink key={entry.id} leaf={entry} nested={false} />
        )
      )}
    </nav>
  )
}
