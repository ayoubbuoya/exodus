// The headline numbers of one market, like a row of Pendle's market list:
//   Fixed APY (buy PT) · Underlying APY · PT price · Maturity
// Example on Oct 1: 5.10% · — · 0.975503 USDC · Apr 1, 2027 (182 days)
//
// Colour meaning: the fixed APY belongs to PT (principal), so it stays silver;
// the underlying APY is a floating rate, so it takes the yield blue.
import type { ReactNode } from 'react'
import { cn } from 'cn'
import { formatAmount } from '@exodus/ledger'
import type { MarketView } from '@/api/types'
import { formatDemoDate, formatPercent } from '@/lib/format'

export function MarketStats({ market, className }: { market: MarketView; className?: string }) {
  const prices = market.indicative
  return (
    <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4', className)}>
      <Stat label="Fixed APY" hint={prices === null ? 'Trading closed at maturity' : 'If you buy PT now'}>
        {formatPercent(prices?.askFixedApyPercent ?? null)}
      </Stat>
      <Stat label="Underlying APY" hint="USYC, last 30 demo days" yieldTone>
        {formatPercent(market.underlyingApyPercent)}
      </Stat>
      <Stat label="PT price" hint={prices === null ? '1 PT = 1 USD of USYC' : `Sell at ${formatAmount(prices.bidPrice, 6)}`}>
        {prices === null ? '1.00' : formatAmount(prices.askPrice, 6)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">USDC</span>
      </Stat>
      <Stat
        label="Maturity"
        hint={market.matured ? `Matured at index ${formatAmount(market.maturityIndex ?? '0', 4)}` : `${market.daysToMaturity} demo days left`}
      >
        {formatDemoDate(market.maturity)}
      </Stat>
    </dl>
  )
}

function Stat({ label, hint, yieldTone = false, children }: { label: string; hint: string; yieldTone?: boolean; children: ReactNode }) {
  return (
    <div className="grid min-w-0 content-start gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('num text-lg font-medium', yieldTone && 'text-yt')}>{children}</dd>
      <dd className="num text-xs text-faint">{hint}</dd>
    </div>
  )
}
