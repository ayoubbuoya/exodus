// Geometry of the Glacier instrument: the silver "C" block (PRINCIPAL) with the
// blue glass wedge (YIELD) seated in its slot.
//
// Everything is measured on one 1536 × 1024 canvas, the size of the Codex
// renders (assets/glass/, see docs/client-app.md). Two things draw on it:
//   - the vector version in GlassStage.tsx (used until the renders exist),
//     built from the paths below,
//   - the renders themselves, once they are in public/glass/.
// Labels, leader lines and the seam overlay use the same canvas units, so
// they stay glued to the object at any screen size (see artX / artY / artSize
// in instrument-geometry.ts, which work for any Frame).
//
// When the renders land, re-measure ANCHORS, SLIDE and WEDGE_FRONT on them;
// the vector paths can stay as they are.
import type { Frame } from './instrument-geometry.ts'

export const GLASS_WIDTH = 1536
export const GLASS_HEIGHT = 1024

/**
 * The front face of the silver block: a rounded square (520–1060 × 280–820)
 * with a V-shaped slot cut into its right side. The slot's mouth runs from
 * y 404 to y 716 on the right edge and its point is at (770, 560).
 */
export const SHELL_FRONT =
  'M620 280H960Q1060 280 1060 380V392Q1060 404 1049 410L790 549Q770 560 790 571L1049 710Q1060 716 1060 728V740Q1060 820 980 820H620Q520 820 520 720V380Q520 280 620 280Z'

/**
 * The front face of the glass wedge: its point sits in the slot (800, 560),
 * about 14 px inside the slot walls, and its wide end (350–770) stands out
 * past the block's right edge, like a wedge pushed into a V groove.
 */
export const WEDGE_FRONT = 'M822 548L1150 367Q1180 350 1180 385V735Q1180 770 1150 753L822 572Q800 560 822 548Z'

/**
 * Depth: the block goes back up and to the left, so we see its top and left
 * faces (the light comes from the top left). The vector version fakes the
 * depth by stacking DEPTH_LAYERS copies of each face, each one moved by
 * DEPTH_STEP. Example: 24 layers × (−4.6, −3) = a block 110 px deep on screen.
 */
export const DEPTH_STEP = { x: -4.6, y: -3 } as const
export const DEPTH_LAYERS = 24

/**
 * How far the glass wedge slides out of the slot, in canvas pixels, when the
 * instrument splits (--slide = 1). The slot is symmetric about y = 560, so
 * the wedge comes straight out to the right.
 */
export const SLIDE = { x: 200, y: 0 } as const

// Points measured on the object (canvas pixels), used by leader lines.
export const ANCHORS = {
  // Bottom edge of the silver block, a little in from its left corner.
  shellBottom: { x: 610, y: 820 },
  // Top right corner of the wedge once it has slid out (1180 + 200, 350).
  wedgeTopSlid: { x: 1370, y: 352 },
  // The middle of the wedge's wide face once it has slid out: the quote card sits below it.
  wedgeFaceSlid: { x: 1380, y: 560 },
} as const

/**
 * The artboard the hero and the split story show: the object plus room for
 * the YT label above, the PT label below and the quote card on the right.
 * Its ratio is 1236 / 900 = 1.373 (the layout code uses that number).
 */
export const GLASS_FRAME: Frame = { x0: 300, y0: 100, width: 1236, height: 900 }
