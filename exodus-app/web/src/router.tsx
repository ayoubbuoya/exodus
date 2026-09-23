// The list of pages (URL → component). Every page shares SiteLayout (header + footer).
//
// RequireStage decides who may open a page and redirects everyone else
// (see src/auth/RequireStage.tsx). The pages follow docs/client-app.md.
import { createBrowserRouter } from 'react-router'
import { RequireStage } from '@/auth/RequireStage'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { AdminPage } from '@/pages/AdminPage'
import { AppPage } from '@/pages/AppPage'
import { LabPage } from '@/pages/LabPage'
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { SignupPage } from '@/pages/SignupPage'

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      // Only for visitors: a logged-in user is sent to their home page.
      { path: '/signup', element: <RequireStage stage="signed-out"><SignupPage /></RequireStage> },
      { path: '/login', element: <RequireStage stage="signed-out"><LoginPage /></RequireStage> },
      // Access form and review status, for any logged-in user.
      { path: '/onboarding', element: <RequireStage stage="signed-in"><OnboardingPage /></RequireStage> },
      // Approved clients only (they have a wallet).
      { path: '/app', element: <RequireStage stage="approved"><AppPage /></RequireStage> },
      // Admins only. The API checks the role again on every admin call.
      { path: '/admin', element: <RequireStage stage="admin"><AdminPage /></RequireStage> },
      // The original walking skeleton: act as any demo party and check privacy. Open to everyone.
      { path: '/lab', element: <LabPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
