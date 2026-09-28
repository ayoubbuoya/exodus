// /markets/:marketId: one market, laid out like Pendle's market page.
//
//   header: ← All markets · "USYC · Apr 1, 2027" · Open/Matured
//   cards:  Fixed APY · Underlying APY · PT price · Maturity
//   tabs (Pendle's words first, the ledger's words in the help text):
//     Fixed Yield (PT)  buy or sell PT privately with the house dealer (RFQ)
//     Mint / Redeem     USYC <-> PT + YT (split / merge on the ledger)
//     Yield (YT)        claim what your YT has earned
//     At maturity       redeem PT for 1 USD of USYC each
//   side card: your PT, YT, claimable yield and USD value in this market
//
// Anyone logged in may look; only approved clients (with a wallet) can act.
// The open tab lives in the address (?tab=yield), so other pages can link to it.
import { Link, useParams, useSearchParams } from 'react-router'
import { ArrowLeftIcon, CalendarClockIcon, LockIcon, SparklesIcon, TagIcon } from 'lucide-react'
import { formatAmount, formatUsd } from '@exodus/ledger'
import { useProfile } from '@/api/hooks'
import { useMarket, usePortfolio } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { Amount } from '@/components/finance/Amount'
import { StatCard } from '@/components/finance/StatCard'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { FormError } from '@/components/FormError'
import { Page, PageHeader } from '@/components/layout/Page'
import { MarketBadge } from '@/components/markets/MarketBadge'
import { MaturityPanel } from '@/components/markets/MaturityPanel'
import { MintPanel } from '@/components/markets/MintPanel'
import { TradeAccessNote } from '@/components/markets/TradeAccessNote'
import { TradePanel } from '@/components/markets/TradePanel'
import { YieldPanel } from '@/components/markets/YieldPanel'
import { StatusChip } from '@/components/StatusChip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDemoDate, formatPercent } from '@/lib/format'
import { marketName, marketTabFrom } from '@/lib/markets'

export function MarketPage() {
  const { marketId = '' } = useParams()
  const market = useMarket(marketId)
  const profile = useProfile()
  const canTrade = profile.data?.wallet != null

  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link to="/markets" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeftIcon className="size-4" aria-hidden />
            All markets
          </Link>
        }
        title={
          market.data === undefined ? (
            <span className="inline-block h-9 w-64 animate-pulse rounded-xl bg-foreground/6 align-middle" aria-label="Loading" />
          ) : (
            // Phones: the badge above the name, so the name keeps one line.
            <span className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
              <MarketBadge />
              <span>{marketName(market.data)}</span>
            </span>
          )
        }
        description={
          market.data === undefined ? undefined : (
            // Each symbol stays whole; a narrow screen breaks between them.
            <span className="ident flex flex-wrap gap-x-2 text-xs">
              <span>{market.data.symbols.pt}</span>
              <span aria-hidden>·</span>
              <span>{market.data.symbols.yt}</span>
            </span>
          )
        }
        actions={
          market.data === undefined ? undefined : (
            <>
              {market.data.matured ? <StatusChip tone="neutral">Matured</StatusChip> : <StatusChip tone="success">Open</StatusChip>}
              <StatusChip tone="neutral">Simulated USYC</StatusChip>
            </>
          )
        }
      />
      {market.isPending && <Skeleton className="h-32 w-full rounded-3xl" />}
      {market.isError && <FormError error={market.error} />}
      {market.data !== undefined && (
        <>
          <MarketCards market={market.data} />
          {canTrade ? <MarketWorkspace market={market.data} /> : <TradeAccessNote />}
        </>
      )}
    </Page>
  )
}

// The four headline numbers. The fixed APY belongs to PT (principal): silver.
// The underlying APY is floating yield: the yield blue.
function MarketCards({ market }: { market: MarketView }) {
  const prices = market.indicative
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Fixed APY"
        icon={LockIcon}
        value={formatPercent(prices?.askFixedApyPercent ?? null)}
        sub={prices === null ? 'Trading closed at maturity' : 'If you buy PT now'}
      />
      <StatCard
        label="Underlying APY"
        icon={SparklesIcon}
        tone="yield"
        value={formatPercent(market.underlyingApyPercent)}
        sub="USYC, last 30 demo days"
      />
      <StatCard
        label="PT price"
        icon={TagIcon}
        value={<Amount value={prices === null ? '1.00' : formatAmount(prices.askPrice, 6)} />}
        sub={prices === null ? '1 PT = 1 USD of USYC' : `USDC per PT · sell at ${formatAmount(prices.bidPrice, 6)}`}
      />
      <StatCard
        label="Maturity"
        icon={CalendarClockIcon}
        value={formatDemoDate(market.maturity)}
        sub={market.matured ? `Matured at index ${formatAmount(market.maturityIndex ?? '0', 4)}` : `${market.daysToMaturity} demo days left`}
      />
    </div>
  )
}

// The action tabs and the "your position" card.
function MarketWorkspace({ market }: { market: MarketView }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = marketTabFrom(searchParams.get('tab'), market.matured)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        {/* `replace`: switching tabs should not fill the Back button's history. */}
        <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}>
          <CardHeader>
            <CardTitle className="sr-only">Actions</CardTitle>
            {/* Four tabs do not fit a phone's width: the row scrolls sideways. */}
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList aria-label="Market actions" className="w-max min-w-full">
                <TabsTrigger value="fixed">Fixed Yield (PT)</TabsTrigger>
                <TabsTrigger value="mint">Mint / Redeem</TabsTrigger>
                <TabsTrigger value="yield">Yield (YT)</TabsTrigger>
                <TabsTrigger value="maturity">At maturity</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <TabsContent value="fixed">
              <TradePanel market={market} />
            </TabsContent>
            <TabsContent value="mint">
              <MintPanel market={market} />
            </TabsContent>
            <TabsContent value="yield">
              <YieldPanel market={market} />
            </TabsContent>
            <TabsContent value="maturity">
              <MaturityPanel market={market} />
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
      <PositionCard market={market} />
    </div>
  )
}

// Your tokens in this market and what they are worth (Pendle: YT = 1 − PT price).
function PositionCard({ market }: { market: MarketView }) {
  const portfolio = usePortfolio()
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const ptLocked = Number(position?.ptLocked ?? '0')

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>Only you and the Operator (who signs PT and YT) can see it.</CardDescription>
      </CardHeader>
      <CardContent>
        {portfolio.isPending && <Skeleton className="h-36 w-full" />}
        {portfolio.isError && <FormError error={portfolio.error} />}
        {portfolio.data !== undefined && (
          <div className="grid gap-4">
            <p className="font-display text-[30px] leading-none">
              <Amount value={`$${formatUsd(position?.value.totalUsd ?? 0)}`} />
            </p>
            <ul className="grid">
              <li className="flex items-center gap-3 py-2.5">
                <TokenIcon kind="pt" className="size-7 text-[9px]" />
                <span className="text-sm">Principal (PT)</span>
                <span className="num ml-auto grid text-right text-sm font-medium">
                  {formatAmount(position?.ptTotal ?? '0')}
                  {ptLocked > 0 && (
                    <span className="text-xs font-normal text-muted-foreground">{formatAmount(position?.ptLocked ?? '0')} locked in a quote</span>
                  )}
                </span>
              </li>
              <li className="flex items-center gap-3 border-t border-foreground/6 py-2.5">
                <TokenIcon kind="yt" className="size-7 text-[9px]" />
                <span className="text-sm">Yield (YT)</span>
                <span className="num ml-auto text-sm font-medium">{formatAmount(position?.ytTotal ?? '0')}</span>
              </li>
              <li className="flex items-center gap-3 border-t border-foreground/6 py-2.5">
                <span className="grid size-7 place-items-center rounded-full bg-yt-tint text-yt">
                  <SparklesIcon className="size-3.5" aria-hidden />
                </span>
                <span className="text-sm">Claimable yield</span>
                <span className="num ml-auto text-sm font-medium text-yt">{formatAmount(position?.claimableUsyc ?? '0')} USYC</span>
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
