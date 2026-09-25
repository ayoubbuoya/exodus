// The row of headline numbers at the top of the dashboard:
// USYC price · 30-day APY · demo date · live status.
// Numbers, not a chart: each is a single current value (the chart below shows the trend).
import type { ReactNode } from 'react'
import { formatAmount } from '@exodus/ledger'
import { cn } from 'cn'
import { useLatestPrice } from '@/api/hooks'
import { FormError } from '@/components/FormError'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDemoDate } from '@/lib/format'

export function PriceStrip() {
  const price = useLatestPrice()

  if (price.isPending) {
    return <Skeleton className="h-24 w-full" />
  }
  if (price.isError) {
    return <FormError error={price.error} />
  }
  const latest = price.data
  return (
    <Card className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
      <Stat label="USYC price">
        <span className="num">${formatAmount(latest.index, 4)}</span>
      </Stat>
      <Stat label="APY (30 demo days)">
        <span className="num text-gold">{latest.apy30dPercent === null ? '—' : `${latest.apy30dPercent.toFixed(2)}%`}</span>
      </Stat>
      <Stat label="Demo date" hint={`${latest.daysToMaturity} days to maturity`}>
        {formatDemoDate(latest.simTime)}
      </Stat>
      <Stat label="Price feed">
        <LiveStatus isLive={latest.isLive} />
      </Stat>
    </Card>
  )
}

function Stat({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold sm:text-2xl">{children}</span>
      {hint !== undefined && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

// A dot plus a word, so the state is never told by color alone.
// "Paused" means the newest price snapshot expired: the oracle bot is not
// running, and the fund refuses subscriptions until a fresh price arrives.
function LiveStatus({ isLive }: { isLive: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-2" tabIndex={0}>
          <span className="relative flex size-2.5">
            {isLive && <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />}
            <span className={cn('relative inline-flex size-2.5 rounded-full', isLive ? 'bg-primary' : 'bg-warning')} />
          </span>
          {isLive ? 'Live' : 'Paused'}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {isLive
          ? 'The oracle is publishing prices. Each price is usable for 30 seconds.'
          : 'No fresh price: the oracle bot is not running (npm run oracle). Subscribing is paused until it is.'}
      </TooltipContent>
    </Tooltip>
  )
}
