import { useCallback, useSyncExternalStore } from 'react'

// True while a CSS media query matches, for example '(min-width: 1024px)'.
//
// useSyncExternalStore keeps the value live: resize the window or change a
// system setting and components re-render with the new answer.
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query)
      media.addEventListener('change', onChange)
      return () => media.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}
