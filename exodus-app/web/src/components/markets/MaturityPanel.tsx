// "At maturity": redeem your PT for USYC once the market has matured.
//
// 1 PT always pays 1 USD of USYC, at the price of the moment the Operator
// pays it (like Pendle). Example: 500 PT at index 1.05 -> 476.190476 USYC.
// Before maturity this tab only explains what will happen.
import { CalendarClockIcon } from 'lucide-react'
import { formatAmount, formatUsd, previewPtRedeem } from '@exodus/ledger'
import { toast } from 'sonner'
import { usePortfolio, useRedeemPt } from '@/api/market-hooks'
import type { MarketView } from '@/api/types'
import { FormError } from '@/components/FormError'
import { OpenRequests } from '@/components/markets/OpenRequests'
import { TokenOutput } from '@/components/markets/TokenOutput'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDemoDate } from '@/lib/format'

export function MaturityPanel({ market }: { market: MarketView }) {
  const portfolio = usePortfolio()
  const redeem = useRedeemPt(market.marketId)
  // Wait for the portfolio: showing "Your PT 0" while it loads would be wrong.
  if (portfolio.isPending) {
    return <Skeleton className="h-40 w-full" />
  }
  const position = portfolio.data?.positions.find((candidate) => candidate.marketId === market.marketId)
  const ptFree = position?.ptFree ?? '0'
  const hasPt = Number(ptFree) > 0
  const preview = hasPt ? previewPtRedeem(ptFree, market.currentIndex) : null

  if (!market.matured) {
    return (
      <div className="grid gap-4">
        <div className="flex items-start gap-4 rounded-2xl bg-foreground/3 p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground/8">
            <CalendarClockIcon className="size-5" strokeWidth={1.6} aria-hidden />
          </span>
          <div className="grid gap-1">
            <p className="font-medium">
              Matures on {formatDemoDate(market.maturity)} · in {market.daysToMaturity} demo days
            </p>
            <p className="text-sm text-muted-foreground">
              Then each PT pays 1 USD of USYC. You hold <span className="num text-foreground">{formatAmount(ptFree)} PT</span>
              , so about <span className="num text-foreground">${formatUsd(Number(ptFree))}</span> of USYC.
            </p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          The market matures by itself. Until then, you can sell PT in "Fixed Yield" or redeem PT + YT together in "Mint /
          Redeem".
        </p>
      </div>
    )
  }

  function handleRedeem() {
    redeem.mutate(undefined, {
      onSuccess: () => toast.success('PT redeem requested. The USYC arrives in a few seconds.'),
    })
  }

  // Matured, but no PT left (never held, or already redeemed): nothing to do
  // here except a payout still on its way.
  if (!hasPt) {
    return (
      <div className="grid gap-4">
        <p className="rounded-2xl bg-foreground/3 px-4 py-6 text-center text-sm text-muted-foreground">
          The market matured at index {formatAmount(market.maturityIndex ?? '0', 4)}. You have no PT left to redeem here.
        </p>
        <OpenRequests marketId={market.marketId} />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        The market matured at index <span className="num text-foreground">{formatAmount(market.maturityIndex ?? '0', 4)}</span>
        . Each PT now pays 1 USD of USYC at today's price.
      </p>
      <TokenOutput
        title={`For your ${formatAmount(ptFree)} PT you get`}
        lines={[{ symbol: 'USYC', amount: preview }]}
        note={`PT ÷ index ${formatAmount(market.currentIndex, 4)} = $${formatUsd(Number(ptFree))} of USYC`}
      />
      <FormError error={redeem.error} />
      <Button variant="bright" size="lg" onClick={handleRedeem} disabled={!hasPt || redeem.isPending}>
        {redeem.isPending ? 'Redeeming…' : 'Redeem PT'}
      </Button>
      <p className="text-xs text-muted-foreground">Holding YT too? Make its final claim in the "Yield (YT)" tab.</p>
      <OpenRequests marketId={market.marketId} />
    </div>
  )
}
