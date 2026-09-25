// The house dealer's inventory (Bank): PT free to quote and PT locked in live
// buy quotes, YT and its claimable yield, USDC (and the part set aside for
// live sell quotes), USYC, and the live quotes themselves.
//
// Bank's own payouts are here too (Phase 7 choice 1A), for the spec demo:
//   Jan 1:  "Claim Bank's yield" on 1000 YT -> 24.390243 USYC
//   Apr 1:  "Redeem Bank's PT" -> 1 USD of USYC per PT
import type { ReactNode } from 'react'
import { formatAmount, partyName } from '@exodus/ledger'
import { toast } from 'sonner'
import { useDealerPayout, useDealerPosition, useMarkets } from '@/api/market-hooks'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPercent } from '@/lib/format'
import { formatSecondsLeft } from '@/lib/markets'
import { useNow } from '@/useNow'

export function DealerPositionCard() {
  const position = useDealerPosition()
  const markets = useMarkets()
  const payout = useDealerPayout()
  const now = useNow(1000)

  function isMatured(marketId: string): boolean {
    return markets.data?.items.find((market) => market.marketId === marketId)?.matured === true
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
        <CardTitle>House dealer position (Bank)</CardTitle>
        <CardDescription>What the dealer bot can quote from. Refreshes every 2 seconds.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {position.isPending && <Skeleton className="h-32 w-full" />}
        {position.isError && <FormError error={position.error} />}
        {position.data !== undefined && (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Stat label="USDC">{formatAmount(position.data.usdc)}</Stat>
              <Stat label="USDC set aside">{formatAmount(position.data.usdcSetAside)}</Stat>
              <Stat label="USYC">{formatAmount(position.data.usyc)}</Stat>
            </dl>
            {position.data.markets.map((market) => (
              <div key={market.marketId} className="flex flex-col gap-3 rounded-md border p-3">
                <span className="num text-sm font-medium">{market.marketId}</span>
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label="PT free">{formatAmount(market.ptFree)}</Stat>
                  <Stat label="PT locked">{formatAmount(market.ptLocked)}</Stat>
                  <Stat label="YT">{formatAmount(market.ytTotal)}</Stat>
                  <Stat label="Claimable">{formatAmount(market.claimableUsyc ?? '0')} USYC</Stat>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={Number(market.ytTotal) === 0 || payout.isPending}
                    onClick={() => handlePayout(market.marketId, 'claims')}
                  >
                    Claim Bank's yield
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!isMatured(market.marketId) || Number(market.ptFree) === 0 || payout.isPending}
                    onClick={() => handlePayout(market.marketId, 'pt-redemptions')}
                  >
                    Redeem Bank's PT
                  </Button>
                </div>
              </div>
            ))}
            <FormError error={payout.error} />
            <section aria-labelledby="live-quotes" className="flex flex-col gap-2">
              <h3 id="live-quotes" className="text-sm font-medium">
                Live quotes ({position.data.liveQuotes.length})
              </h3>
              {position.data.liveQuotes.map((quote) => (
                <div key={quote.quoteId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {quote.side === 'BuyPt' ? 'Sells' : 'Buys'} <span className="num">{formatAmount(quote.ptAmount)} PT</span>{' '}
                    {quote.side === 'BuyPt' ? 'to' : 'from'} {partyName(quote.requester)} at{' '}
                    <span className="num">{formatAmount(quote.price, 6)}</span> ({formatPercent(quote.fixedApyPercent)})
                  </span>
                  <span className="num text-xs text-muted-foreground">{formatSecondsLeft(quote.validUntil, now)}</span>
                </div>
              ))}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="num">{children}</dd>
    </div>
  )
}
