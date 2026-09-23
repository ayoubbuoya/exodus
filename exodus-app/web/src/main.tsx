// Entry point of the web app: sets up the providers every page needs, then the router.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router/dom'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { router } from './router.tsx'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* React Query: caches and polls ledger reads (see ledger.ts). */}
    <QueryClientProvider client={queryClient}>
      {/* Theme: puts the `dark` class on <html>. Dark is the default look (decision G in
          docs/client-app.md); the user's choice is remembered in localStorage. */}
      <ThemeProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          {/* Toast messages ("Subscribed 500 USDC") appear here, bottom-right. */}
          <Toaster position="bottom-right" richColors />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
