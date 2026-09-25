// Entry point of the web app: sets up the providers every page needs, then the router.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryClient } from './api/query-client.ts'
import { router } from './router.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* React Query: caches and polls ledger reads (see ledger.ts) and API calls (see api/hooks.ts). */}
    <QueryClientProvider client={queryClient}>
      {/* The whole app is always dark Glacier glass, like the landing page:
          index.html puts the `dark` class on <html> (decision G in docs/client-app.md). */}
      <TooltipProvider>
        <RouterProvider router={router} />
        {/* Toast messages ("Subscribed 500 USDC") appear here, bottom-right. */}
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
