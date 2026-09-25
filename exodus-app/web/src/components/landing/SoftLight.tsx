import type { CSSProperties } from 'react'
import { cn } from 'cn'

// A still, soft pool of light placed behind one visual (the instrument, the
// privacy plates, the app window). Decoration only.
//
// Why: the landing page's glass panels blur whatever is behind them. On a flat
// dark page there is nothing to blur, so they look like plain grey cards. A
// dim light behind each visual gives the glass something to pick up and gives
// each section its own depth.
// Unlike the old page-wide light, it is NOT fixed to the screen: it lives in
// its section and scrolls away with it, and it never moves on its own.
//
// Place it with position and size classes, inside a `relative` parent. It sits
// at z −10, so it paints under the content (the layout is the stacking context).
// Example: <SoftLight className="inset-[-15%]" color="rgb(80 130 255 / 0.2)" />
type SoftLightProps = {
  /** Position and size, for example "inset-[-15%]" or "top-0 left-1/4 h-2/3 w-1/2". */
  className: string
  /** The colour at the centre; it fades to transparent at the edge. Keep it dim (alpha 0.1–0.25). */
  color: string
  style?: CSSProperties
}

export function SoftLight({ className, color, style }: SoftLightProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute -z-10 rounded-full', className)}
      style={{ background: `radial-gradient(closest-side, ${color}, transparent)`, ...style }}
    />
  )
}
