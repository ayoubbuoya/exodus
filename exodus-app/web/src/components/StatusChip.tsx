// A small status pill: a coloured dot plus a word, so a state is never told
// by colour alone. Examples: "● Open", "● Matured", "● Pending".
//   success      green   (approved, live, open for trading)
//   info         violet  (pending, waiting for someone)
//   warning      amber   (paused, needs attention)
//   destructive  red     (rejected, failed)
//   neutral      grey    (finished, closed)
import type { ReactNode } from 'react'
import { cn } from 'cn'

export type StatusTone = 'success' | 'info' | 'warning' | 'destructive' | 'neutral'

const DOT: Record<StatusTone, string> = {
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  neutral: 'bg-muted-foreground',
}

export function StatusChip({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full bg-foreground/6 px-2.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT[tone])} />
      {children}
    </span>
  )
}
