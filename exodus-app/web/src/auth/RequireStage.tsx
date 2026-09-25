// Route guard: shows a page only to the right people, and sends everyone else
// to the page where they belong.
//
// Stages, with examples:
//   "signed-out" (/login, /signup)  Alice is already logged in   -> her home page instead
//   "signed-in"  (/onboarding)      nobody logged in             -> /login
//   "approved"   (/app)             Bob is still pending         -> /onboarding
//   "admin"      (/admin)           Alice (a client) tries it    -> her home page
//
// This only decides what the browser shows. The real protection is on the
// server: every API route checks the session and the role again.
import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { RefreshCwIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import type { Profile } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { homePathFor } from './home-path.ts'

export type Stage = 'signed-out' | 'signed-in' | 'approved' | 'admin'

type RequireStageProps = {
  stage: Stage
  children: ReactNode
}

export function RequireStage({ stage, children }: RequireStageProps) {
  const profileQuery = useProfile()

  if (profileQuery.isPending) {
    return <PageLoading />
  }
  if (profileQuery.isError) {
    return <ServerUnreachable onRetry={() => void profileQuery.refetch()} />
  }

  const redirectTo = findRedirect(stage, profileQuery.data)
  if (redirectTo !== null) {
    // `replace`: the Back button should not bounce the user into the page they were refused.
    return <Navigate to={redirectTo} replace />
  }
  return children
}

// null = allowed to see the page.
function findRedirect(stage: Stage, profile: Profile | null): string | null {
  if (stage === 'signed-out') {
    return profile === null ? null : homePathFor(profile)
  }
  if (profile === null) {
    return '/login'
  }
  if (stage === 'approved' && profile.wallet === null) {
    return '/onboarding'
  }
  if (stage === 'admin' && profile.role !== 'ADMIN') {
    return homePathFor(profile)
  }
  return null
}

function PageLoading() {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 px-4 py-16" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function ServerUnreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Alert variant="destructive">
        <AlertTitle>Cannot reach the Exodus server</AlertTitle>
        <AlertDescription>
          The page needs the backend API. If you are running Exodus locally, start it with <code>npm run api</code>.
        </AlertDescription>
      </Alert>
      <Button variant="outline" className="mt-4" onClick={onRetry}>
        <RefreshCwIcon data-icon="inline-start" />
        Try again
      </Button>
    </div>
  )
}
