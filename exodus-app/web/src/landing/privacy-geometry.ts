// Geometry of the privacy plate stack in public/privacy/.
//
// The four layers (shadow, cash, PT, terms) share one 1070 × 920 canvas, cut
// from 1536 × 1024 renders at (250, 96) by the frontend's local asset
// pipeline (not in the repo): blue glass = price and rate (the Quote),
// silver = the PT leg, dark metal = the cash leg.
//
// The artboard is wider than the stack: the space on its right holds one
// label per plate, joined to the plate's right edge by a short leader line.
// Everything is in canvas pixels and scales with the artboard (see artSize).
import type { Frame } from './artboard.ts'
import type { PlateLayer } from './privacy-lens-data.ts'

export const STACK_WIDTH = 1070
export const STACK_HEIGHT = 920

/** Stack on the left (0–1070), labels on the right (up to 1700). */
export const PRIVACY_FRAME: Frame = { x0: 0, y0: 0, width: 1700, height: STACK_HEIGHT }

/** Where each plate's right edge is (canvas pixels), measured on the renders. */
export const PLATE_EDGE: Record<PlateLayer, { x: number; y: number }> = {
  // Measured on the renders: each plate's rightmost point.
  terms: { x: 1064, y: 125 },
  pt: { x: 1033, y: 364 },
  cash: { x: 1033, y: 578 },
}

/** Where the leader lines end and the labels start. */
export const LABEL_X = 1120
