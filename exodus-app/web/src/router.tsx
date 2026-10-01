// The list of pages (URL → component).
//
// - The landing page (/) uses MarketingLayout: editorial, full-width diagrams.
// - Sign-up, login and onboarding use FocusLayout: one centred column, no
//   navigation (before approval there is nowhere to go).
// - Every other page uses AppLayout: the floating glass sidebar.
//
// Every page except the landing page is loaded lazily, and so are the two
// app layouts: their code is downloaded only when someone opens them. The app
// pages pull in the ledger client, the generated Daml types and the chart
// library, which a visitor reading the landing page does not need, so the
// landing page stays small and fast.
// Example: a visitor on / downloads the landing code only; clicking
// "Request access" then downloads the sign-up page (a few kB).
//
// RequireStage decides who may open a page and redirects everyone else
// (see src/auth/RequireStage.tsx). The pages follow docs/client-app.md.
import type { ComponentType } from 'react'
import { createBrowserRouter, type RouteObject } from 'react-router'
import { RequireStage, type Stage } from '@/auth/RequireStage'
import { MarketingLayout } from '@/components/layout/MarketingLayout'
import { PageLoading } from '@/components/PageLoading'
import { LandingPage } from '@/pages/LandingPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// A page whose code is downloaded when someone opens it.
// - `loadPage` must call import() with a fixed path, so Vite can put that
//   page in its own file (a dynamic path could not be split).
// - `stage`: who may see the page (see RequireStage); leave it out for a page
//   open to everyone.
// While the code downloads on a first visit (for example after a reload on
// /markets), the router shows PageLoading. When clicking a link inside the
// app, the current page simply stays on screen until the next one is ready.
function lazyPage(loadPage: () => Promise<ComponentType>, stage?: Stage): Pick<RouteObject, 'lazy' | 'HydrateFallback'> {
  return {
    lazy: async () => {
      const Page = await loadPage()
      if (stage === undefined) {
        return { element: <Page /> }
      }
      return {
        element: (
          <RequireStage stage={stage}>
            <Page />
          </RequireStage>
        ),
      }
    },
    HydrateFallback: PageLoading,
  }
}

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [{ path: '/', element: <LandingPage /> }],
  },
  {
    // The layouts load lazily too: a visitor reading the landing page needs
    // neither the sidebar nor the account menu.
    lazy: async () => ({ Component: (await import('@/components/layout/FocusLayout')).FocusLayout }),
    HydrateFallback: PageLoading,
    children: [
      // Only for visitors: a logged-in user is sent to their home page.
      { path: '/signup', ...lazyPage(() => import('@/pages/SignupPage').then((module) => module.SignupPage), 'signed-out') },
      { path: '/login', ...lazyPage(() => import('@/pages/LoginPage').then((module) => module.LoginPage), 'signed-out') },
      // Access form and review status, for any logged-in user.
      {
        path: '/onboarding',
        ...lazyPage(() => import('@/pages/OnboardingPage').then((module) => module.OnboardingPage), 'signed-in'),
      },
    ],
  },
  {
    lazy: async () => ({ Component: (await import('@/components/layout/AppLayout')).AppLayout }),
    HydrateFallback: PageLoading,
    children: [
      // Approved clients only (they have a wallet).
      { path: '/app', ...lazyPage(() => import('@/pages/AppPage').then((module) => module.AppPage), 'approved') },
      // The markets (the Pendle part). Anyone logged in may look; only approved
      // clients can act (the page says so, and the API checks it again).
      { path: '/markets', ...lazyPage(() => import('@/pages/MarketsPage').then((module) => module.MarketsPage), 'signed-in') },
      {
        path: '/markets/:marketId',
        ...lazyPage(() => import('@/pages/MarketPage').then((module) => module.MarketPage), 'signed-in'),
      },
      {
        path: '/portfolio',
        ...lazyPage(() => import('@/pages/PortfolioPage').then((module) => module.PortfolioPage), 'approved'),
      },
      // The house dealer's desk (admins run Bank, decision M1).
      { path: '/dealer', ...lazyPage(() => import('@/pages/DealerPage').then((module) => module.DealerPage), 'admin') },
      // Admins only. The API checks the role again on every admin call.
      { path: '/admin', ...lazyPage(() => import('@/pages/AdminPage').then((module) => module.AdminPage), 'admin') },
      // The original walking skeleton: act as any demo party, move the demo
      // clock and check privacy. Admins only: a client who opens /lab is sent
      // to their wallet, a visitor to /login.
      { path: '/lab', ...lazyPage(() => import('@/pages/LabPage').then((module) => module.LabPage), 'admin') },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
