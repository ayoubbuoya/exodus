// The frame of sign-up, login and onboarding: one calm centred column.
//
// Before an admin approves the account there is nothing to navigate to, so
// these pages get no sidebar: just the logo (back to the home page), the
// "simulated tokens" note and, once signed in, "Log out". Always dark, like
// the landing page the visitor just came from.
import { Outlet, ScrollRestoration } from 'react-router'
import { LogOutIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import { SimulatedBadge } from '@/components/SimulatedBadge'
import { Button } from '@/components/ui/button'
import { AppBackdrop } from './AppBackdrop.tsx'
import { followPointer } from './followPointer.ts'
import { Logo } from './Logo.tsx'
import { useSignOut } from './useSignOut.ts'

export function FocusLayout() {
  const { data: profile } = useProfile()
  const { signOut, isSigningOut } = useSignOut()
  const isSignedIn = profile !== undefined && profile !== null

  return (
    <div className="relative isolate flex min-h-svh flex-col bg-background text-foreground" onPointerMove={followPointer}>
      <AppBackdrop />
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 pt-5 sm:px-6">
        <Logo />
        <div className="ml-auto flex items-center gap-1.5">
          <SimulatedBadge />
          {isSignedIn && (
            <Button variant="ghost" size="sm" onClick={signOut} disabled={isSigningOut}>
              <LogOutIcon data-icon="inline-start" />
              Log out
            </Button>
          )}
        </div>
      </header>
      {/* A plain block (not flex), so a page's `mx-auto max-w-…` column keeps its full width. */}
      <main className="flex-1 px-4 py-10 sm:py-14">
        <Outlet />
      </main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-8 sm:px-6">
        <p className="text-center text-xs leading-5 text-faint">
          HackCanton S3 demo on a Canton test ledger. USYC and USDC are simulated, not issued by Circle or Hashnote.
        </p>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
