export type RouteBreadcrumbStatic = {
  breadcrumb: string
  breadcrumbAsLink?: boolean
}

export function breadcrumbLabel(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const label = (data as { breadcrumb?: unknown }).breadcrumb
  return typeof label === 'string' && label.length > 0 ? label : undefined
}

export function breadcrumbIsLinkable(data: unknown): boolean {
  if (!data || typeof data !== 'object') return true
  const v = (data as { breadcrumbAsLink?: unknown }).breadcrumbAsLink
  return typeof v === 'boolean' ? v : true
}
