// The demo calendar, always in view (sidebar on desktop, top bar on phones).
//
// Exodus runs on a simulated clock: the oracle bot moves the demo date
// forward (7 days every 5 s with `npm run oracle`) and publishes the USYC
// price for that date. Maturity, days left and yield all follow this date,
// not the real one, so the user should always see it. Example:
//   Demo date  Oct 1, 2026   ● Live
//   182 days to maturity
//
// "Live" means the newest price is still valid (30 s); "Paused" means the
// oracle bot stopped, and the fund and markets refuse orders until it is back.
// The price endpoint is public, so this works for visitors too.
import { CalendarClockIcon } from 'lucide-react'
import { cn } from 'cn'
import { useLatestPrice } from '@/api/hooks'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatDemoDate } from '@/lib/format'

type DemoClockProps = {
  // "card": the sidebar block. "chip": one short line for the phone top bar.
  variant: 'card' | 'chip'
}

export function DemoClock({ variant }: DemoClockProps) {
  const price = useLatestPrice()
  // Before the first answer (or with the ledger not set up yet) there is
  // nothing true to show: keep the space quiet rather than guess a date.
  if (price.data === undefined) {
    return variant === 'card' ? <div className="h-[74px] rounded-2xl bg-foreground/[0.03]" aria-hidden /> : null
  }
  const { simTime, isLive, daysToMaturity } = price.data

  if (variant === 'chip') {
    return (
      <span className="num flex h-9 items-center gap-2 rounded-full bg-foreground/[0.06] px-3 text-xs">
        <FeedDot isLive={isLive} />
        {formatDemoDate(simTime)}
      </span>
    )
  }
  return (
    <div className="num grid gap-1 rounded-2xl bg-foreground/[0.04] p-3 text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <CalendarClockIcon className="size-3.5" aria-hidden />
        Demo date
        <FeedStatus isLive={isLive} />
      </div>
      <p className="text-[15px] font-medium text-foreground">{formatDemoDate(simTime)}</p>
      <p className="text-muted-foreground">{daysToMaturity} days to maturity</p>
    </div>
  )
}

// A dot plus a word, so the state is never told by colour alone.
function FeedStatus({ isLive }: { isLive: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="ml-auto flex items-center gap-1.5 rounded-full text-foreground">
          <FeedDot isLive={isLive} />
          {isLive ? 'Live' : 'Paused'}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-64">
        {isLive
          ? 'The oracle is publishing prices. Each price is usable for 30 seconds.'
          : 'No fresh price: the oracle bot is not running (npm run oracle). Orders wait until it is back.'}
      </TooltipContent>
    </Tooltip>
  )
}

function FeedDot({ isLive }: { isLive: boolean }) {
  return (
    <span className="relative flex size-2" aria-hidden>
      {isLive && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />}
      <span className={cn('relative inline-flex size-2 rounded-full', isLive ? 'bg-success' : 'bg-warning')} />
    </span>
  )
}
