import { useEffect, useState } from 'react'

// The current time in milliseconds, updated every `intervalMs`.
// Components must not call Date.now() while rendering (the result would change
// from one render to the next), so they read the time from this hook instead.
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
