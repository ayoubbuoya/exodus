import type { PointerEvent } from 'react'

// Glass panels with the `glass-glow` class have a soft light that follows the
// pointer, on the landing page and in the app alike. One listener on the
// layout (event delegation) writes the pointer position, relative to the panel
// under it, into --mx / --my. The CSS in index.css does the rest, so React
// never re-renders for it. Touch screens have no pointer to follow.
// Use it on a layout's root element: <div onPointerMove={followPointer}>.
export function followPointer(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse') return
  const panel = (event.target as Element).closest<HTMLElement>('.glass-glow')
  if (panel === null) return
  const box = panel.getBoundingClientRect()
  panel.style.setProperty('--mx', `${event.clientX - box.left}px`)
  panel.style.setProperty('--my', `${event.clientY - box.top}px`)
}
