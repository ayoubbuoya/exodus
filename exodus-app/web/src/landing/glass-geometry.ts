// Geometry of the glass instrument renders in public/glass/: the silver block
// (PRINCIPAL) with the blue glass wedge (YIELD) seated in its slot.
//
// Every layer shares one 1536 × 1024 canvas (one Blender camera), so a point
// measured on a render, in canvas pixels, stays glued to the object at any
// screen size. The numbers below are printed by the Blender render script
// (part of the frontend's local asset pipeline, not in the repo), which
// projects the 3D object onto the image. If the renders change, copy the new
// numbers here.
import type { Frame } from './artboard.ts'

export const GLASS_WIDTH = 1536
export const GLASS_HEIGHT = 1024

/**
 * How far the glass wedge moves on screen when the instrument splits
 * (--slide = 1), in canvas pixels. In 3D it slides 2.1 units straight out of
 * the slot; seen through the camera that is 206 px right and 28 px up
 * (the object is turned, so its "straight out" climbs slightly).
 */
export const SLIDE = { x: 206, y: -28 } as const

// Points measured on the renders (canvas pixels), used by leader lines.
export const ANCHORS = {
  // The lowest point of the silver block (the block spans x 241–896, y 246–917).
  shellBottom: { x: 437, y: 917 },
  // The top of the wedge near its wide face, once it has slid out.
  wedgeTopSlid: { x: 1181, y: 383 },
} as const

/**
 * The artboard the hero and the split story show: the object (block from
 * x 241, wedge up to x 1212 once slid out) plus room for the YT label above,
 * the PT label below and the quote card on the right.
 * Its ratio is 1140 / 900 = 1.267 (the layout code uses that number).
 */
export const GLASS_FRAME: Frame = { x0: 200, y0: 160, width: 1140, height: 900 }
