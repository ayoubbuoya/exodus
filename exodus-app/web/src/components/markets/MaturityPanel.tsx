// "At maturity": redeem your PT for USYC once the market has matured.
//
// 1 PT always pays 1 USD of USYC, at the price of the moment the Operator
// pays it (like Pendle). Example: 500 PT at index 1.05 -> 476.190476 USYC.
// Before maturity this tab only explains what will happen.
import { formatAmount, formatUsd, previewPtRedeem } from '@exodus/ledger'
import { toast } from 'sonner'
import { usePortfolio, useRedeemPt } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDemoDate } from '@/lib/format'

export function MaturityPanel({ market }: { market: MarketView }) {
  const portfolio = usePortfolio()
  const redeem = useRedeemPt(market.marketId)
  // Wait for the portfolio: showing "Your PT 0" while it loads would be wrong.
  if (portfolio.isPending) {
    return <Skeleton className="h-32 w-full" />
  }
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const ptFree = position?.ptFree ?? '0'
  const hasPt = Number(ptFree) > 0
  const preview = hasPt ? previewPtRedeem(ptFree, market.currentIndex) : null

  if (!market.matured) {
    return (
      <p className="text-sm text-muted-foreground">
        On {formatDemoDate(market.maturity)} the market matures by itself. Then each PT pays 1 USD of USYC: you hold{' '}
        <span className="num text-foreground">{formatAmount(ptFree)} PT</span>, so about{' '}
        <span className="num text-foreground">${formatUsd(Number(ptFree))}</span> of USYC. Until then, you can sell PT
        in "Fixed Yield" or redeem PT + YT together in "Mint / Redeem".
      </p>
    )
  }

  function handleRedeem() {
    redeem.mutate(undefined, {
      onSuccess: () => toast.success('PT redeem requested. The USYC arrives in a few seconds.'),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        The market matured at index <span className="num text-foreground">{formatAmount(market.maturityIndex ?? '0', 4)}</span>.
        Each PT now pays 1 USD of USYC at today's price.
      </p>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-muted-foreground">Your PT</dt>
          <dd className="num text-xl font-semibold">{formatAmount(ptFree)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">You get</dt>
          <dd className="num text-xl font-semibold text-gold">{formatAmount(preview ?? '0')} USYC</dd>
          <dd className="text-xs text-muted-foreground">
            PT ÷ index {formatAmount(market.currentIndex, 4)} = ${formatUsd(Number(ptFree))}
          </dd>
        </div>
      </dl>
      <FormError error={redeem.error} />
      <Button size="lg" onClick={handleRedeem} disabled={!hasPt || redeem.isPending}>
        {redeem.isPending ? 'Redeeming…' : 'Redeem PT'}
      </Button>
      <p className="text-xs text-muted-foreground">Holding YT too? Make its final claim in the "Yield (YT)" tab.</p>
      <OpenRequests marketId={market.marketId} />
    </div>
  )
}
