import { Outlet, ScrollRestoration } from 'react-router'
import { LandingNav } from '@/components/landing/LandingNav'
import { SPEC_URL } from '@/components/landing/links'
import { Logo } from './Logo.tsx'

// The frame of the public landing page: its own top bar, the page, a footer.
//
// The landing page is ALWAYS dark (the Meridian look), whatever theme the
// visitor picked for the app: the `dark` class here re-applies the dark tokens
// to everything inside. Only the "maths" section switches to light on purpose.
//
// It is separate from SiteLayout (used by /lab) because the landing page is
// editorial and cinematic, while the app screens are compact software.
export function MarketingLayout() {
  return (
    <div className="dark flex min-h-svh flex-col bg-background text-foreground">
      <LandingNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[auto_1fr] md:gap-16 lg:px-10">
          <Logo size="lg" />
          <div className="grid gap-3 text-xs leading-5 text-faint">
            <p className="max-w-[80ch]">
              Exodus is a HackCanton Season 3 project running on a Canton test ledger. &ldquo;USYC&rdquo; and
              &ldquo;USDC&rdquo; are simulated tokens issued by the UsycIssuer and UsdcIssuer demo parties. They are not
              issued by, connected to, or endorsed by Circle or Hashnote. Nothing here is an offer of securities or
              investment advice. Every figure on this page comes from the worked example in the design spec.
            </p>
            <p>
              <a href={SPEC_URL} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                Read the design spec
              </a>
            </p>
          </div>
        </div>
      </footer>
      {/* Back/forward keep their scroll position; new pages start at the top. */}
      <ScrollRestoration />
    </div>
  )
}
