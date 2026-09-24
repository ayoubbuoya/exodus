import { cn } from 'cn'

// How far a position has travelled toward its maturity date.
//
// The bar is the time from issue to maturity; the filled part is the time
// already elapsed, and the short vertical tick at the end is the maturity
// "meridian". Example: split on 01 Oct 2026, maturity 01 Apr 2027 (182 days),
// today 01 Jan 2027 (92 days in) → about 51% filled.
type MaturityBarProps = {
  elapsedDays: number
  totalDays: number
  className?: string
}

export function MaturityBar({ elapsedDays, totalDays, className }: MaturityBarProps) {
  const share = Math.min(1, Math.max(0, elapsedDays / totalDays))
  return (
    <span
      role="img"
      aria-label={`${Math.round(share * 100)}% of the term elapsed`}
      className={cn('relative inline-block h-1 w-24 rounded-[1px] bg-border align-middle', className)}
    >
      <span className="absolute inset-y-0 left-0 rounded-[1px] bg-faint" style={{ width: `${share * 100}%` }} />
      <span className="absolute -top-1 -right-px h-3 w-[1.5px] bg-foreground" />
    </span>
  )
}
