// Entry point of the web app: sets up the providers every page needs, then the router.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from './api/query-client.ts'
import { router } from './router.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* React Query: caches and polls ledger reads (see ledger.ts) and API calls (see api/hooks.ts). */}
    <QueryClientProvider client={queryClient}>
      {/* Appearance: dark by default, light if chosen in the account menu
          (decision G in docs/client-app.md). The landing page is always dark. */}
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          {/* Toast messages ("Subscribed 500 USDC") appear here, bottom-right. */}
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
