// The app's navigation, used by the sidebar (desktop) and the menu (phones).
//
// Who sees what:
//   visitor            Developer lab
//   signed up, waiting Access request · Markets · Developer lab
//   approved client    Wallet · Markets · Portfolio · Developer lab
//   admin              Markets · Dealer desk · Applications · Developer lab
// "Wallet" is the simulated USYC fund (the on-ramp: faucet, subscribe,
// redeem, send); Markets and Portfolio are the Pendle part built on top.
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import {
  ChartColumnIcon,
  ChartPieIcon,
  InboxIcon,
  MonitorIcon,
  ScanEyeIcon,
  UserRoundCheckIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { useAdminApplications } from '@/api/hooks'
import type { Profile } from '@/api/types'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  // Something small on the right of the link, for example the number of
  // applications waiting for review.
  extra?: ReactNode
}

type NavSection = {
  // Shown above the links, in small grey letters. The first section has none.
  title?: string
  items: NavItem[]
}

const LAB: NavItem = { to: '/lab', label: 'Developer lab', icon: ScanEyeIcon }

function navSectionsFor(profile: Profile | null | undefined): NavSection[] {
  // Nobody logged in (or the API is not reachable): the lab is open to everyone.
  if (profile === null || profile === undefined) {
    return [{ items: [LAB] }]
  }
  if (profile.role === 'ADMIN') {
    return [
      { items: [{ to: '/markets', label: 'Markets', icon: ChartColumnIcon }] },
      {
        title: 'Desk',
        items: [
          { to: '/dealer', label: 'Dealer desk', icon: MonitorIcon },
          { to: '/admin', label: 'Applications', icon: InboxIcon, extra: <PendingApplicationsCount /> },
        ],
      },
      { title: 'Tools', items: [LAB] },
    ]
  }
  if (profile.wallet !== null) {
    return [
      {
        items: [
          { to: '/app', label: 'Wallet', icon: WalletIcon },
          { to: '/markets', label: 'Markets', icon: ChartColumnIcon },
          { to: '/portfolio', label: 'Portfolio', icon: ChartPieIcon },
        ],
      },
      { title: 'Tools', items: [LAB] },
    ]
  }
  // Signed up but not approved yet: they may look at the markets meanwhile.
  return [
    {
      items: [
        { to: '/onboarding', label: 'Access request', icon: UserRoundCheckIcon },
        { to: '/markets', label: 'Markets', icon: ChartColumnIcon },
      ],
    },
    { title: 'Tools', items: [LAB] },
  ]
}

type AppNavProps = {
  profile: Profile | null | undefined
  // Called after a link is clicked (the phone menu closes itself).
  onNavigate?: () => void
}

export function AppNav({ profile, onNavigate }: AppNavProps) {
  const sections = navSectionsFor(profile)
  return (
    <nav aria-label="Main" className="grid gap-4">
      {sections.map((section, index) => (
        <div key={section.title ?? index} className="grid gap-1">
          {section.title !== undefined && <p className="px-3.5 pb-1 text-[11px] text-faint">{section.title}</p>}
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              // NavLink knows when its page is open (also on /markets/PT-…),
              // so the current page gets the lighter pill.
              className={({ isActive }) =>
                cn(
                  'flex h-10 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                )
              }
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.6} aria-hidden />
              {item.label}
              {item.extra}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}

// The number of access requests waiting for an admin, as a small round count
// ("Applications ②"). Rendered only for admins: the API refuses this list to
// anyone else. It shares its data with the Applications page (same query),
// which re-checks every 15 seconds, so new sign-ups show up by themselves.
function PendingApplicationsCount() {
  const pending = useAdminApplications('PENDING', 1)
  const count = pending.data?.total ?? 0
  if (count === 0) {
    return null
  }
  return (
    <span className="num ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-info/20 px-1.5 text-[11px] text-info">
      <span className="sr-only">(</span>
      {count}
      <span className="sr-only"> waiting)</span>
    </span>
  )
}
