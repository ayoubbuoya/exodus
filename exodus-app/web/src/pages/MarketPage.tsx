// /markets/:marketId: one market, laid out like Pendle's market page.
//
//   header: market id, Open/Matured, maturity, underlying APY, fixed APY, PT price
//   tabs (Pendle's words first, the ledger's words in the help text):
//     Fixed Yield (PT)  buy or sell PT privately with the house dealer (RFQ)
//     Mint / Redeem     USYC <-> PT + YT (split / merge on the ledger)
//     Yield (YT)        claim what your YT has earned
//     At maturity       redeem PT for 1 USD of USYC each
//   side card: your PT, YT, claimable yield and USD value in this market
//
// Anyone logged in may look; only approved clients (with a wallet) can act.
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeftIcon } from 'lucide-react'
import { formatAmount, formatUsd } from '@exodus/ledger'
import { useProfile } from '@/api/hooks'
import { useMarket, usePortfolio } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { FormError } from '@/components/FormError'
import { MarketStats } from '@/components/markets/MarketStats'
import { MaturityPanel } from '@/components/markets/MaturityPanel'
import { MintPanel } from '@/components/markets/MintPanel'
import { TradePanel } from '@/components/markets/TradePanel'
import { YieldPanel } from '@/components/markets/YieldPanel'
import { SimulatedBadge } from '@/components/SimulatedBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function MarketPage() {
  const { marketId = '' } = useParams()
  const market = useMarket(marketId)
  const profile = useProfile()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <Link to="/markets" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden />
        All markets
      </Link>
      {market.isPending && <Skeleton className="h-40 w-full" />}
      {market.isError && <FormError error={market.error} />}
      {market.data !== undefined && (
        <>
          <MarketHeader market={market.data} />
          {profile.data?.wallet != null ? (
            <MarketWorkspace market={market.data} />
          ) : (
            <Alert>
              <AlertTitle>Only approved clients can trade</AlertTitle>
              <AlertDescription>
                {profile.data?.role === 'ADMIN'
                  ? 'Admins run the house dealer on the Dealer page.'
                  : 'Your access application must be approved first.'}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  )
}

function MarketHeader({ market }: { market: MarketView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
          <span className="num">{market.marketId}</span>
          {market.matured ? <Badge variant="secondary">Matured</Badge> : <Badge variant="outline">Open</Badge>}
          <SimulatedBadge />
        </CardTitle>
        <CardDescription>
          {market.symbols.pt} (fixed yield) and {market.symbols.yt} (floating yield) on simulated {market.instrument}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MarketStats market={market} />
      </CardContent>
    </Card>
  )
}

// The action tabs and the "your position" card.
function MarketWorkspace({ market }: { market: MarketView }) {
  // After maturity the useful tab is "At maturity"; before, trading PT.
  const firstTab = market.matured ? 'maturity' : 'fixed'
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <Tabs defaultValue={firstTab}>
          <CardHeader>
            <CardTitle className="sr-only">Actions</CardTitle>
            {/* Four tabs do not fit a phone's width: the list scrolls sideways. */}
            <div className="overflow-x-auto">
              <TabsList aria-label="Market actions">
                <TabsTrigger value="fixed">Fixed Yield (PT)</TabsTrigger>
                <TabsTrigger value="mint">Mint / Redeem</TabsTrigger>
                <TabsTrigger value="yield">Yield (YT)</TabsTrigger>
                <TabsTrigger value="maturity">At maturity</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent>
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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your position</CardTitle>
        <CardDescription>Only you (and the Operator, who signs PT and YT) can see it.</CardDescription>
      </CardHeader>
      <CardContent>
        {portfolio.isPending && <Skeleton className="h-28 w-full" />}
        {portfolio.isError && <FormError error={portfolio.error} />}
        {portfolio.data !== undefined && (
          <dl className="flex flex-col gap-3 text-sm">
            <Row label={market.symbols.pt}>
              {formatAmount(position?.ptTotal ?? '0')}
              {Number(position?.ptLocked ?? '0') > 0 && (
                <span className="text-xs text-muted-foreground"> ({formatAmount(position?.ptLocked ?? '0')} locked in a quote)</span>
              )}
            </Row>
            <Row label={market.symbols.yt}>{formatAmount(position?.ytTotal ?? '0')}</Row>
            <Row label="Claimable yield">{formatAmount(position?.claimableUsyc ?? '0')} USYC</Row>
            <Row label="Value">
              <span className="font-semibold">${formatUsd(position?.value.totalUsd ?? 0)}</span>
            </Row>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="num text-right">{children}</dd>
    </div>
  )
}
