import { FlaskConicalIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// A small, always-visible reminder that USYC and USDC here are NOT real.
// Real users will land on this app, so we must never let them think these
// tokens come from Circle. The tooltip gives the full sentence.
//
// It is styled as neutral information, not as a warning: nothing is wrong,
// it is simply a fact about the environment (Meridian spec, palettes).
export function SimulatedBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 border-input font-normal text-muted-foreground">
          <FlaskConicalIcon aria-hidden />
          {/* On phones only the icon shows (the header is narrow); the tooltip still explains it. */}
          <span className="sr-only sm:not-sr-only">Simulated tokens</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        USYC and USDC in Exodus are test tokens issued by our own demo parties. They are not issued by, connected
        to, or endorsed by Circle or Hashnote.
      </TooltipContent>
    </Tooltip>
  )
}
