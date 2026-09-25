// The frame of the app screens (wallet, markets, portfolio, desk, lab).
//
// Desktop (1024 px and wider): a floating glass sidebar on the left, the
// same shape as the app window on the landing page ("The app" section):
//   logo · navigation · demo clock · account · "simulated tokens" + theme
// It stays in place while the page scrolls.
// Phones and tablets: a floating glass bar at the top (logo, demo date, menu
// button); the menu opens the same navigation and account below it.
//
// Sign-up, login and onboarding use FocusLayout instead: before approval there
// is nowhere to navigate, so they get one calm centred column.
import { useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useNavigation } from 'react-router'
import { MenuIcon, XIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import { SimulatedBadge } from '@/components/SimulatedBadge'
import { Button } from '@/components/ui/button'
import { AccountCard } from './AccountCard.tsx'
import { AppBackdrop } from './AppBackdrop.tsx'
import { AppNav } from './AppNav.tsx'
import { DemoClock } from './DemoClock.tsx'
import { Logo } from './Logo.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'

export function AppLayout() {
  // "loading" while the next page's code downloads (pages load lazily, see
  // router.tsx): the current page stays, and a thin line at the top says
  // something is on its way.
  const navigation = useNavigation()

  return (
    <div className="relative isolate min-h-svh bg-background text-foreground lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <AppBackdrop />
      {navigation.state === 'loading' && (
        <div role="progressbar" aria-label="Loading the page" className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-foreground/60" />
      )}
      <Sidebar />
      <MobileBar />
      <div className="flex min-w-0 flex-col">
        <main className="flex-1">
          <Outlet />
        </main>
        <AppFooter />
      </div>
      {/* Back/forward keep their scroll position; new pages start at the top. */}
      <ScrollRestoration />
    </div>
  )
}

// The desktop sidebar: a pane of glass floating 12 px from the window edges.
function Sidebar() {
  const { data: profile } = useProfile()
  return (
    <aside className="sticky top-0 hidden h-svh p-3 pr-0 lg:block">
      <div className="glass flex h-full flex-col gap-5 rounded-3xl p-3">
        <Logo className="px-2 pt-2" />
        {/* The links scroll on their own if a short window cannot fit everything. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AppNav profile={profile} />
        </div>
        <div className="grid gap-2">
          <DemoClock variant="card" />
          <AccountCard />
          <div className="flex items-center justify-between gap-2 pt-1 pl-1">
            <SimulatedBadge />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  )
}

// Phones and tablets: a floating bar on top, and the menu below it.
function MobileBar() {
  const { data: profile } = useProfile()
  const [menuOpen, setMenuOpen] = useState(false)

  // Escape closes the menu.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 lg:hidden">
      <div className="glass-strong glass-bar flex h-14 items-center gap-2 rounded-full pr-2 pl-4">
        <Logo />
        <div className="ml-auto flex items-center gap-1.5">
          <DemoClock variant="chip" />
          <Button
            variant="ghost"
            size="icon-lg"
            aria-expanded={menuOpen}
            aria-controls="app-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>
      {menuOpen && (
        <div id="app-menu" className="glass-strong mt-2 grid gap-4 rounded-3xl p-3">
          <AppNav profile={profile} onNavigate={() => setMenuOpen(false)} />
          <DemoClock variant="card" />
          <AccountCard />
          <div className="flex items-center justify-between gap-2 pl-1">
            <SimulatedBadge />
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  )
}

// The small print under every app page: this is a demo with simulated tokens.
function AppFooter() {
  return (
    <footer className="px-4 pt-6 pb-8 sm:px-6 lg:px-10">
      <p className="mx-auto max-w-[1180px] border-t border-foreground/6 pt-5 text-xs leading-5 text-faint">
        Exodus is a HackCanton Season 3 project running on a Canton test ledger. "USYC" and "USDC" are simulated tokens
        issued by the UsycIssuer and UsdcIssuer demo parties. They are not issued by, connected to, or endorsed by Circle
        or Hashnote. Nothing here is an offer of securities or investment advice.
      </p>
    </footer>
  )
}
