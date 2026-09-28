// A short list of "label ........ value" lines on a faint pane, used under a
// money form to say exactly what will happen. Example (buying 20 PT):
//   Indicative price         0.961358 USDC per PT
//   You pay about            19.227160 USDC
//   Fixed APY                10.28%
//   At maturity              20 USD of USYC · Apr 1, 2027
import type { ReactNode } from 'react'
import { cn } from 'cn'

export type SummaryRow = {
  label: ReactNode
  value: ReactNode
  // "strong": the line that matters most (bright, medium weight).
  // "yield": a yield number (the yield blue).
  tone?: 'default' | 'strong' | 'yield'
}

export function SummaryRows({ rows, className }: { rows: SummaryRow[]; className?: string }) {
  return (
    <dl className={cn('grid gap-2.5 rounded-2xl bg-foreground/3 p-4 text-sm', className)}>
      {rows.map((row, index) => (
        <div key={index} className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              'num text-right',
              row.tone === 'strong' && 'font-medium text-foreground',
              row.tone === 'yield' && 'font-medium text-yt',
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
