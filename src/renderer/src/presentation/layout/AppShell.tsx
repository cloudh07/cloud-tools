import { useSettingsStore } from '@/application/stores/settings.store'
import { useVideoJobBridge } from '@/features/video-chroma/presentation/hooks/use-video-job-bridge'
import { ShellAppUpdate } from '@/presentation/layout/shell-app-update'
import { ShellBreadcrumbs } from '@/presentation/layout/ShellBreadcrumbs'
import { ShellSidebarNav } from '@/presentation/layout/ShellSidebarNav'
import { Separator } from '@/shared/presentation/components/ui/separator'
import { Outlet, useRouter } from '@tanstack/react-router'
import { useEffect, type ReactElement } from 'react'

export function AppShell(): ReactElement {
  useVideoJobBridge()

  const router = useRouter()
  const loadSettings = useSettingsStore((s) => s.load)

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="flex w-[272px] shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur-sm">
        <div className="px-5 py-6">
          <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">
            {router.options.context.appName}
          </h1>
          <p className="mt-1.5 text-sm leading-snug text-muted-foreground">
            Chuyên dùng trong công việc cá nhân.
          </p>
        </div>
        <Separator className="opacity-60" />
        <ShellSidebarNav />
        <ShellAppUpdate appVersion={router.options.context.appVersion} />
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-linear-to-b from-background to-card/30">
        <ShellBreadcrumbs />
        <div className="min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
