import { Link } from 'react-router'
import { ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Hero } from '@/components/landing/Hero'
import { SIGNUP_PATH, SPEC_URL } from '@/components/landing/links'
import { PrivacyLens } from '@/components/landing/PrivacyLens'
import { ProductPreview } from '@/components/landing/ProductPreview'
import { SoftLight } from '@/components/landing/SoftLight'
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
// No divider line above it, and less padding on short desktop screens
// (short:), like the other sections.
function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="scroll-mt-[72px]">
      <div className="relative mx-auto max-w-[1280px] px-4 py-20 sm:px-6 lg:px-10 short:py-16 tall:py-28">
        <div className="reveal">
          {/* White, then dimmed: the same title rule as the hero and the app. */}
          <h2 id="privacy-title" className="font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[52px]">
            One trade. <span className="block text-foreground/40">Four ledgers.</span>
          </h2>
          <p className="mt-5 text-[17px] leading-6 text-muted-foreground">
            Each party&rsquo;s node stores only its own part of a trade.
          </p>
        </div>
        {/* A dim blue light behind the plates, seen through the glass panel
            (see SoftLight). It sits where the plate stack is, on the left. */}
        <SoftLight className="top-[30%] left-0 h-[70%] w-[60%]" color="rgb(60 110 255 / 0.16)" />
        <div className="glass glass-sheen glass-glow mt-12 rounded-2xl p-4 sm:p-8 short:mt-8 lg:p-10">
          <PrivacyLens />
        </div>
      </div>
    </section>
  )
}

// A short, honest close: where to go next. One wide glass panel: the title
// and the ways in on the left ("Request access", the lab that needs no
// account, and the spec as a quiet link), and on the right (large screens) the blue
// glass wedge from the hero, so the page ends on the object it started with.
// (It replaced a huge 7%-opacity logo that read as a hard-edged grey box.)
function Closing() {
  return (
    <section aria-labelledby="closing-title" className="px-4 py-20 sm:px-6 lg:px-10 short:py-16 tall:py-28">
      <div className="glass glass-sheen glass-glow reveal relative mx-auto max-w-[1280px] overflow-hidden rounded-2xl px-6 py-14 sm:px-12 lg:py-20">
        {/* The wedge: one layer of the hero render (1536 × 1024), shown
            1110 px wide so the glass body (canvas x 598–1013, y 379–655) is
            ~300 px wide. The body's centre (52.5%, 50.5% of the render) sits
            210 px from the panel's right edge and halfway down:
              right = 210 − (1 − 0.525) × 1110 = −317 px.
            The radial mask keeps the glass and fades out the render's floor
            shadow and edges. Decoration only (empty alt). */}
        <SoftLight className="top-1/2 right-[20px] hidden h-[150%] w-[380px] -translate-y-1/2 lg:block" color="rgb(80 130 255 / 0.2)" />
        <img
          src="/glass/wedge.webp"
          alt=""
          width={1536}
          height={1024}
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute top-1/2 right-[-317px] hidden w-[1110px] max-w-none translate-y-[-50.5%] lg:block"
          style={{
            maskImage: 'radial-gradient(ellipse 30% 36% at 52.5% 50.5%, #000 55%, transparent)',
            WebkitMaskImage: 'radial-gradient(ellipse 30% 36% at 52.5% 50.5%, #000 55%, transparent)',
          }}
        />
        <div className="relative">
          <h2
            id="closing-title"
            className="max-w-[16ch] font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[56px]"
          >
            See it on a live Canton ledger.
          </h2>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="bright" size="cta" className="rounded-full">
              <Link to={SIGNUP_PATH}>
                Request access
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <a
              href={SPEC_URL}
              target="_blank"
              rel="noreferrer"
              className="px-2 text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              Read the design spec
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
