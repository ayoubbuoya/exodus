import type { ReactNode } from 'react'
import {
  ActivityIcon,
  ArrowLeftRightIcon,
  ArrowUpRightIcon,
  BanknoteIcon,
  CalendarClockIcon,
  ChartColumnIcon,
  LandmarkIcon,
  MonitorIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { Mark } from '@/components/brand/Mark'
import { Amount } from '@/components/finance/Amount'
import { MaturityBar } from '@/components/finance/MaturityBar'
import { JAN_1, MATURITY_DATE, TERM_DAYS } from '@/landing/demo-numbers'

// "The product": the Exodus app itself, rendered with real components (no
// device mockup, no screenshot), as one of the landing page's visual assets.
// It is drawn in the same glass as the rest of the page: one large glass
// window, a floating sidebar, separate glass cards, pill buttons.
//
// It shows Bank's book on 01 Jan 2027 in the worked example (spec §9): after
// the split and the sale of 500 PT to Alice, before Bank's first claim.
//   1,000 YT with 24.390243 USYC claimable (1,000 × (1 − 1 / 1.025)),
//   500 PT that redeem $500.00 at maturity,
//   487.50 USDC from the sale.
// It is a picture of the app: the controls are inert (not clickable, not
// focusable), and screen readers get a one-line description instead.

const DAYS_LEFT = TERM_DAYS - JAN_1 // 90

export function ProductPreview() {
  return (
    <section id="app" aria-labelledby="product-title" className="scroll-mt-[72px] border-t border-border">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <h2 id="product-title" className="reveal font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]">
          Every position, <span className="block text-foreground/40">one maturity away.</span>
        </h2>

        {/* The app window: one large pane of glass. Phones scroll it sideways. */}
        <div className="reveal mt-12 overflow-x-auto rounded-4xl pb-2">
          <div
            inert
            role="img"
            aria-label="The Exodus app: Bank's portfolio on 01 Jan 2027, with 1,000 YT and 24.390243 USYC of claimable yield, 500 PT redeeming $500.00 on 01 Apr 2027, and 487.50 USDC."
            className="glass glass-sheen grid min-w-[780px] gap-3 rounded-4xl p-3 text-[13px] md:min-w-[1060px] md:grid-cols-[200px_minmax(0,1fr)]"
          >
            <PreviewRail />
            <div className="grid min-w-0 content-start gap-3 p-2">
              <PreviewTopBar />
              <SummaryCards />
              <PositionsPanel />
              <div className="grid grid-cols-2 items-start gap-3">
                <MaturitiesPanel />
                <ActivityPanel />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ----------------------------------------------------------------------------

const NAV: { icon: LucideIcon; label: string; active?: boolean; count?: number }[] = [
  { icon: WalletIcon, label: 'Portfolio', active: true },
  { icon: ChartColumnIcon, label: 'Markets' },
  { icon: ArrowLeftRightIcon, label: 'Trade', count: 1 },
  { icon: LandmarkIcon, label: 'Fund' },
  { icon: ActivityIcon, label: 'Activity' },
]

// The sidebar: a darker inner pane with pill navigation.
function PreviewRail() {
  return (
    // Phones hide the rail, to leave the width to the positions.
    <aside className="hidden min-h-full flex-col rounded-3xl bg-black/20 p-3 md:flex">
      <div className="flex items-center gap-2 px-2 pt-1 pb-4">
        <Mark className="h-4 w-auto" />
        <span className="font-display text-lg leading-none">Exodus</span>
      </div>
      <ul className="grid gap-1">
        {NAV.map((item) => (
          <li
            key={item.label}
            className={cn(
              'flex h-10 items-center gap-3 rounded-full px-3.5 font-medium',
              item.active ? 'bg-white/12 text-foreground' : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-4" strokeWidth={1.6} aria-hidden />
            {item.label}
            {item.count !== undefined && (
              <span className="num ml-auto grid size-5 place-items-center rounded-full bg-white/15 text-[11px] text-foreground">
                {item.count}
              </span>
            )}
          </li>
        ))}
      </ul>
      <p className="px-3.5 pt-5 pb-1 text-[11px] text-faint">Desk</p>
      <ul className="grid">
        <li className="flex h-10 items-center gap-3 rounded-full px-3.5 font-medium text-muted-foreground">
          <MonitorIcon className="size-4" strokeWidth={1.6} aria-hidden />
          Dealer desk
        </li>
      </ul>
      {/* Who is signed in: a round avatar and the party id. */}
      <div className="glass mt-auto flex items-center gap-3 rounded-xl p-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/12 font-semibold">B</span>
        <span className="grid min-w-0 leading-tight">
          <span className="font-medium">Bank</span>
          <span className="ident truncate text-[11px] text-muted-foreground">bank-2c1e…1220</span>
        </span>
      </div>
      <p className="px-2 pt-3 text-[11px] leading-4 text-faint">Canton sandbox · simulated USYC and USDC</p>
    </aside>
  )
}

function PreviewTopBar() {
  return (
    <div className="flex items-center gap-3 px-1 pt-1">
      <p className="font-display text-[26px] leading-none">Portfolio</p>
      <div className="num ml-auto flex items-center gap-2 text-xs">
        <span className="glass flex h-9 items-center gap-2 rounded-full px-3.5 text-muted-foreground">
          <CalendarClockIcon className="size-3.5" aria-hidden />
          Sim <span className="font-medium text-foreground">01 Jan 2027</span>
          <span className="text-faint">·</span>
          <span className="font-medium text-foreground">{DAYS_LEFT} d</span> to {MATURITY_DATE}
        </span>
        <span className="flex h-9 items-center rounded-full bg-[#eef2f8] px-4 font-semibold text-[#060a13]">New RFQ</span>
      </div>
    </div>
  )
}

// The four numbers of the book, each on its own glass card with a round icon
// in the corner, like a widget. Big numbers dim their decimals.
function SummaryCards() {
  const cards: { icon: LucideIcon; label: string; value: string; unit?: string; sub: string; yieldTone?: boolean }[] = [
    { icon: SparklesIcon, label: 'Claimable yield', value: '24.390243', unit: 'USYC', sub: '≈ $25.00 at index 1.025000', yieldTone: true },
    { icon: ShieldCheckIcon, label: 'Principal at maturity', value: '$500.00', sub: `500.00 PT · ${MATURITY_DATE}` },
    { icon: BanknoteIcon, label: 'Cash', value: '487.50', unit: 'USDC', sub: 'From 1 PT sale' },
    { icon: CalendarClockIcon, label: 'Next maturity', value: MATURITY_DATE, sub: `${DAYS_LEFT} days · 1 market` },
  ]
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="glass rounded-[22px] p-4">
          <div className="flex items-start justify-between">
            <span className="text-[12.5px] text-muted-foreground">{card.label}</span>
            <span className={cn('grid size-8 place-items-center rounded-full bg-white/8', card.yieldTone && 'text-yt')}>
              <card.icon className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
          </div>
          <p className={cn('mt-3 font-display text-[23px] leading-none', card.yieldTone && 'text-yt')}>
            <Amount value={card.value} unit={card.unit} />
          </p>
          <p className="num mt-2 text-xs text-muted-foreground">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}

// A glass card with a title row.
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="glass rounded-3xl">
      <div className="flex h-13 items-center gap-4 px-5">
        <p className="text-[15px] font-medium">{title}</p>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  )
}

// A round badge that says which instrument a row is about: PT is solid silver,
// YT is solid yield blue, cash is a quiet grey.
function InstrumentDot({ kind }: { kind: 'pt' | 'yt' | 'cash' }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-bold',
        kind === 'pt' && 'bg-pt text-background',
        kind === 'yt' && 'bg-yt text-background',
        kind === 'cash' && 'bg-white/8 text-muted-foreground',
      )}
    >
      {kind === 'pt' ? 'PT' : kind === 'yt' ? 'YT' : '$'}
    </span>
  )
}

type Row = {
  kind: 'pt' | 'yt' | 'cash'
  name: string
  sub: string
  holding: string
  holdingSub?: string
  value: string
  valueSub?: string
  rate: string
  rateSub?: string
  maturity: boolean
  action?: string
  actionEnabled?: boolean
}

const ROWS: Row[] = [
  {
    kind: 'yt',
    name: 'YT-USYC-APR2027',
    sub: `Yield · until ${MATURITY_DATE}`,
    holding: '1,000.00 YT',
    holdingSub: 'Since index 1.000000',
    value: '24.390243 USYC',
    valueSub: 'claimable · ≈ $25.00',
    // 1.025 ^ (365 / 92) − 1: the index growth since the split, annualised.
    rate: '10.29%',
    rateSub: 'Floating, trailing',
    maturity: true,
    action: 'Claim',
    actionEnabled: true,
  },
  {
    kind: 'pt',
    name: 'PT-USYC-APR2027',
    sub: `Principal · ${MATURITY_DATE}`,
    holding: '500.00 PT',
    holdingSub: 'From split at 1.000000',
    value: '$500.00',
    valueSub: 'at maturity',
    rate: '—',
    rateSub: 'Inventory, not bought',
    maturity: true,
    action: 'Redeem',
  },
  {
    kind: 'cash',
    name: 'USDC',
    sub: 'Simulated · UsdcIssuer',
    holding: '487.50 USDC',
    value: '$487.50',
    rate: '—',
    maturity: false,
    action: 'Send',
  },
]

function PositionsPanel() {
  return (
    <Panel
      title="Positions"
      action={<span className="glass inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium">Split USYC</span>}
    >
      <table className="num w-full border-collapse">
        <thead>
          <tr className="text-left">
            {['Instrument', 'Holding', 'Value', 'Rate', 'Maturity', ''].map((head, index) => (
              <th
                key={head || 'action'}
                className={cn('px-3.5 pb-2 text-[11.5px] font-normal text-faint', (index === 1 || index === 2) && 'text-right')}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const isYield = row.kind === 'yt'
            return (
              <tr key={row.name} className="border-t border-white/6">
                <td className="px-3.5 py-3">
                  <span className="flex items-center gap-3">
                    <InstrumentDot kind={row.kind} />
                    <span>
                      <span className="block font-medium whitespace-nowrap">{row.name}</span>
                      <span className="block text-xs whitespace-nowrap text-muted-foreground">{row.sub}</span>
                    </span>
                  </span>
                </td>
                <td className="px-3.5 py-3 text-right whitespace-nowrap">
                  {row.holding}
                  {row.holdingSub && <span className="block text-xs text-muted-foreground">{row.holdingSub}</span>}
                </td>
                <td className="px-3.5 py-3 text-right whitespace-nowrap">
                  <span className={cn(isYield && 'text-yt')}>{row.value}</span>
                  {row.valueSub && <span className="block text-xs text-muted-foreground">{row.valueSub}</span>}
                </td>
                <td className="px-3.5 py-3 whitespace-nowrap">
                  <span className={cn(isYield && 'text-yt')}>{row.rate}</span>
                  {row.rateSub && <span className="block text-xs text-muted-foreground">{row.rateSub}</span>}
                </td>
                <td className="px-3.5 py-3 whitespace-nowrap">
                  {row.maturity ? (
                    <span className="flex items-center gap-2.5">
                      <MaturityBar elapsedDays={JAN_1} totalDays={TERM_DAYS} className="w-14" />
                      {DAYS_LEFT} d
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-3.5 py-3 text-right">
                  {row.action && (
                    <span
                      className={cn(
                        'inline-flex h-8 items-center rounded-full px-3.5 text-xs font-medium',
                        row.actionEnabled ? 'bg-[#eef2f8] font-semibold text-[#060a13]' : 'bg-white/6 text-muted-foreground',
                      )}
                    >
                      {row.action}
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="border-t border-white/6 px-3.5 py-3 text-xs text-muted-foreground">
        PT and YT are visible to Bank and the Operator. USDC to Bank and the USDC Issuer.
      </p>
    </Panel>
  )
}

function MaturitiesPanel() {
  return (
    <Panel title="Maturities">
      <div className="grid gap-3 px-5 pb-5">
        <div className="num flex justify-between">
          <span className="font-medium">APR 2027</span>
          <span className="text-muted-foreground">
            {MATURITY_DATE} · {DAYS_LEFT} d
          </span>
        </div>
        <MaturityBar elapsedDays={JAN_1} totalDays={TERM_DAYS} className="w-full" />
        <div className="num flex justify-between">
          <span>500.00 PT</span>
          <span className="text-yt">1,000.00 YT</span>
        </div>
      </div>
    </Panel>
  )
}

function ActivityPanel() {
  const items = [
    { title: 'Sold 500 PT to Alice', detail: 'at 0.9750 · +487.50 USDC', date: '01 Oct 2026' },
    { title: 'Split 1,000 USYC', detail: '→ 1,000 PT + 1,000 YT', date: '01 Oct 2026' },
  ]
  return (
    <Panel title="Activity">
      <ul className="px-2 pb-2">
        {items.map((item) => (
          <li key={item.title} className="num flex items-center gap-3 rounded-[16px] px-3 py-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/8">
              <ArrowUpRightIcon className="size-4" strokeWidth={1.6} aria-hidden />
            </span>
            <span className="grid min-w-0 flex-1">
              <span className="font-medium">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.detail}</span>
            </span>
            <span className="grid justify-items-end text-xs">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-success" aria-hidden />
                Settled
              </span>
              <span className="text-muted-foreground">{item.date}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
