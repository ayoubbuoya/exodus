// A round badge that says which token a row is about (the same badges as the
// landing page's app preview):
//   PT    solid silver: principal
//   YT    solid yield blue: yield
//   USYC  a ring with a landmark: the simulated T-bill fund share
//   USDC  a ring with a dollar sign: simulated cash
// Get the kind from a symbol with tokenKindOf (lib/tokens.ts).
import { DollarSignIcon, LandmarkIcon } from 'lucide-react'
import { cn } from 'cn'
import type { TokenKind } from '@/lib/tokens'

export function TokenIcon({ kind, className }: { kind: TokenKind; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-9 shrink-0 place-items-center rounded-full text-[10px] font-bold',
        kind === 'pt' && 'bg-pt text-background',
        kind === 'yt' && 'bg-yt text-background',
        (kind === 'usyc' || kind === 'usdc') && 'text-muted-foreground ring-1 ring-foreground/15 ring-inset',
        className,
      )}
    >
      {kind === 'pt' && 'PT'}
      {kind === 'yt' && 'YT'}
      {kind === 'usyc' && <LandmarkIcon className="size-4" strokeWidth={1.6} />}
      {kind === 'usdc' && <DollarSignIcon className="size-4" strokeWidth={1.6} />}
    </span>
  )
}
