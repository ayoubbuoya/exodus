import { useEffect, useState, type RefObject } from 'react'

// The current width of an element in CSS pixels, kept up to date on resize.
//
// The hero diagram uses it to draw in real pixels, so its labels stay 12–14 px
// on every screen instead of shrinking with a scaled SVG.
// Returns 0 until the first measurement.
export function useElementWidth(ref: RefObject<Element | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setWidth(Math.round(entry.contentRect.width))
      }
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
