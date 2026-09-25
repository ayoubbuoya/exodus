import type { PointerEvent } from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { LandingNav } from '@/components/landing/LandingNav'
import { SPEC_URL } from '@/components/landing/links'
import { Logo } from './Logo.tsx'

// The frame of the public landing page: its own top bar, the page, a footer,
// and the ambient light behind it all.
//
// The landing page is ALWAYS dark (the Glacier look), whatever theme the
// visitor picked for the app: the `dark` class here re-applies the dark tokens
// to everything inside.
//
// It is separate from SiteLayout (used by /lab) because the landing page is
// editorial and cinematic, while the app screens are compact software.
export function MarketingLayout() {
  return (
    // `isolate` makes this the stacking context, so the ambient layer (z −10)
    // paints above this div's own background but under the content.
    <div className="dark relative isolate flex min-h-svh flex-col bg-background text-foreground" onPointerMove={followPointer}>
      <AmbientLight />
      <LandingNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-white/6">
        {/* One line of small print: this is a demo and the tokens are simulated
            (never issued by Circle or Hashnote). The spec has the full story. */}
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-10 gap-y-4 px-4 py-10 sm:px-6 lg:px-10">
          <Logo size="lg" />
          <p className="text-xs leading-5 text-faint">
            HackCanton S3 demo on a Canton test ledger. USYC and USDC are simulated, not issued by Circle.
          </p>
          <a
            href={SPEC_URL}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline md:ml-auto"
          >
            Design spec
          </a>
        </div>
      </footer>
      {/* Back/forward keep their scroll position; new pages start at the top. */}
      <ScrollRestoration />
    </div>
  )
}

// Glass panels with the `glass-glow` class have a soft light that follows the
// pointer. One listener for the whole page (event delegation) writes the
// pointer position, relative to the panel under it, into --mx / --my. The CSS
// in index.css does the rest, so React never re-renders for it.
function followPointer(event: PointerEvent<HTMLDivElement>) {
  if (event.pointerType !== 'mouse') return
  const panel = (event.target as Element).closest<HTMLElement>('.glass-glow')
  if (panel === null) return
  const box = panel.getBoundingClientRect()
  panel.style.setProperty('--mx', `${event.clientX - box.left}px`)
  panel.style.setProperty('--my', `${event.clientY - box.top}px`)
}

// The light behind the page, fixed to the screen while the content scrolls
// over it. Decoration only.
//   1. The instrument itself, blown up and blurred beyond recognition, top
//      right: its silver and blue become a soft pool of coloured light, the
//      way a photo is blurred behind a glass dashboard. So every glass panel
//      on the page picks up the object's own colours.
//   2. A deeper pool of navy light, lower left, drifting slowly.
function AmbientLight() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <img
        src="/glass/hero-joined-sm.webp"
        alt=""
        className="absolute top-[-18vh] right-[-12vw] w-[78vw] max-w-none opacity-55 blur-[90px] saturate-150"
        style={{ animation: 'drift-a 30s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-[-35vh] left-[-25vw] size-[85vmax] rounded-full bg-[radial-gradient(closest-side,rgb(40_70_170/0.2),transparent)]"
        style={{ animation: 'drift-b 36s ease-in-out infinite' }}
      />
    </div>
  )
}
