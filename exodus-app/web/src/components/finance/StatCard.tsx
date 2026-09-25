// One headline number on its own glass card, with a round icon in the corner
// (like the summary cards of the landing page's app preview).
// Example: "Claimable yield · 24.390243 USYC · ≈ $25.00 at index 1.025"
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import { Skeleton } from '@/components/ui/skeleton'

type StatCardProps = {
  label: string
  // The big number. Pass an <Amount> so the decimals are dimmed.
  value: ReactNode
  // One small line under the number.
  sub?: ReactNode
  icon: LucideIcon
  // "yield": the number is yield (claimable yield, a floating APY), so it
  // takes the yield blue. Everything else stays silver.
  tone?: 'default' | 'yield'
  // true while the data loads: a grey block instead of a wrong 0.
  loading?: boolean
}

export function StatCard({ label, value, sub, icon: Icon, tone = 'default', loading = false }: StatCardProps) {
  return (
    <div className="glass glass-glow rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-full bg-foreground/8', tone === 'yield' && 'text-yt')}>
          <Icon className="size-4" strokeWidth={1.6} aria-hidden />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-2/3" />
      ) : (
        // A little smaller on phones, where two cards share a row.
        <p className={cn('mt-2 font-display text-[22px] leading-none sm:text-[26px]', tone === 'yield' && 'text-yt')}>{value}</p>
      )}
      {sub !== undefined && !loading && <p className="num mt-2.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
