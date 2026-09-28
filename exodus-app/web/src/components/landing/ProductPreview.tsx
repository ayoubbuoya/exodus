import type { ReactNode } from 'react'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  ChartPieIcon,
  ChevronsUpDownIcon,
  ScanEyeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SplitIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { Mark } from '@/components/brand/Mark'
import { Amount } from '@/components/finance/Amount'
import { StatCard } from '@/components/finance/StatCard'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { JAN_1, QUOTE, SPLIT, TERM_DAYS } from '@/landing/demo-numbers'
import { formatDemoDate } from '@/lib/format'
import { SoftLight } from './SoftLight.tsx'

// "The product": the Exodus app itself, rendered with the app's own
// components (StatCard, TokenIcon, Amount) in the same layout as the real
// Portfolio page, so what the landing page promises is what a client gets:
// the floating glass sidebar, the page title, four summary cards, one row per
// PT and YT with its next action, and the market activity.
//
// It shows Bank's book on Jan 1, 2027 in the worked example (spec §9): after
// the split and the sale of 500 PT to Alice at 0.975, before Bank's first claim.
//   500 PT                 value 500 × 0.975                       = $487.50
//   1,000 YT               value 1,000 × (1 − 0.975) + $25.00 yield = $50.00
//   claimable yield        1,000 × (1 − 1 / 1.025)                 = 24.390243 USYC ≈ $25.00
//   portfolio value        487.50 + 50.00                          = $537.50
// It is a picture of the app: the controls are inert (not clickable, not
// focusable), and screen readers get a one-line description instead.

const DAYS_LEFT = TERM_DAYS - JAN_1 // 90
// The app's own date format ("Apr 1, 2027"), so the picture matches the product.
const MATURITY = formatDemoDate('2027-04-01T00:00:00Z')
const DEMO_TODAY = formatDemoDate('2027-01-01T00:00:00Z')

export function ProductPreview() {
  return (
    // No divider line above: the space already separates the sections.
    // Less padding on short desktop screens (short:), so a laptop does not
    // scroll through ~230 px of nothing between two sections.
    <section id="app" aria-labelledby="product-title" className="scroll-mt-[72px]">
      <div className="relative mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 short:py-16 tall:py-28">
        <h2 id="product-title" className="reveal font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]">
          Every position, <span className="block text-foreground/40">one maturity away.</span>
        </h2>

        {/* A faint silver light behind the app window, so its glass has
            something to blur (see SoftLight). Silver, not blue: the app is
            about the whole book, not only yield. */}
        <SoftLight className="top-[18%] left-[10%] h-[80%] w-[80%]" color="rgb(190 205 235 / 0.1)" />

        {/* The app window: one large pane of glass. Phones scroll it sideways. */}
        <div className="reveal mt-12 overflow-x-auto rounded-4xl pb-2">
          <div
            inert
            role="img"
            aria-label={`The Exodus app: Bank's portfolio on ${DEMO_TODAY}, worth $537.50, with 24.390243 USYC of claimable yield on 1,000 YT and 500 PT paying $500.00 on ${MATURITY}.`}
            className="glass glass-sheen grid min-w-[780px] gap-3 rounded-4xl p-3 text-[13px] md:min-w-[1060px] md:grid-cols-[216px_minmax(0,1fr)]"
          >
            <PreviewSidebar />
            <div className="grid min-w-0 content-start gap-4 p-3">
              <PreviewHeader />
              <SummaryCards />
              <PositionsPanel />
              <ActivityPanel />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ----------------------------------------------------------------------------

// The same links as the real sidebar for an approved client (AppNav).
const NAV: { icon: LucideIcon; label: string; active?: boolean }[] = [
  { icon: WalletIcon, label: 'Wallet' },
  { icon: ChartColumnIcon, label: 'Markets' },
  { icon: ChartPieIcon, label: 'Portfolio', active: true },
]

// The floating sidebar: navigation, the demo clock and the account card.
function PreviewSidebar() {
  return (
    // Phones hide the sidebar, to leave the width to the positions.
    <aside className="hidden min-h-full flex-col gap-5 rounded-3xl bg-black/20 p-3 md:flex">
      <div className="flex items-center gap-2 px-2 pt-2">
        <Mark className="h-4 w-auto" />
        <span className="font-display text-lg leading-none">Exodus</span>
      </div>
      <ul className="grid gap-1">
        {NAV.map((item) => (
          <NavItem key={item.label} icon={item.icon} active={item.active}>
            {item.label}
          </NavItem>
        ))}
      </ul>
      <div className="grid gap-1">
        <p className="px-3.5 pb-1 text-[11px] text-faint">Tools</p>
        <NavItem icon={ScanEyeIcon}>Developer lab</NavItem>
      </div>
      <div className="mt-auto grid gap-2">
        {/* The demo clock, like DemoClock in the real sidebar. */}
        <div className="num grid gap-1 rounded-2xl bg-foreground/4 p-3 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CalendarClockIcon className="size-3.5" aria-hidden />
            Demo date
            <span className="ml-auto flex items-center gap-1.5 text-foreground">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              Live
            </span>
          </div>
          <p className="text-[15px] font-medium text-foreground">{DEMO_TODAY}</p>
          <p className="text-muted-foreground">{DAYS_LEFT} days to maturity</p>
        </div>
        {/* Who is signed in: a round avatar and the party. */}
        <div className="flex items-center gap-3 rounded-2xl bg-foreground/4 p-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/12 text-sm font-semibold">B</span>
          <span className="grid min-w-0 flex-1 leading-tight">
            <span className="font-medium">Bank</span>
            <span className="ident truncate text-[11px] text-muted-foreground">bank-2c1e…1220</span>
          </span>
          <ChevronsUpDownIcon className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <p className="px-2 text-[11px] leading-4 text-faint">Canton sandbox · simulated USYC and USDC</p>
      </div>
    </aside>
  )
}

function NavItem({ icon: Icon, active = false, children }: { icon: LucideIcon; active?: boolean; children: ReactNode }) {
  return (
    <li
      className={cn(
        'flex h-10 list-none items-center gap-3 rounded-full px-3.5 font-medium',
        active ? 'bg-white/10 text-foreground' : 'text-muted-foreground',
      )}
    >
      <Icon className="size-4" strokeWidth={1.6} aria-hidden />
      {children}
    </li>
  )
}

// The page title, like PageHeader on the real Portfolio page.
function PreviewHeader() {
  return (
    <div className="flex items-end gap-4 px-1 pt-1">
      <div>
        <p className="font-display text-[30px] leading-tight">Portfolio</p>
        <p className="mt-1 text-sm text-muted-foreground">Your PT and YT in every market.</p>
      </div>
      <span className="glass ml-auto flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium">
        Markets
        <ArrowRightIcon className="size-4" aria-hidden />
      </span>
    </div>
  )
}

// The four summary cards of the real Portfolio page, with the real StatCard.
function SummaryCards() {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard label="Portfolio value" icon={ChartPieIcon} value={<Amount value="$537.50" />} sub="PT and YT, in USD" />
      <StatCard
        label="Claimable yield"
        icon={SparklesIcon}
        tone="yield"
        value={<Amount value="24.390243" unit="USYC" />}
        sub="≈ $25.00"
      />
      <StatCard
        label="Principal at maturity"
        icon={ShieldCheckIcon}
        value={<Amount value={QUOTE.atMaturity} />}
        sub={`${QUOTE.pt} PT · 1 USD of USYC each`}
      />
      <StatCard label="Next maturity" icon={CalendarClockIcon} value={MATURITY} sub={`${DAYS_LEFT} demo days left`} />
    </div>
  )
}

// A glass panel with a title and one line, like the app's Card.
function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="glass grid gap-4 rounded-3xl p-5">
      <div className="grid gap-1">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

type Row = {
  kind: 'pt' | 'yt'
  symbol: string
  sub: string
  holding: string
  value: string
  claimable?: string
  action: string
  bright: boolean
}

// One row per PT and per YT, each with its next action (as on /portfolio).
const ROWS: Row[] = [
  {
    kind: 'pt',
    symbol: 'PT-USYC-APR2027',
    sub: `Principal · pays 1 USD on ${MATURITY}`,
    holding: `${QUOTE.pt} PT`,
    value: '$487.50',
    action: 'Sell',
    bright: false,
  },
  {
    kind: 'yt',
    symbol: 'YT-USYC-APR2027',
    sub: `Yield · until ${MATURITY}`,
    holding: `${SPLIT.yt} YT`,
    value: '$50.00',
    claimable: '24.390243 USYC claimable',
    action: 'Claim',
    bright: true,
  },
]

function PositionsPanel() {
  return (
    <Panel title="Positions" description="Only you and the Operator (who signs PT and YT) can see them.">
      <div className="num grid">
        <div className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_96px] gap-4 px-2 pb-2 text-[11.5px] text-faint">
          <span>Token</span>
          <span className="text-right">Holding</span>
          <span className="text-right">Value</span>
          <span />
        </div>
        {ROWS.map((row) => (
          <div
            key={row.symbol}
            className="grid grid-cols-[minmax(0,1.5fr)_1fr_1fr_96px] items-center gap-4 border-t border-white/6 px-2 py-3.5"
          >
            <span className="flex min-w-0 items-center gap-3">
              <TokenIcon kind={row.kind} />
              <span className="grid min-w-0">
                <span className="ident truncate text-sm font-medium">{row.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{row.sub}</span>
              </span>
            </span>
            <span className="text-right text-sm font-medium">{row.holding}</span>
            <span className="grid text-right text-sm">
              {row.value}
              {row.claimable !== undefined && <span className="text-xs text-yt">{row.claimable}</span>}
            </span>
            <span
              className={cn(
                'flex h-8 items-center justify-center rounded-full text-[13px] font-medium',
                row.bright ? 'bg-[#eef2f8] font-semibold text-[#060a13]' : 'border border-white/14 bg-white/4',
              )}
            >
              {row.action}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  )
}

// The market activity, newest first, like ActivityCard on /portfolio.
function ActivityPanel() {
  const items: { icon: LucideIcon; label: string; when: string; changes: { text: string; incoming: boolean }[] }[] = [
    {
      icon: ArrowUpRightIcon,
      label: 'Sold PT',
      when: 'Oct 1, 10:24',
      changes: [
        { text: `−${QUOTE.pt} PT`, incoming: false },
        { text: `+${QUOTE.cash} USDC`, incoming: true },
      ],
    },
    {
      icon: SplitIcon,
      label: 'Minted PT + YT',
      when: 'Oct 1, 09:58',
      changes: [
        { text: `−${SPLIT.usyc} USYC`, incoming: false },
        { text: `+${SPLIT.pt} PT`, incoming: true },
        { text: `+${SPLIT.yt} YT`, incoming: true },
      ],
    },
  ]
  return (
    <Panel title="Market activity" description="Read from the Canton ledger. Only you (and the token issuers) can see it.">
      <ul className="-mx-2 grid">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/8">
              <item.icon className="size-4" aria-hidden />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="text-sm font-medium">{item.label}</span>
              <span className="num text-xs text-muted-foreground">{item.when}</span>
            </span>
            <span className="num grid text-right text-sm">
              {item.changes.map((change) => (
                <span key={change.text} className={change.incoming ? 'text-foreground' : 'text-muted-foreground'}>
                  {change.text}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
