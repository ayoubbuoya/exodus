import type { SVGProps } from 'react'

// The Exodus mark: the "cut plate".
//
// It is the view from above of our 3D instrument (the machined plate in
// public/instrument/): one plate cut into two interlocking pieces.
// - the left piece is PRINCIPAL (PT) and uses the text colour,
// - the right piece is YIELD (YT) and uses copper.
// So the logo says what Exodus does: one instrument → principal + yield.
//
// It is drawn as a vector (not a PNG) so it stays sharp down to a 16 px favicon.
// The plate is 64 × 28 (about 2.3 : 1), so give it a width and let the height follow.
export function Mark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 28" aria-hidden="true" focusable="false" className={className} {...props}>
      {/* Principal piece. The notch (29.5–33.5, y 11) is where the yield piece's tongue sits. */}
      <path d="M10 2H39L33.5 11H29.5L35 26H2V10Z" className="fill-pt" />
      {/* Yield piece, offset 2.5 units to the right so a thin cut shows between the two. */}
      <path d="M41.5 2H62V16L52 26H37.5L32 11H36Z" className="fill-yt" />
    </svg>
  )
}
