import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, MenuIcon, XIcon } from 'lucide-react'
import { cn } from 'cn'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import { LOGIN_PATH, SIGNUP_PATH, SPEC_URL } from './links.ts'

// The landing page's top bar: one floating pill of thick glass.
//
// - Left: the Exodus lockup (mark + wordmark).
// - Centre: the page's chapters. The chapter you are reading gets a lighter
//   pill of its own (scroll spy). A 3-column grid (1fr · auto · 1fr) keeps
//   them exactly in the middle, whatever the widths of the two sides.
// - Right: the design spec, "Log in" and "Request access" (sign-up).
// - Below 900 px the chapters move into a menu behind a round button; on
//   phones the menu also holds "Log in" and "Request access".
// The band stays exactly 72 px tall (12 px gap + a 60 px bar): the split
// story's sticky frame starts under it.

type Section = { id: string; label: string }

const SECTIONS: Section[] = [
  { id: 'split', label: 'The split' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'app', label: 'The app' },
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
  const [menuOpen, setMenuOpen] = useState(false)
  const active = useActiveSection(SECTION_IDS)

  // Escape closes the phone menu.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 sm:px-6 lg:px-10">
      <div className="glass-strong glass-bar mx-auto grid h-15 max-w-330 grid-cols-[1fr_auto_1fr] items-center rounded-full pr-2 pl-5">
        <Logo size="lg" className="justify-self-start" />

        <nav aria-label="Chapters" className="hidden h-11 items-center gap-1 min-[900px]:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              aria-current={active === section.id ? 'location' : undefined}
              className={cn(
                'flex h-full items-center rounded-full px-4 text-[14px] font-medium transition-colors duration-200',
                active === section.id ? 'bg-white/12 text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="col-start-3 flex items-center gap-1 justify-self-end">
          <a
            href={SPEC_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground lg:inline"
          >
            Spec
          </a>
          <Link
            to={LOGIN_PATH}
            className="hidden px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            Log in
          </Link>
          <Button asChild variant="bright" className="hidden h-11 rounded-full pr-1.5 pl-5 text-sm sm:inline-flex">
            <Link to={SIGNUP_PATH}>
              Request access
              <span className="grid size-8 place-items-center rounded-full bg-background text-foreground">
                <ArrowRightIcon className="size-4" />
              </span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-11 rounded-full min-[900px]:hidden"
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
        <div id="landing-menu" className="glass-strong mx-auto mt-2 max-w-330 rounded-2xl px-5 pt-2 pb-6 min-[900px]:hidden">
          <nav aria-label="Chapters" className="grid">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setMenuOpen(false)}
                className="border-b border-white/8 py-3 font-display text-[26px]"
              >
                {section.label}
              </a>
            ))}
            <a href={SPEC_URL} target="_blank" rel="noreferrer" className="border-b border-white/8 py-3 font-display text-[26px]">
              Spec
            </a>
          </nav>
          <div className="mt-5 grid gap-2">
            <Button asChild variant="bright" size="cta" className="w-full rounded-full">
              <Link to={SIGNUP_PATH}>Request access</Link>
            </Button>
            <Button asChild variant="glass" size="cta" className="w-full rounded-full">
              <Link to={LOGIN_PATH}>Log in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-faint">Canton test ledger · simulated USYC and USDC.</p>
        </div>
      )}
    </header>
  )
}
