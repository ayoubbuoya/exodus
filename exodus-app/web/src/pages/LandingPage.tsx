import { Link } from 'react-router'
import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/landing/Hero'
import { DEMO_ENTRY, SPEC_URL } from '@/components/landing/links'
import { MaturitySection } from '@/components/landing/MaturitySection'
import { PrivacyLens } from '@/components/landing/PrivacyLens'
import { ProductPreview } from '@/components/landing/ProductPreview'
import { ProofSection } from '@/components/landing/ProofSection'
import { SplitStory } from '@/components/landing/SplitStory'

// The public home page (always dark, see MarketingLayout), in the order a
// first-time visitor or a hackathon judge needs it:
//   1. Hero        the promise, and the instrument splitting into PT + YT
//   2. The split   USYC → PT + YT, told by scrolling
//   3. Maturity    "Two instruments. One date.": PT pulls to par, YT runs to zero
//   4. Privacy     "One trade. Four ledgers.": the same trade from four seats
//   5. The maths   the one light section: the worked example reconciles
//   6. The product the real app, rendered with real components
//   7. Close       where to go next
// Every number comes from the worked example in docs/exodus.md §9.
export function LandingPage() {
  return (
    <>
      <Hero />
      <SplitStory />
      <MaturitySection />
      <PrivacySection />
      <ProofSection />
      <ProductPreview />
      <Closing />
    </>
  )
}

// Signature C with its title, on the raised surface so it reads as its own place.
function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-[72px] border-t border-border bg-card">
      <div className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-end">
          <h2
            id="privacy-title"
            className="font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]"
          >
            One trade. <span className="block">Four ledgers.</span>
          </h2>
          <p className="text-[15px] leading-6 text-muted-foreground">
            Alice buys 500 PT from Bank in one atomic transaction. Canton sends each party only its own part of it:
            pick a seat, and what that party cannot see is simply not there.
          </p>
        </div>
        <div className="mt-12">
          <PrivacyLens />
        </div>
      </div>
    </section>
  )
}

// A short, honest close: where to go next.
function Closing() {
  return (
    <section aria-labelledby="closing-title" className="border-t border-border">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-end justify-between gap-8 px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
        <h2
          id="closing-title"
          className="max-w-[16ch] font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]"
        >
          See it on a live Canton ledger.
        </h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button asChild size="cta">
            <Link to={DEMO_ENTRY}>
              Open the demo
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <a href={SPEC_URL} target="_blank" rel="noreferrer" className="text-[15px] font-medium underline-offset-4 hover:underline">
            Read the design spec
          </a>
        </div>
      </div>
    </section>
  )
}
