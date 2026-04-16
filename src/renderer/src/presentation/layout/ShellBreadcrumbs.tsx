import { breadcrumbIsLinkable, breadcrumbLabel } from '@/app/router/route-breadcrumb-static'
import { cn } from '@/shared/lib/utils'
import { Link, useMatches } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { Fragment, type ReactElement } from 'react'

export function ShellBreadcrumbs(): ReactElement | null {
  const items = useMatches({
    select: (matches) =>
      matches
        .filter((m) => m.status === 'success')
        .map((m) => {
          const label = breadcrumbLabel(m.staticData)
          if (!label) return null
          return {
            routeId: m.routeId,
            fullPath: m.fullPath,
            label,
            linkable: breadcrumbIsLinkable(m.staticData)
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
  })

  if (items.length === 0) return null

  return (
    <nav
      aria-label="Vị trí trong ứng dụng"
      className="flex shrink-0 items-center gap-1 border-b border-border/80 bg-card/30 px-6 py-2.5 text-xs text-muted-foreground"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <Fragment key={item.routeId}>
            {i > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-50" aria-hidden /> : null}
            {isLast ? (
              <span className={cn('truncate font-medium text-foreground')}>{item.label}</span>
            ) : item.linkable ? (
              <Link to={item.fullPath} className="truncate transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span className="truncate text-muted-foreground">{item.label}</span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
