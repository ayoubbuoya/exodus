// /markets: every market, like Pendle's market list. Each row shows the
// asset and maturity, the fixed APY you lock by buying PT now, the underlying
// (floating) APY, the house dealer's indicative PT price, and the days left.
// Real quotes stay private: the price here is only indicative (decision D5).
//
// PT and YT are Exodus tokens on top of the SIMULATED USYC (the Wallet page
// is where you get USYC).
import { Link } from 'react-router'
import { ArrowRightIcon } from 'lucide-react'
import { useProfile } from '@/api/hooks'
import { useMarkets } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { FormError } from '@/components/FormError'
import { Page, PageHeader } from '@/components/layout/Page'
import { MarketBadge } from '@/components/markets/MarketBadge'
import { MarketStats } from '@/components/markets/MarketStats'
import { TradeAccessNote } from '@/components/markets/TradeAccessNote'
import { StatusChip } from '@/components/StatusChip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { marketName } from '@/lib/markets'

export function MarketsPage() {
  const markets = useMarkets()

  return (
    <Page>
      <PageHeader title="Markets" description="Fixed and floating yield on simulated USYC." />
      <TokenExplainer />
      <TradeAccessNote />

      {markets.isPending && <Skeleton className="h-48 w-full rounded-3xl" />}
      {markets.isError && <FormError error={markets.error} />}
      {markets.data?.items.length === 0 && (
        <p className="rounded-3xl bg-foreground/3 px-6 py-10 text-center text-sm text-muted-foreground">
          No market yet. Run <code className="ident">npm run bootstrap</code> to create the demo market.
        </p>
      )}
      <div className="grid gap-4">
        {markets.data?.items.map((market) => <MarketRow key={market.marketId} market={market} />)}
      </div>
    </Page>
  )
}

// The two tokens in one line each, so a first-time visitor knows what PT and
// YT are before looking at the numbers.
function TokenExplainer() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex items-start gap-3 rounded-3xl bg-foreground/3 p-4">
        <TokenIcon kind="pt" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">PT · Fixed yield.</span> Buy it below 1 USD; at maturity it pays
          1 USD of USYC.
        </p>
      </div>
      <div className="flex items-start gap-3 rounded-3xl bg-foreground/3 p-4">
        <TokenIcon kind="yt" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">YT · Floating yield.</span> It earns all the USYC yield until
          maturity.
        </p>
      </div>
    </div>
  )
}

function MarketRow({ market }: { market: MarketView }) {
  const { data: profile } = useProfile()
  const canTrade = profile?.wallet != null
  const href = `/markets/${encodeURIComponent(market.marketId)}`

  return (
    <article aria-labelledby={`market-${market.marketId}`} className="glass glass-sheen glass-glow grid gap-6 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <MarketBadge />
        <div className="grid min-w-0 gap-0.5">
          <h2 id={`market-${market.marketId}`} className="font-display text-[22px] leading-tight">
            <Link to={href} className="hover:underline hover:decoration-foreground/30 hover:underline-offset-4">
              {marketName(market)}
            </Link>
          </h2>
          <p className="ident truncate text-xs text-muted-foreground">
            {market.symbols.pt} · {market.symbols.yt}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {market.matured ? <StatusChip tone="neutral">Matured</StatusChip> : <StatusChip tone="success">Open</StatusChip>}
          <StatusChip tone="neutral">Simulated USYC</StatusChip>
        </div>
      </div>

      <MarketStats market={market} />

      <div className="flex flex-wrap gap-2 border-t border-foreground/8 pt-5">
        {canTrade && !market.matured && (
          <>
            <Button asChild variant="bright">
              <Link to={`${href}?tab=fixed`}>
                Fixed yield
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="glass">
              <Link to={`${href}?tab=mint`}>Mint PT + YT</Link>
            </Button>
          </>
        )}
        {canTrade && market.matured && (
          <Button asChild variant="bright">
            <Link to={`${href}?tab=maturity`}>
              Redeem at maturity
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        )}
        {!canTrade && (
          <Button asChild variant="glass">
            <Link to={href}>
              View market
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </div>
    </article>
  )
}
