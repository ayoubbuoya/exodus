import { cn } from 'cn'

// A small square that says which kind of instrument a row is about.
// - PT (principal): filled with the text colour.
// - YT (yield): filled with copper (copper always means yield).
// - Cash (USDC) and the asset (USYC): outlined only, so the two Exodus
//   instruments stand out in a list of positions.
export type InstrumentKind = 'pt' | 'yt' | 'cash' | 'asset'

const TEXT: Record<InstrumentKind, string> = { pt: 'PT', yt: 'YT', cash: '$', asset: 'SY' }

type InstrumentGlyphProps = {
  kind: InstrumentKind
  className?: string
}

export function InstrumentGlyph({ kind, className }: InstrumentGlyphProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-grid size-5 shrink-0 place-items-center rounded-sm text-[9px] leading-none font-bold tracking-[0.02em]',
        kind === 'pt' && 'bg-pt text-background',
        kind === 'yt' && 'bg-yt text-background',
        (kind === 'cash' || kind === 'asset') && 'border border-input text-muted-foreground',
        className,
      )}
    >
      {TEXT[kind]}
    </span>
  )
}
