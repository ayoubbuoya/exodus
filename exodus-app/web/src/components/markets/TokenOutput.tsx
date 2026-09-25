// What a market action gives back, as token rows with their badges. Example
// (mint 30 USYC at index 1.0095):
//   You get
//   [PT] PT-USYC-APR2027                30.285
//   [YT] YT-USYC-APR2027                30.285
//   At index 1.0095 · rounded down to 6 decimals
import type { ReactNode } from 'react'
import { formatAmount } from '@exodus/ledger'
import { TokenIcon } from '@/components/finance/TokenIcon'
import { tokenKindOf } from '@/lib/tokens'

type TokenOutputProps = {
  title: string
  // amount null = not known yet (no valid amount typed): shows "—".
  lines: { symbol: string; amount: string | null }[]
  note?: ReactNode
}

export function TokenOutput({ title, lines, note }: TokenOutputProps) {
  return (
    <div className="grid gap-3 rounded-2xl bg-foreground/3 p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <ul className="grid gap-2.5">
        {lines.map((line) => (
          <li key={line.symbol} className="flex items-center gap-3">
            <TokenIcon kind={tokenKindOf(line.symbol)} className="size-7 text-[9px]" />
            <span className="ident min-w-0 truncate text-sm">{line.symbol}</span>
            <span className="num ml-auto font-medium">{line.amount === null ? '—' : formatAmount(line.amount)}</span>
          </li>
        ))}
      </ul>
      {note !== undefined && <p className="num text-xs text-faint">{note}</p>}
    </div>
  )
}
