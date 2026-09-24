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
// to everything inside. Only the "maths" section switches to light on purpose.
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
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[auto_1fr] md:gap-16 lg:px-10">
          <Logo size="lg" />
          <div className="grid gap-3 text-xs leading-5 text-faint">
            <p className="max-w-[80ch]">
              Exodus is a HackCanton Season 3 project running on a Canton test ledger. &ldquo;USYC&rdquo; and
              &ldquo;USDC&rdquo; are simulated tokens issued by the UsycIssuer and UsdcIssuer demo parties. They are not
              issued by, connected to, or endorsed by Circle or Hashnote. Nothing here is an offer of securities or
              investment advice. Every figure on this page comes from the worked example in the design spec.
            </p>
            <p>
              <a href={SPEC_URL} target="_blank" rel="noreferrer" className="underline-offset-4 hover:underline">
                Read the design spec
              </a>
            </p>
          </div>
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

// The light behind the page: two slow pools of navy-blue light that drift
// like light under water, a fine grid that fades out towards the bottom, and
// film grain so the gradients never band. Fixed to the screen, so it stays put
// while the content scrolls over it. Decoration only.
function AmbientLight() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Pool 1: top right, behind the hero object. */}
      <div
        className="absolute top-[-25vh] right-[-15vw] size-[90vmax] rounded-full bg-[radial-gradient(closest-side,rgb(45_95_230/0.2),transparent)]"
        style={{ animation: 'drift-a 28s ease-in-out infinite' }}
      />
      {/* Pool 2: lower left, a deeper indigo. */}
      <div
        className="absolute bottom-[-35vh] left-[-25vw] size-[80vmax] rounded-full bg-[radial-gradient(closest-side,rgb(70_60_190/0.14),transparent)]"
        style={{ animation: 'drift-b 34s ease-in-out infinite' }}
      />
      {/* The grid: 64 px squares of hairlines, strongest at the top. */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgb(160 190 255 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(160 190 255 / 0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 60% 0%, #000, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 60% 0%, #000, transparent)',
        }}
      />
      {/* Film grain: SVG noise, very faint, blended over everything. */}
      <div
        className="absolute inset-0 opacity-[0.07] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
        }}
      />
    </div>
  )
}
