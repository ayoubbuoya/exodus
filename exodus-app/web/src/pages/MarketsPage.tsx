// /markets: every market, like Pendle's market list. Each card shows the
// maturity, the underlying APY, the fixed APY you get by buying PT now, and
// the house dealer's indicative PT price (real quotes stay private).
//
// PT and YT are Exodus tokens on top of the SIMULATED USYC (the Wallet page
// is where you get USYC).
import { Link } from 'react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useMarkets } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { FormError } from '@/components/FormError'
import { MarketStats } from '@/components/markets/MarketStats'
import { SimulatedBadge } from '@/components/SimulatedBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function MarketsPage() {
  const markets = useMarkets()

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Markets</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Split simulated USYC into two tokens: <strong className="text-foreground">PT</strong> (principal token,
          worth 1 USD at maturity, so buying it below 1 locks a fixed rate) and{' '}
          <strong className="text-foreground">YT</strong> (yield token, gets all the USYC yield until maturity). Trade PT
          privately with the house dealer: nobody else sees your price.
        </p>
      </div>

      {markets.isPending && <Skeleton className="h-44 w-full" />}
      {markets.isError && <FormError error={markets.error} />}
      {markets.data?.items.length === 0 && (
        <p className="text-sm text-muted-foreground">No market yet. Run `npm run bootstrap` to create the demo market.</p>
      )}
      {markets.data?.items.map((market) => <MarketCard key={market.marketId} market={market} />)}
    </div>
  )
}

function MarketCard({ market }: { market: MarketView }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="num">{market.marketId}</span>
          {market.matured ? <Badge variant="secondary">Matured</Badge> : <Badge variant="outline">Open</Badge>}
          <SimulatedBadge />
        </CardTitle>
        <CardDescription>
          {market.symbols.pt} + {market.symbols.yt} on simulated {market.instrument}
        </CardDescription>
        <CardAction>
          <Button asChild size="sm">
            <Link to={`/markets/${encodeURIComponent(market.marketId)}`}>
              Open
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <MarketStats market={market} />
      </CardContent>
    </Card>
  )
}
