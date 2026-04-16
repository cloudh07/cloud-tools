import { appRouter } from '@/app/router'
import { RouterProvider } from '@tanstack/react-router'
import type { ReactElement } from 'react'

export default function App(): ReactElement {
  return <RouterProvider router={appRouter} />
}
