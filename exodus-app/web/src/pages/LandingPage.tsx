import { Link } from 'react-router'
import { ArrowRightIcon } from 'lucide-react'
import { Mark } from '@/components/brand/Mark'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/landing/Hero'
import { DEMO_ENTRY, SPEC_URL } from '@/components/landing/links'
import { PrivacyLens } from '@/components/landing/PrivacyLens'
import { ProductPreview } from '@/components/landing/ProductPreview'
import { SplitStory } from '@/components/landing/SplitStory'

// The public home page (always dark, see MarketingLayout). Five sections,
// each with one idea, a short title and one visual; the demo and the design
// spec do the detailed explaining:
//   1. Hero        the promise, and the instrument splitting into PT + YT
//   2. The split   USYC → PT + YT, told by scrolling, and where it ends up
//   3. Privacy     "One trade. Four ledgers.": the same trade from four seats
//   4. The app     the real app, rendered with real components
//   5. Close       where to go next
// Every number comes from the worked example in docs/exodus.md §9.
export function LandingPage() {
  return (
    <>
      <Hero />
      <SplitStory />
      <PrivacySection />
      <ProductPreview />
      <Closing />
    </>
  )
}

// Signature C with its title. The lens sits on one large glass panel, so it
// reads as its own place (the old version used a raised surface colour).
function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-[72px] border-t border-border">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="reveal">
          <h2 id="privacy-title" className="font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]">
            One trade. <span className="block">Four ledgers.</span>
          </h2>
          <p className="mt-5 text-[17px] leading-6 text-muted-foreground">
            Each party&rsquo;s node stores only its own part of a trade.
          </p>
        </div>
        <div className="glass glass-sheen glass-glow mt-12 rounded-2xl p-4 sm:p-8 lg:p-10">
          <PrivacyLens />
        </div>
      </div>
    </section>
  )
}

// A short, honest close: where to go next. One wide glass panel with a large,
// faint mark behind the text (the principal block and the yield wedge).
function Closing() {
  return (
    <section aria-labelledby="closing-title" className="px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
      <div className="glass glass-sheen glass-glow reveal relative mx-auto max-w-[1280px] overflow-hidden rounded-2xl px-6 py-14 sm:px-12 lg:py-20">
        <Mark className="pointer-events-none absolute top-1/2 -right-8 h-[140%] w-auto -translate-y-1/2 opacity-[0.07]" />
        <div className="relative flex flex-wrap items-end justify-between gap-8">
          <h2
            id="closing-title"
            className="max-w-[16ch] font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[56px]"
          >
            See it on a live Canton ledger.
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="bright" size="cta" className="rounded-full">
              <Link to={DEMO_ENTRY}>
                Open the demo
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="glass" size="cta" className="rounded-full">
              <a href={SPEC_URL} target="_blank" rel="noreferrer">
                Read the design spec
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
