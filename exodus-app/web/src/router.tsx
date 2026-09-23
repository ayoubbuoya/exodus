// The list of pages (URL → component). Every page shares SiteLayout (header + footer).
//
// Planned pages (docs/client-app.md): /signup, /login, /onboarding, /app, /admin.
// They are added as the backend lands.
import { createBrowserRouter } from 'react-router'
import { SiteLayout } from '@/components/layout/SiteLayout'
import { LabPage } from '@/pages/LabPage'
import { LandingPage } from '@/pages/LandingPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      // The original walking skeleton: act as any demo party and check privacy.
      { path: '/lab', element: <LabPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
