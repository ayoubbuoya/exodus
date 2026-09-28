// /portfolio: the client's market tokens, like Pendle's portfolio page (and
// the app window on our landing page).
//
//   Portfolio value · Claimable yield · Principal at maturity · Next maturity
//   positions: one row per PT and per YT, each with its next action
//   payout requests waiting for the Operator (Cancel)
//   market activity (split, trades, payouts)
//
// USD value follows Pendle: 1 PT = the dealer's mid price (1 after
// maturity), 1 YT = 1 − that price, plus the yield the YT can claim.
// The simulated USYC/USDC themselves are on the Wallet page.
import { Link } from 'react-router'
import { ArrowRightIcon, CalendarClockIcon, ChartPieIcon, ShieldCheckIcon, SparklesIcon } from 'lucide-react'
import { cn } from 'cn'
import { formatAmount, formatUsd } from '@exodus/ledger'
import { useMarkets, usePortfolio } from '@/api/market-hooks'
import type { MarketView, Portfolio } from '@/api/types'
import { ActivityCard } from '@/components/app/ActivityCard'
import { Amount } from '@/components/finance/Amount'
import { StatCard } from '@/components/finance/StatCard'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { FormError } from '@/components/FormError'
import { Page, PageHeader } from '@/components/layout/Page'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDemoDate } from '@/lib/format'
import { nextMaturity, positionRows, sumDecimals, type PositionRow } from '@/lib/portfolio'

export function PortfolioPage() {
  const portfolio = usePortfolio()
  const markets = useMarkets()

  return (
    <Page>
      <PageHeader
        title="Portfolio"
        description="Your PT and YT in every market."
        actions={
          <Button asChild variant="glass">
            <Link to="/markets">
              Markets
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        }
      />
      {portfolio.isError && <FormError error={portfolio.error} />}
      <Summary portfolio={portfolio.data} markets={markets.data?.items} />
      <PositionsCard portfolio={portfolio.data} markets={markets.data?.items ?? []} />
      <ActivityCard scope="markets" />
    </Page>
  )
}

// The four headline numbers. Example (Bank on Jan 1, spec section 9):
//   $537.50 · 24.390243 USYC claimable · $500.00 at maturity · Apr 1, 2027
function Summary({ portfolio, markets }: { portfolio: Portfolio | undefined; markets: MarketView[] | undefined }) {
  const loading = portfolio === undefined
  const positions = portfolio?.positions ?? []
  const claimable = sumDecimals(positions.map((position) => position.claimableUsyc))
  const claimableUsd = positions.reduce((sum, position) => sum + position.value.claimableUsd, 0)
  // Each PT pays 1 USD of USYC at maturity, so the principal is simply the PT count.
  const principal = sumDecimals(positions.map((position) => position.ptTotal))
  const next = markets === undefined ? null : nextMaturity(positions, markets)

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Portfolio value"
        icon={ChartPieIcon}
        loading={loading}
        value={<Amount value={`$${formatUsd(portfolio?.totalUsd ?? 0)}`} />}
        sub="PT and YT, in USD"
      />
      <StatCard
        label="Claimable yield"
        icon={SparklesIcon}
        tone="yield"
        loading={loading}
        value={<Amount value={formatAmount(claimable)} unit="USYC" />}
        sub={`≈ $${formatUsd(claimableUsd)}`}
      />
      <StatCard
        label="Principal at maturity"
        icon={ShieldCheckIcon}
        loading={loading}
        value={<Amount value={`$${formatUsd(Number(principal))}`} />}
        sub={`${formatAmount(principal)} PT · 1 USD of USYC each`}
      />
      <StatCard
        label="Next maturity"
        icon={CalendarClockIcon}
        loading={loading || markets === undefined}
        value={next === null ? '—' : formatDemoDate(next.maturity)}
        sub={next === null ? 'No upcoming maturity' : `${next.daysToMaturity} demo days left`}
      />
    </div>
  )
}

function PositionsCard({ portfolio, markets }: { portfolio: Portfolio | undefined; markets: MarketView[] }) {
  const rows = portfolio === undefined ? [] : positionRows(portfolio.positions)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Positions</CardTitle>
        <CardDescription>Only you and the Operator (who signs PT and YT) can see them.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {portfolio === undefined && <Skeleton className="h-36 w-full" />}
        {portfolio !== undefined && rows.length === 0 && <EmptyPositions />}
        {rows.length > 0 && (
          <ul className="grid">
            {/* Column heads, on wide screens only (phones read each row on its own). */}
            <li aria-hidden className="hidden grid-cols-[minmax(0,1.5fr)_1fr_1fr_auto] gap-4 px-2 pb-2 text-[11.5px] text-faint md:grid">
              <span>Token</span>
              <span className="text-right">Holding</span>
              <span className="text-right">Value</span>
              <span className="w-24" />
            </li>
            {rows.map((row) => (
              <PositionItem key={`${row.marketId}-${row.kind}`} row={row} market={markets.find((market) => market.marketId === row.marketId)} />
            ))}
          </ul>
        )}
        <OpenRequests />
      </CardContent>
    </Card>
  )
}

// One PT or YT holding, with its next action:
//   PT before maturity  Sell (or keep it: it pays 1 USD of USYC at maturity)
//   PT after maturity   Redeem
//   YT                  Claim (bright when there is yield to claim)
function PositionItem({ row, market }: { row: PositionRow; market: MarketView | undefined }) {
  const href = `/markets/${encodeURIComponent(row.marketId)}`
  const maturity = market === undefined ? null : formatDemoDate(market.maturity)
  const isPt = row.kind === 'pt'
  const hasClaimable = Number(row.claimableUsyc) > 0
  const hasLocked = Number(row.lockedPt) > 0

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t border-foreground/6 px-2 py-3.5 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr_auto]">
      <div className="flex min-w-0 items-center gap-3">
        <TokenIcon kind={row.kind} />
        <div className="grid min-w-0">
          <Link to={href} className="ident truncate text-sm font-medium hover:underline">
            {row.symbol}
          </Link>
          <span className="truncate text-xs text-muted-foreground">
            {isPt ? 'Principal' : 'Yield'}
            {row.matured ? ' · matured' : maturity === null ? '' : isPt ? ` · pays 1 USD on ${maturity}` : ` · until ${maturity}`}
          </span>
        </div>
      </div>
      <div className="num grid text-right text-sm max-md:col-start-2 max-md:row-start-1">
        <span className="font-medium">
          {formatAmount(row.amount)} {isPt ? 'PT' : 'YT'}
        </span>
        {hasLocked && <span className="text-xs text-muted-foreground">{formatAmount(row.lockedPt)} locked in a quote</span>}
      </div>
      <div className="num grid text-sm max-md:col-span-2 max-md:flex max-md:items-baseline max-md:gap-2 md:text-right">
        <span>${formatUsd(row.usd)}</span>
        {!isPt && (
          <span className={cn('text-xs', hasClaimable ? 'text-yt' : 'text-muted-foreground')}>
            {formatAmount(row.claimableUsyc)} USYC claimable
          </span>
        )}
      </div>
      <div className="max-md:col-span-2 md:w-24 md:justify-self-end">
        {isPt ? (
          row.matured ? (
            <Button asChild variant="bright" size="sm" className="w-full">
              <Link to={`${href}?tab=maturity`}>Redeem</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to={`${href}?tab=fixed`}>Sell</Link>
            </Button>
          )
        ) : (
          <Button asChild variant={hasClaimable ? 'bright' : 'outline'} size="sm" className="w-full">
            <Link to={`${href}?tab=yield`}>Claim</Link>
          </Button>
        )}
      </div>
    </li>
  )
}

function EmptyPositions() {
  return (
    <div className="grid justify-items-start gap-4 rounded-2xl bg-foreground/3 p-6">
      <div className="grid gap-1">
        <p className="font-medium">No PT or YT yet</p>
        <p className="text-sm text-muted-foreground">
          Buy PT below 1 USD to lock a fixed rate, or mint PT + YT from your USYC.
        </p>
      </div>
      <Button asChild variant="bright">
        <Link to="/markets">
          See the markets
          <ArrowRightIcon data-icon="inline-end" />
        </Link>
      </Button>
    </div>
  )
}
