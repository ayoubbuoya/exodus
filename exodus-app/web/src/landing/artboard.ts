// Artboards: a box that keeps its proportions and holds a picture plus its
// labels, leader lines and cards.
//
// Everything inside an artboard (positions AND font sizes) is written in the
// picture's own canvas pixels and scales with the artboard's width, so the
// composition always keeps its proportions and nothing can overlap on a small
// screen. Used by the glass instrument (glass-geometry.ts) and the privacy
// plate stack (privacy-geometry.ts).
//
// Example: on a 1536 px canvas, a label at x = 768 sits at left: 50%, whatever
// the artboard's size on screen.

/** An artboard: the part of canvas space it shows (it can go past the canvas edges). */
export type Frame = {
  x0: number
  y0: number
  width: number
  height: number
}

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
