/**
 * Small animation helpers shared by every scene.
 *
 * All motion in Remotion is a pure function of the frame number: the same
 * frame always draws the same picture. These helpers turn "the frame" into a
 * progress value from 0 (not started) to 1 (done).
 */
import type { CSSProperties } from 'react'
import { Easing, interpolate, spring } from 'remotion'
import { FPS } from './theme.ts'

/**
 * A soft spring from 0 to 1 that starts at frame `at`.
 * Used for things that pop in (cards, coins, labels). Damping 200 means no
 * bounce: calm, like Pendle's explainers.
 */
export function enter(frame: number, at: number, durationInFrames = 20): number {
  return spring({ frame: frame - at, fps: FPS, config: { damping: 200 }, durationInFrames })
}

/** A smooth 0 → 1 between two frames (ease in and out), clamped outside. Used for moves and drawn lines. */
export function between(frame: number, start: number, end: number): number {
  return interpolate(frame, [start, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })
}

/** Fades an element in while it slides up by `distance` pixels. `progress` comes from `enter`. */
export function fadeUp(progress: number, distance = 30): CSSProperties {
  return { opacity: progress, transform: `translateY(${(1 - progress) * distance}px)` }
}

/** Linear mix of two numbers: mix(10, 20, 0.5) = 15. */
export function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

/**
 * Formats a number with a fixed number of decimals and thousands separators.
 * Example: money(487.7515, 2) = "487.75", money(1000, 0) = "1,000".
 */
export function money(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
