import type { ReactNode } from 'react'
import {
  ActivityIcon,
  ArrowLeftRightIcon,
  ChartColumnIcon,
  LandmarkIcon,
  MonitorIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react'
import { cn } from 'cn'
import { Mark } from '@/components/brand/Mark'
import { InstrumentGlyph, type InstrumentKind } from '@/components/finance/InstrumentGlyph'
import { MaturityBar } from '@/components/finance/MaturityBar'
import { MATURITY_DATE, TERM_DAYS } from '@/landing/demo-numbers'
import { JAN_1 } from '@/landing/maturity-model'

// "The product": the Exodus app itself, rendered with real components (no
// device mockup, no screenshot), as one of the landing page's visual assets.
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
    <section aria-labelledby="product-title" className="border-t border-border">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
          <h2
            id="product-title"
            className="font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]"
          >
            Every position, <span className="block">one maturity away.</span>
          </h2>
          <p className="text-[15px] leading-6 text-muted-foreground">
            The Exodus app answers four questions for every position: what it is, what it is worth, which rate it
            earns, and how long until maturity. This is Bank&rsquo;s book on 01 Jan 2027.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-xl border border-input shadow-e2">
          <div
            inert
            role="img"
            aria-label="The Exodus app: Bank's portfolio on 01 Jan 2027, with 1,000 YT and 24.390243 USYC of claimable yield, 500 PT redeeming $500.00 on 01 Apr 2027, and 487.50 USDC."
            className="grid min-w-[760px] bg-background text-[13px] md:min-w-[1040px] md:grid-cols-[216px_minmax(0,1fr)]"
          >
            <PreviewRail />
            <div className="min-w-0">
              <PreviewTopBar />
              <div className="grid gap-4 p-5">
                <SummaryStrip />
                <PositionsPanel />
                <div className="grid grid-cols-2 items-start gap-4">
                  <MaturitiesPanel />
                  <ActivityPanel />
                </div>
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

function PreviewRail() {
  return (
    // Phones hide the rail, to leave the width to the positions.
    <aside className="hidden min-h-full flex-col border-r border-border bg-card md:flex">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4">
        <Mark className="h-3.5 w-auto" />
        <span className="font-display text-lg leading-none">Exodus</span>
      </div>
      <p className="px-4 pt-3 text-[11.5px] leading-4 text-faint">
        Canton sandbox
        <br />
        Simulated USYC and USDC
      </p>
      <ul className="grid gap-0.5 p-2">
        {NAV.map((item) => (
          <li
            key={item.label}
            className={cn(
              'relative flex h-8 items-center gap-2.5 rounded-lg px-2.5 font-medium',
              item.active ? 'bg-secondary text-foreground' : 'text-muted-foreground',
            )}
          >
            {item.active && <span className="absolute top-2 bottom-2 -left-2 w-0.5 rounded-r-sm bg-foreground" />}
            <item.icon className="size-4" strokeWidth={1.5} aria-hidden />
            {item.label}
            {item.count !== undefined && (
              <span className="num ml-auto rounded-sm border border-input px-1.5 text-[11px] leading-4">{item.count}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="label-caps px-4 pt-3">Desk</p>
      <ul className="grid p-2">
        <li className="flex h-8 items-center gap-2.5 rounded-lg px-2.5 font-medium text-muted-foreground">
          <MonitorIcon className="size-4" strokeWidth={1.5} aria-hidden />
          Dealer desk
        </li>
      </ul>
      <div className="mt-auto grid gap-0.5 border-t border-border px-4 py-3">
        <span className="font-semibold">Bank</span>
        <span className="ident text-muted-foreground">bank-2c1e…1220</span>
        <span className="text-xs text-faint">Dealer · custodial wallet</span>
      </div>
    </aside>
  )
}

function PreviewTopBar() {
  return (
    <div className="flex h-12 items-center gap-4 border-b border-border px-5">
      <p className="text-lg font-semibold tracking-[-0.01em]">Portfolio</p>
      <div className="num ml-auto flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          Sim <span className="font-medium text-foreground">01 Jan 2027</span>
        </span>
        <span>
          <span className="font-medium text-foreground">{DAYS_LEFT} d</span> to {MATURITY_DATE}
        </span>
        <span className="rounded-lg border border-input px-2.5 py-1 font-medium text-foreground">New RFQ</span>
      </div>
    </div>
  )
}

function SummaryStrip() {
  const cells: { label: string; value: string; sub: string; yieldTone?: boolean }[] = [
    { label: 'Claimable yield', value: '24.390243 USYC', sub: '≈ $25.00 at index 1.025000', yieldTone: true },
    { label: 'Principal at maturity', value: '$500.00', sub: `500.00 PT · ${MATURITY_DATE}` },
    { label: 'Cash', value: '487.50 USDC', sub: 'From 1 PT sale' },
    { label: 'Next maturity', value: MATURITY_DATE, sub: `${DAYS_LEFT} days · 1 market` },
  ]
  return (
    <div className="grid grid-cols-4 rounded-xl border border-border bg-card shadow-e1">
      {cells.map((cell, index) => (
        <div key={cell.label} className={cn('grid gap-1 px-4 py-3.5', index > 0 && 'border-l border-border')}>
          <span className="label-caps">{cell.label}</span>
          <span className={cn('num text-[22px] leading-7 font-medium tracking-[-0.015em]', cell.yieldTone && 'text-yt')}>
            {cell.value}
          </span>
          <span className="num text-xs text-muted-foreground">{cell.sub}</span>
        </div>
      ))}
    </div>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-e1">
      <div className="flex h-11 items-center gap-4 border-b border-border px-4">
        <p className="text-sm font-semibold">{title}</p>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </div>
  )
}

type Row = {
  kind: InstrumentKind
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

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: 'Floating · YT',
    rows: [
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
    ],
  },
  {
    title: 'Fixed · PT',
    rows: [
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
    ],
  },
  {
    title: 'Cash',
    rows: [
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
    ],
  },
]

function PositionsPanel() {
  return (
    <Panel
      title="Positions"
      action={<span className="rounded-lg border border-input px-2.5 py-1 text-xs font-medium">Split USYC</span>}
    >
      <table className="num w-full border-collapse">
        <thead>
          <tr className="text-left">
            {['Instrument', 'Holding', 'Value', 'Rate', 'Maturity', ''].map((head, index) => (
              <th
                key={head || 'action'}
                className={cn('label-caps border-b border-border px-4 py-2 font-medium', (index === 1 || index === 2) && 'text-right')}
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((group) => (
            <PositionGroup key={group.title} title={group.title} rows={group.rows} />
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        PT and YT are visible to Bank and the Operator. USDC to Bank and the USDC Issuer.
      </p>
    </Panel>
  )
}

function PositionGroup({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <>
      <tr>
        <td colSpan={6} className="label-caps border-b border-border px-4 py-1.5">
          {title}
        </td>
      </tr>
      {rows.map((row) => {
        const isYield = row.kind === 'yt'
        return (
          <tr key={row.name} className="border-b border-border last:border-b-0">
            <td className="px-4 py-2.5">
              <span className="flex items-center gap-2.5">
                <InstrumentGlyph kind={row.kind} />
                <span>
                  <span className="block font-medium whitespace-nowrap">{row.name}</span>
                  <span className="block text-xs whitespace-nowrap text-muted-foreground">{row.sub}</span>
                </span>
              </span>
            </td>
            <td className="px-4 py-2.5 text-right whitespace-nowrap">
              {row.holding}
              {row.holdingSub && <span className="block text-xs text-muted-foreground">{row.holdingSub}</span>}
            </td>
            <td className="px-4 py-2.5 text-right whitespace-nowrap">
              <span className={cn(isYield && 'text-yt')}>{row.value}</span>
              {row.valueSub && <span className="block text-xs text-muted-foreground">{row.valueSub}</span>}
            </td>
            <td className="px-4 py-2.5 whitespace-nowrap">
              <span className={cn(isYield && 'text-yt')}>{row.rate}</span>
              {row.rateSub && <span className="block text-xs text-muted-foreground">{row.rateSub}</span>}
            </td>
            <td className="px-4 py-2.5 whitespace-nowrap">
              {row.maturity ? (
                <span className="flex items-center gap-2.5">
                  <MaturityBar elapsedDays={JAN_1} totalDays={TERM_DAYS} className="w-20" />
                  {DAYS_LEFT} d
                </span>
              ) : (
                '—'
              )}
            </td>
            <td className="px-4 py-2.5 text-right">
              {row.action && (
                <span
                  className={cn(
                    'inline-block rounded-lg px-2.5 py-1 text-xs font-medium',
                    row.actionEnabled ? 'border border-input text-foreground' : 'text-faint',
                  )}
                >
                  {row.action}
                </span>
              )}
            </td>
          </tr>
        )
      })}
    </>
  )
}

function MaturitiesPanel() {
  return (
    <Panel title="Maturities">
      <div className="grid gap-2.5 px-4 py-3.5">
        <div className="num flex justify-between">
          <span className="font-semibold">APR 2027</span>
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
      <ul>
        {items.map((item) => (
          <li key={item.title} className="num grid grid-cols-[1fr_auto] gap-x-3 border-b border-border px-4 py-2.5 last:border-b-0">
            <span className="font-medium">{item.title}</span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Settled
            </span>
            <span className="text-xs text-muted-foreground">{item.detail}</span>
            <span className="text-xs text-muted-foreground">{item.date}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
