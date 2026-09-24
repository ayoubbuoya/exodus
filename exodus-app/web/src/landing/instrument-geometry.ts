// Geometry of the instrument renders in public/instrument/.
//
// All layers share one 1510 × 720 canvas, so a point measured on the render
// (in canvas pixels) can be placed on screen and stay glued to the metal at
// any size.
//
// The hero and the split story draw the instrument inside an ARTBOARD: a box
// a bit bigger than the canvas that also holds the labels, leader lines and
// the maturity line. Everything in it (including font sizes) is expressed in
// canvas units and scales with the artboard's width, so the composition always
// keeps its proportions and nothing can overlap on a small screen.

export const CANVAS_WIDTH = 1510
export const CANVAS_HEIGHT = 720

/**
 * How far the yield plate slides away, in canvas pixels. It moves along the
 * plate's long axis (direction 0.956, −0.294), far enough to show the cut
 * clearly but close enough to still read as one instrument.
 */
export const SLIDE = { x: 81, y: -25 } as const

// The seam between the plates on the top face, traced from the colours of the
// joined render (where the silver meets the copper), in canvas pixels.
export const SEAM_POINTS = '1014,58 822,271 710,308 702,317 666,360 668,367 824,478 826,558'

// Anchor points measured on the renders (canvas pixels), used by leader lines.
export const ANCHORS = {
  // Front bottom edge of the principal plate.
  principalFront: { x: 300, y: 643 },
  // Top edge of the yield plate once it has slid away (x 1200 + 81, y 81 − 25).
  yieldTopSlid: { x: 1281, y: 56 },
} as const

/** An artboard: the part of canvas space it shows (it can go past the canvas edges). */
export type Frame = {
  x0: number
  y0: number
  width: number
  height: number
}

/** The hero: room above for the YT tag, below for the PT tag and the time axis, right for the meridian. */
export const HERO_FRAME: Frame = { x0: -20, y0: -210, width: 1640, height: 1270 }

/** The split story: room above for the YT amount and below for the PT amount. */
export const SPLIT_FRAME: Frame = { x0: 0, y0: -200, width: 1510, height: 1100 }

/** Canvas x → CSS `left` inside the artboard. */
export const artX = (frame: Frame, x: number) => `${((x - frame.x0) / frame.width) * 100}%`
/** Canvas x → CSS `right` inside the artboard (for right-aligned labels). */
export const artRight = (frame: Frame, x: number) => `${((frame.x0 + frame.width - x) / frame.width) * 100}%`
/** Canvas y → CSS `top` inside the artboard. */
export const artY = (frame: Frame, y: number) => `${((y - frame.y0) / frame.height) * 100}%`
/** A vertical distance in canvas pixels → CSS `height` inside the artboard. */
export const artH = (frame: Frame, dy: number) => `${(dy / frame.height) * 100}%`
/**
 * A size in canvas pixels (for example a font size) that scales with the
 * artboard's width, never below `minPx` so text stays readable.
 * `cqw` works because the artboard is a CSS size container.
 */
export const artSize = (frame: Frame, units: number, minPx = 0) =>
  `max(${minPx}px, calc(${units} * 100cqw / ${frame.width}))`
