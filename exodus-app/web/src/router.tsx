// The list of pages (URL → component).
//
// - The landing page (/) uses MarketingLayout: editorial, full-width diagrams.
// - The lab (/lab) and the 404 page use SiteLayout: a compact app frame.
//
// The lab is loaded lazily (only when someone opens /lab). It pulls in the
// ledger client and the generated Daml types, which the landing page does not
// need, so the landing page stays small and fast.
//
// Planned pages (docs/client-app.md): /signup, /login, /onboarding, /app, /admin.
import { createBrowserRouter } from 'react-router'
import { MarketingLayout } from '@/components/layout/MarketingLayout'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { LabLoading } from '@/pages/LabLoading'
import { LandingPage } from '@/pages/LandingPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [{ path: '/', element: <LandingPage /> }],
  },
  {
    element: <SiteLayout />,
    children: [
      // The original walking skeleton: act as any demo party and check privacy.
      {
        path: '/lab',
        lazy: async () => {
          const { LabPage } = await import('@/pages/LabPage')
          return { Component: LabPage }
        },
        // Shown for the moment the lab's code is downloading, when /lab is opened directly.
        HydrateFallback: LabLoading,
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
