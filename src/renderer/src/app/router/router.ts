import type { AppRouterContext } from '@/app/router-context'
import { routeTree } from '@/app/router/route-tree'
import { createHashHistory, createRouter } from '@tanstack/react-router'

const history = createHashHistory()

const routerContext: AppRouterContext = {
  appName: 'Bộ công cụ',
  appVersion: '1.0.5'
}

export const appRouter = createRouter({
  routeTree,
  history,
  context: routerContext
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof appRouter
  }
}
