import './assets/globals.css'

import { TooltipProvider } from '@/shared/presentation/components/ui/tooltip'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'sonner'

import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={200}>
      <App />
      <Toaster richColors position="top-right" closeButton theme="dark" />
    </TooltipProvider>
  </StrictMode>
)
