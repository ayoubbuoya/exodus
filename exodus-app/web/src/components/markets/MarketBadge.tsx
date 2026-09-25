// The two tokens of a market, overlapping: silver PT (principal) in front of
// blue YT (yield). It is the market's "logo" in lists and page headers,
// like the seated-wedge mark: one asset, split into principal and yield.
import { cn } from 'cn'
import { TokenIcon } from '@/components/finance/TokenIcon'

export function MarketBadge({ className }: { className?: string }) {
  // A small overlap (6 px), so both letters stay readable.
  return (
    <span aria-hidden className={cn('flex shrink-0 -space-x-1.5', className)}>
      <TokenIcon kind="pt" className="relative z-10 ring-2 ring-background" />
      <TokenIcon kind="yt" className="ring-2 ring-background" />
    </span>
  )
}
