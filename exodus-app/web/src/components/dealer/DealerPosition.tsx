// The house dealer's position (Bank), in two cards:
//
// DealerInventoryCard: per market, PT free to quote and PT locked in live buy
// quotes, YT and its claimable yield, plus Bank's own payouts (Phase 7
// choice W1), for the spec demo:
//   Jan 1:  "Claim Bank's yield" on 1000 YT -> 24.390243 USYC
//   Apr 1:  "Redeem Bank's PT" -> 1 USD of USYC per PT
//
// LiveQuotesCard: the firm quotes waiting for a client, with a countdown.
// Both read the same data (useDealerPosition, refreshed every 2 seconds).
import type { ReactNode } from 'react'
import { formatAmount, partyName } from '@exodus/ledger'
import { toast } from 'sonner'
import { useDealerPayout, useDealerPosition, useMarkets } from '@/api/market-hooks'
import { FormError } from '@/components/FormError'
import { MarketBadge } from '@/components/markets/MarketBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent } from '@/lib/format'
import { formatSecondsLeft, marketName } from '@/lib/markets'
import { useNow } from '@/useNow'

export function DealerInventoryCard() {
  const position = useDealerPosition()
  const markets = useMarkets()
  const payout = useDealerPayout()

  function marketOf(marketId: string) {
    return markets.data?.items.find((market) => market.marketId === marketId)
  }

  function handlePayout(marketId: string, kind: 'claims' | 'pt-redemptions') {
    payout.mutate(
      { marketId, kind },
      { onSuccess: () => toast.success(kind === 'claims' ? "Bank's claim requested." : "Bank's PT redeem requested.") },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventory</CardTitle>
        <CardDescription>What the dealer bot can quote from, per market.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {position.isPending && <Skeleton className="h-32 w-full" />}
        {position.isError && <FormError error={position.error} />}
        {position.data?.markets.map((inventory) => {
          const market = marketOf(inventory.marketId)
          const matured = market?.matured === true
          return (
            <div key={inventory.marketId} className="grid gap-4 rounded-2xl bg-foreground/3 p-4">
              <div className="flex items-center gap-3">
                <MarketBadge />
                <div className="grid min-w-0">
                  <span className="font-medium">{market === undefined ? inventory.marketId : marketName(market)}</span>
                  <span className="ident truncate text-xs text-muted-foreground">{inventory.marketId}</span>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="PT free">{formatAmount(inventory.ptFree)}</Stat>
                <Stat label="PT locked">{formatAmount(inventory.ptLocked)}</Stat>
                <Stat label="YT">{formatAmount(inventory.ytTotal)}</Stat>
                <Stat label="Claimable" yieldTone>
                  {formatAmount(inventory.claimableUsyc ?? '0')} USYC
                </Stat>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={Number(inventory.ytTotal) === 0 || payout.isPending}
                  onClick={() => handlePayout(inventory.marketId, 'claims')}
                >
                  Claim Bank's yield
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!matured || Number(inventory.ptFree) === 0 || payout.isPending}
                  onClick={() => handlePayout(inventory.marketId, 'pt-redemptions')}
                >
                  Redeem Bank's PT
                </Button>
              </div>
            </div>
          )
        })}
        <FormError error={payout.error} />
      </CardContent>
    </Card>
  )
}

export function LiveQuotesCard() {
  const position = useDealerPosition()
  const now = useNow(1000)
  const quotes = position.data?.liveQuotes ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live quotes</CardTitle>
        <CardDescription>Firm quotes waiting for the client's Accept.</CardDescription>
      </CardHeader>
      <CardContent>
        {position.isPending && <Skeleton className="h-16 w-full" />}
        {position.data !== undefined && quotes.length === 0 && (
          <p className="rounded-2xl bg-foreground/3 px-4 py-6 text-center text-sm text-muted-foreground">No live quote.</p>
        )}
        {quotes.length > 0 && (
          <ul className="grid gap-2">
            {quotes.map((quote) => (
              <li key={quote.quoteId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-foreground/4 px-4 py-3 text-sm">
                <span>
                  {quote.side === 'BuyPt' ? 'Sells' : 'Buys'} <span className="num font-medium">{formatAmount(quote.ptAmount)} PT</span>{' '}
                  {quote.side === 'BuyPt' ? 'to' : 'from'} <span className="font-medium">{partyName(quote.requester)}</span>
                </span>
                <span className="num text-muted-foreground">
                  at {formatAmount(quote.price, 6)} · {formatPercent(quote.fixedApyPercent)}
                </span>
                <span className="num ml-auto text-xs text-muted-foreground">{formatSecondsLeft(quote.validUntil, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, yieldTone = false, children }: { label: string; yieldTone?: boolean; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={yieldTone ? 'num font-medium text-yt' : 'num font-medium'}>{children}</dd>
    </div>
  )
}
