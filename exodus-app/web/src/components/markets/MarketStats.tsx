// The headline numbers of one market, like a row of Pendle's market list:
//   Maturity · Underlying APY · Fixed APY (buy PT) · PT price
// Used on the market cards (/markets) and at the top of a market's page.
//
// Example on Oct 1: Apr 1, 2027 (182 days) · — · 5.10% · 0.975503 USDC
import type { ReactNode } from 'react'
import { formatAmount } from '@exodus/ledger'
import type { MarketView } from '@/api/types'
import { formatDemoDate, formatPercent } from '@/lib/format'

export function MarketStats({ market }: { market: MarketView }) {
  const prices = market.indicative
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <Stat
        label="Maturity"
        hint={market.matured ? `Matured at index ${formatAmount(market.maturityIndex ?? '0', 4)}` : `${market.daysToMaturity} demo days left`}
      >
        {formatDemoDate(market.maturity)}
      </Stat>
      <Stat label="Underlying APY" hint="USYC, last 30 demo days">
        <span className="num text-yt">{formatPercent(market.underlyingApyPercent)}</span>
      </Stat>
      <Stat label="Fixed APY" hint={prices === null ? 'Trading closed at maturity' : 'If you buy PT now'}>
        <span className="num text-primary">{formatPercent(prices?.askFixedApyPercent ?? null)}</span>
      </Stat>
      <Stat label="PT price" hint={prices === null ? '1 PT = 1 USD of USYC' : `Sell at ${formatAmount(prices.bidPrice, 6)}`}>
        <span className="num">{prices === null ? '1.00' : formatAmount(prices.askPrice, 6)}</span>
        <span className="ml-1 text-sm font-normal text-muted-foreground">USDC</span>
      </Stat>
    </div>
  )
}

function Stat({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-lg font-semibold sm:text-xl">{children}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}
