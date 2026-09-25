import { NavLink, Outlet } from 'react-router'
import { cn } from 'cn'
import { useProfile } from '@/api/hooks'
import type { Profile } from '@/api/types'
import { SimulatedBadge } from '@/components/SimulatedBadge'
import { Logo } from './Logo.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { UserMenu } from './UserMenu.tsx'

// Links in the top bar, depending on who is logged in:
//   approved clients: Wallet · Markets · Portfolio
//   admins:           Markets · Dealer · Admin
//   everyone:         Lab
// "Wallet" is the simulated USYC fund (the on-ramp); Markets and Portfolio are
// the Pendle part built on top of it, on their own pages.
function navLinksFor(profile: Profile | null | undefined): { to: string; label: string }[] {
  const links: { to: string; label: string }[] = []
  if (profile?.wallet != null) {
    links.push({ to: '/app', label: 'Wallet' })
  }
  if (profile?.wallet != null || profile?.role === 'ADMIN') {
    links.push({ to: '/markets', label: 'Markets' })
  }
  if (profile?.wallet != null) {
    links.push({ to: '/portfolio', label: 'Portfolio' })
  }
  if (profile?.role === 'ADMIN') {
    links.push({ to: '/dealer', label: 'Dealer' })
    links.push({ to: '/admin', label: 'Admin' })
  }
  links.push({ to: '/lab', label: 'Lab' })
  return links
}

// The frame around every page: sticky top bar, the page itself (<Outlet />), footer.
export function SiteLayout() {
  const { data: profile } = useProfile()
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-4">
          <Logo />
          {/* Up to 5 links: on a phone the row scrolls sideways instead of wrapping. */}
          <nav aria-label="Main" className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1">
            {navLinksFor(profile).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                // NavLink tells us when its page is open, so we can highlight it.
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SimulatedBadge />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground">
          Exodus is a HackCanton Season 3 project running on a Canton test ledger. "USYC" and "USDC" are simulated
          tokens issued by the UsycIssuer and UsdcIssuer demo parties. They are not issued by, connected to, or
          endorsed by Circle or Hashnote. Nothing here is an offer of securities or investment advice.
        </div>
      </footer>
    </div>
  )
}
