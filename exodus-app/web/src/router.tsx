// The list of pages (URL → component).
//
// - The landing page (/) uses MarketingLayout: editorial, full-width diagrams.
// - Every other page uses SiteLayout: a compact app frame.
//
// The lab is loaded lazily (only when someone opens /lab). It pulls in the
// ledger client and the generated Daml types, which the landing page does not
// need, so the landing page stays small and fast.
//
// RequireStage decides who may open a page and redirects everyone else
// (see src/auth/RequireStage.tsx). The pages follow docs/client-app.md.
import { createBrowserRouter } from 'react-router'
import { RequireStage } from '@/auth/RequireStage'
import { MarketingLayout } from '@/components/layout/MarketingLayout'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AdminPage } from '@/pages/AdminPage'
import { AppPage } from '@/pages/AppPage'
import { DealerPage } from '@/pages/DealerPage'
import { LabLoading } from '@/pages/LabLoading'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { MarketPage } from '@/pages/MarketPage'
import { MarketsPage } from '@/pages/MarketsPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { PortfolioPage } from '@/pages/PortfolioPage'
import { SignupPage } from '@/pages/SignupPage'

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [{ path: '/', element: <LandingPage /> }],
  },
  {
    element: <SiteLayout />,
    children: [
      // Only for visitors: a logged-in user is sent to their home page.
      { path: '/signup', element: <RequireStage stage="signed-out"><SignupPage /></RequireStage> },
      { path: '/login', element: <RequireStage stage="signed-out"><LoginPage /></RequireStage> },
      // Access form and review status, for any logged-in user.
      { path: '/onboarding', element: <RequireStage stage="signed-in"><OnboardingPage /></RequireStage> },
      // Approved clients only (they have a wallet).
      { path: '/app', element: <RequireStage stage="approved"><AppPage /></RequireStage> },
      // The markets (the Pendle part). Anyone logged in may look; only approved
      // clients can act (the page says so, and the API checks it again).
      { path: '/markets', element: <RequireStage stage="signed-in"><MarketsPage /></RequireStage> },
      { path: '/markets/:marketId', element: <RequireStage stage="signed-in"><MarketPage /></RequireStage> },
      { path: '/portfolio', element: <RequireStage stage="approved"><PortfolioPage /></RequireStage> },
      // The house dealer's desk (admins run Bank, decision M1).
      { path: '/dealer', element: <RequireStage stage="admin"><DealerPage /></RequireStage> },
      // Admins only. The API checks the role again on every admin call.
      { path: '/admin', element: <RequireStage stage="admin"><AdminPage /></RequireStage> },
      // The original walking skeleton: act as any demo party and check privacy. Open to everyone.
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
