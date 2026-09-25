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
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export function YieldPanel({ market }: { market: MarketView }) {
  const portfolio = usePortfolio()
  const claim = useClaimYield(market.marketId)
  if (portfolio.isPending) {
    return <Skeleton className="h-32 w-full" />
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
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Your YT</dt>
          <dd className="num text-xl font-semibold">{formatAmount(ytTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Claimable yield</dt>
          <dd className="num text-xl font-semibold text-gold">{formatAmount(claimable)} USYC</dd>
          <dd className="text-xs text-muted-foreground">≈ ${formatUsd(position?.value.claimableUsd ?? 0)}</dd>
        </div>
      </dl>
      <p className="text-sm text-muted-foreground">
        {market.matured
          ? 'The market has matured: this is your final claim, paid up to the maturity index. Your YT is used up after it.'
          : 'Yield = YT × (1 / lastIndex − 1 / index now), in USYC. Claim any time; your YT keeps earning after a claim.'}
      </p>
      <FormError error={claim.error} />
      <Button size="lg" onClick={handleClaim} disabled={!hasYt || claim.isPending}>
        {claim.isPending ? 'Claiming…' : hasYield || market.matured ? 'Claim yield' : 'Nothing to claim yet'}
      </Button>
      <OpenRequests marketId={market.marketId} />
    </div>
  )
}
