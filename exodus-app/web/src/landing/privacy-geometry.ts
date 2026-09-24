// Geometry of the privacy plate stack in public/privacy/.
//
// The four layers (shadow, cash, PT, terms) share one 1070 × 920 canvas, cut
// from Codex's 1536 × 1024 renders at (250, 96). The glass "terms" plate was
// exported about 4.5% wider than the master, so its web file already carries
// the correction measured against privacy-stack-reference.png: scaled to
// 95.5%, then moved 35 px right and 15 px down (97% outline overlap).
//
// The artboard is wider than the stack: the space on its right holds one
// label per plate, joined to the plate's right edge by a short leader line.
// Everything is in canvas pixels and scales with the artboard (see artSize).
import type { Frame } from './instrument-geometry.ts'
import type { PlateLayer } from './privacy-lens-data.ts'

export const STACK_WIDTH = 1070
export const STACK_HEIGHT = 920

/** Stack on the left (0–1070), labels on the right (up to 1700). */
export const PRIVACY_FRAME: Frame = { x0: 0, y0: 0, width: 1700, height: STACK_HEIGHT }

/** Where each plate's right edge is (canvas pixels), measured on the renders. */
export const PLATE_EDGE: Record<PlateLayer, { x: number; y: number }> = {
  terms: { x: 1029, y: 142 },
  pt: { x: 1031, y: 364 },
  cash: { x: 1033, y: 577 },
}

/** Where the leader lines end and the labels start. */
export const LABEL_X = 1120
