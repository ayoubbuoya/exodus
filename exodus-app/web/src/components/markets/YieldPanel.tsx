// "Yield (YT)": the USYC yield your YT has earned since its lastIndex, and
// the Claim button. The Operator's bot pays the claim in a few seconds.
//
// Example (spec section 9): 1000 YT with lastIndex 1.00, index now 1.025
//   yield = 1000 × (1/1.00 − 1/1.025) = 24.390243 USYC
// After maturity the claim is final: it pays up to the maturity index, and
// the YT is used up (it cannot earn anything more).
import { formatAmount, formatUsd } from '@exodus/ledger'
import { toast } from 'sonner'
import { useClaimYield, usePortfolio } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { Amount } from '@/components/finance/Amount'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function YieldPanel({ market }: { market: MarketView }) {
  const portfolio = usePortfolio()
  const claim = useClaimYield(market.marketId)
  // Wait for the portfolio: showing "0 YT" while it loads would be wrong.
  if (portfolio.isPending) {
    return <Skeleton className="h-48 w-full" />
  }
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const ytTotal = position?.ytTotal ?? '0'
  const claimable = position?.claimableUsyc ?? '0'
  const hasYt = Number(ytTotal) > 0
  const hasYield = Number(claimable) > 0

  function handleClaim() {
    claim.mutate(undefined, {
      onSuccess: () => toast.success('Claim requested. The USYC arrives in a few seconds.'),
    })
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-3 rounded-2xl bg-foreground/3 p-4">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <TokenIcon kind="yt" className="size-6 text-[8px]" />
            Your YT
          </span>
          <span className="font-display text-[28px] leading-none">
            <Amount value={formatAmount(ytTotal)} />
          </span>
        </div>
        {/* The claimable yield: the one number on this tab, in the yield blue. */}
        <div className="grid gap-3 rounded-2xl bg-yt-tint p-4 ring-1 ring-yt/20 ring-inset">
          <span className="text-xs text-muted-foreground">Claimable yield</span>
          <span className="font-display text-[28px] leading-none text-yt">
            <Amount value={formatAmount(claimable)} unit="USYC" />
          </span>
          <span className="num text-xs text-muted-foreground">≈ ${formatUsd(position?.value.claimableUsd ?? 0)}</span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {market.matured
          ? 'The market has matured: this is your final claim, paid up to the maturity index. Your YT is used up after it.'
          : 'Yield = YT × (1 / lastIndex − 1 / index now), in USYC. Claim any time; your YT keeps earning after a claim.'}
      </p>
      <FormError error={claim.error} />
      <Button variant="bright" size="lg" onClick={handleClaim} disabled={!hasYt || claim.isPending}>
        {claim.isPending ? 'Claiming…' : hasYield || market.matured ? 'Claim yield' : 'Nothing to claim yet'}
      </Button>
      {!hasYt && <p className="text-center text-xs text-muted-foreground">No YT yet: mint PT + YT in the "Mint / Redeem" tab.</p>}
      <OpenRequests marketId={market.marketId} />
    </div>
  )
}
