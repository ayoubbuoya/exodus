import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, MenuIcon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { DEMO_ENTRY, SPEC_URL } from './links.ts'

// The landing page's top bar: 72 px, restrained but deliberate.
//
// - Left: the Exodus lockup at full presence (mark + wordmark).
// - Centre: the page's chapters. The one you are reading is underlined (scroll spy).
// - Right: the environment (a simulated-token test ledger) and "Open the demo".
// - It is transparent over the hero, then gets the page colour and a line
//   after 24 px of scroll. Below 900 px the chapters move into a menu.

type Section = { id: string; label: string }

const SECTIONS: Section[] = [
  { id: 'split', label: 'The split' },
  { id: 'maturity', label: 'Maturity' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'maths', label: 'The maths' },
]

// Which chapter is in the reading band of the screen right now.
function useActiveSection(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(null)
  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter((element) => element !== null)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      // A thin band at 40–45% of the screen height counts as "reading".
      { rootMargin: '-40% 0px -55% 0px' },
    )
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [ids])
  return active
}

const SECTION_IDS = SECTIONS.map((section) => section.id)

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Escape closes the phone menu.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const solid = scrolled || menuOpen

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200',
        solid ? 'border-border bg-background/90 backdrop-blur-md' : 'border-transparent bg-background',
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center gap-10 px-4 sm:px-6 lg:px-10">
        <Logo size="lg" />
        <nav aria-label="Chapters" className="hidden h-full items-stretch gap-8 min-[900px]:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? 'location' : undefined}
              className={cn(
                'flex items-center border-b-2 pt-0.5 text-[15px] font-medium transition-colors',
                active === section.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          <a
            href={SPEC_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden text-[15px] font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline"
          >
            Spec
          </a>
          <span className="hidden border-l border-input pl-5 text-xs leading-4 text-faint xl:inline">
            Canton test ledger
            <br />
            Simulated USYC and USDC
          </span>
          <Button asChild className="hidden h-10 px-4 text-sm sm:inline-flex">
            <Link to={DEMO_ENTRY}>
              Open the demo
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="min-[900px]:hidden"
            aria-expanded={menuOpen}
            aria-controls="landing-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </div>

      {menuOpen && (
        <div id="landing-menu" className="border-t border-border px-4 pb-6 sm:px-6 min-[900px]:hidden">
          <nav aria-label="Chapters" className="grid">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setMenuOpen(false)}
                className="border-b border-border py-3 font-display text-[28px]"
              >
                {section.label}
              </a>
            ))}
            <a href={SPEC_URL} target="_blank" rel="noreferrer" className="border-b border-border py-3 font-display text-[28px]">
              Spec
            </a>
          </nav>
          <Button asChild size="cta" className="mt-5 w-full">
            <Link to={DEMO_ENTRY}>Open the demo</Link>
          </Button>
          <p className="mt-4 text-xs text-faint">Canton test ledger · simulated USYC and USDC.</p>
        </div>
      )}
    </header>
  )
}
