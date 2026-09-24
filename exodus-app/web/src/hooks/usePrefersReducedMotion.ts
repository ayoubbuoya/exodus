import { useMediaQuery } from './useMediaQuery.ts'

// True when the user asked their system for less motion.
//
// Animations on the landing page check this: with reduced motion we show the
// final state straight away (for example the hero diagram fully drawn, or the
// split instrument jumping to its end position).
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)')
}
