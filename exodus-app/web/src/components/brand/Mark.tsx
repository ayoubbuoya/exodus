import type { SVGProps } from 'react'

// The Exodus mark: the "seated wedge".
//
// It is the flat, front-on version of our 3D instrument (GlassStage.tsx):
// a rounded silver block with a V-shaped slot, and a glass wedge seated in it.
// - the block is PRINCIPAL (PT) and uses the text colour (silver),
// - the wedge is YIELD (YT) and uses the yield blue.
// So the logo says what Exodus does: one instrument → principal + yield, and
// the yield is the part that can come out.
//
// The paths are the canvas paths from landing/glass-geometry.ts scaled by 1/12
// (so 45 × 45 for the block), with the wedge moved 2.5 units right so the gap
// between the two pieces still shows at favicon size. It is drawn as a vector
// so it stays sharp down to 16 px. The box is 58 × 45; give it a height and
// let the width follow.
export function Mark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 58 45" aria-hidden="true" focusable="false" className={className} {...props}>
      {/* The block, with the slot's point at (20.8, 23.3). */}
      <path
        d="M8.33 0H36.67Q45 0 45 8.33V9.33Q45 10.33 44.08 10.83L22.5 22.42Q20.83 23.33 22.5 24.25L44.08 35.83Q45 36.33 45 37.33V38.33Q45 45 38.33 45H8.33Q0 45 0 36.67V8.33Q0 0 8.33 0Z"
        className="fill-pt"
      />
      {/* The wedge, seated in the slot and standing out to the right. */}
      <path
        d="M27.67 22.33L55 7.25Q57.5 5.83 57.5 8.75V37.92Q57.5 40.83 55 39.42L27.67 24.33Q25.83 23.33 27.67 22.33Z"
        className="fill-yt"
      />
    </svg>
  )
}
