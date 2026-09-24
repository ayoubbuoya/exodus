import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, EyeIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { FIXED_APY_LABEL, MARKET, MATURITY_DATE, QUOTE, SPLIT, SPLIT_DATE } from '@/landing/demo-numbers'
import { ANCHORS, HERO_FRAME as F, artH, artRight, artSize, artX, artY } from '@/landing/instrument-geometry'
import { InstrumentArtboard } from './InstrumentStage.tsx'
import { DEMO_ENTRY } from './links.ts'

// The top of the landing page, about one screen tall.
//
// Left: the promise ("Lock a fixed rate on tokenized T-bills. Privately."),
// the supporting line and the call to action.
// Right, and the first thing the eye lands on: the Exodus instrument. On load
// it splits once (seam, then the copper yield plate slides away), and a few
// annotations explain it in the product's own numbers:
//   1,000 USYC  →  1,000 PT (principal) + 1,000 YT (yield),
//   one private quote (500 PT at 0.9750, 5.19% fixed, visible to Alice and Bank),
//   and the maturity "meridian", 01 Apr 2027, that both instruments run toward.
// Everything on the right lives in one artboard (canvas units, see
// instrument-geometry.ts), so it scales as a whole and never overlaps.

// Overlays that appear once the plates have separated (--slide close to 1).
const AFTER_SPLIT: CSSProperties = { opacity: 'clamp(0, calc((var(--slide, 0) - 0.65) * 3), 1)' }

// Font sizes in canvas units (about 0.45 px each on a laptop), with a floor in px.
const AMOUNT = artSize(F, 58, 17)
const DETAIL = artSize(F, 28, 11)
const SMALL = artSize(F, 25, 11)

export function Hero() {
  const reduceMotion = usePrefersReducedMotion()
  const [ready, setReady] = useState(false)

  // Before the images are ready the plates stay joined; then the split plays
  // once. With reduced motion we show the finished split straight away.
  const director = (
    reduceMotion
      ? { '--seam': 1, '--slide': 1 }
      : ready
        ? { animation: 'hero-split 1900ms var(--ease-standard) 250ms both' }
        : { '--seam': 0, '--slide': 0 }
  ) as CSSProperties

  return (
    <section
      aria-labelledby="hero-title"
      className="grid items-center gap-y-12 px-4 pt-10 pb-16 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:gap-x-12 lg:py-10 lg:pr-8 lg:pl-[max(2.5rem,calc((100vw-1280px)/2))] xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]"
    >
      {/* The promise. */}
      <div>
        <h1
          id="hero-title"
          className="font-display text-[40px] leading-[1.02] sm:text-[52px] lg:text-[56px] xl:text-[68px] xl:leading-none"
        >
          <span className="block">Lock a fixed rate</span>
          {/* U+2011 is a non-breaking hyphen, so "T-bills" never splits across lines. */}
          <span className="block">on tokenized T&#8209;bills.</span>
          <span className="block text-muted-foreground">Privately.</span>
        </h1>
        <p className="mt-7 max-w-[30rem] text-lg leading-[1.55] text-pretty text-muted-foreground">
          Exodus splits a yield-bearing fund token into principal and yield on Canton. Buy the principal below par to
          lock a fixed rate. Trades settle atomically, and only you and your dealer see the price.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Button asChild size="cta">
            <Link to={DEMO_ENTRY}>
              Open the demo
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <a href="#split" className="text-[15px] font-medium underline-offset-4 hover:underline">
            How the split works
          </a>
        </div>
        <p className="mt-5 text-xs text-faint">USYC and USDC here are simulated test tokens, not issued by Circle.</p>
      </div>

      {/* The instrument and its annotations, as one scaled artboard.
          On tall-but-narrow laptops it is also capped by the screen height. */}
      <div style={director} className="mx-auto w-full lg:max-w-[calc((100svh-150px)*1.29)]">
        <InstrumentArtboard
          frame={F}
          eager
          onReady={() => setReady(true)}
          label={`${SPLIT.usyc} USYC split into ${SPLIT.pt} PT, the silver principal plate, and ${SPLIT.yt} YT, the copper yield plate. Both mature on ${MATURITY_DATE}.`}
        >
          {/* Where it starts: 1,000 USYC. */}
          <div aria-hidden="true" className="absolute leading-tight" style={{ left: artX(F, 20), top: artY(F, 16) }}>
            <span className="num block font-semibold" style={{ fontSize: artSize(F, 34, 13) }}>
              {SPLIT.usyc} USYC
            </span>
            <span className="num hidden text-muted-foreground sm:block" style={{ fontSize: DETAIL }}>
              index {SPLIT.index} · {SPLIT.usdValue}
            </span>
          </div>

          {/* PT: leader from the silver plate's front edge down to its tag. */}
          <div
            aria-hidden="true"
            className="absolute w-px bg-foreground/50"
            style={{
              left: artX(F, ANCHORS.principalFront.x),
              top: artY(F, ANCHORS.principalFront.y),
              height: artH(F, 118),
              ...AFTER_SPLIT,
            }}
          />
          <div
            aria-hidden="true"
            className="absolute leading-tight"
            style={{ left: artX(F, ANCHORS.principalFront.x - 22), top: artY(F, 772), ...AFTER_SPLIT }}
          >
            <span className="num block font-semibold tracking-[-0.01em]" style={{ fontSize: AMOUNT }}>
              {SPLIT.pt} PT
            </span>
            <span className="text-muted-foreground" style={{ fontSize: DETAIL }}>
              Principal · pays {SPLIT.usdValue} at maturity
            </span>
          </div>

          {/* YT: leader from the copper plate's top edge up to its tag. Copper = yield. */}
          <div
            aria-hidden="true"
            className="absolute w-px bg-yt/60"
            style={{
              left: artX(F, ANCHORS.yieldTopSlid.x),
              top: artY(F, -40),
              height: artH(F, ANCHORS.yieldTopSlid.y + 40),
              ...AFTER_SPLIT,
            }}
          />
          <div
            aria-hidden="true"
            className="absolute text-right leading-tight"
            style={{ right: artRight(F, 1490), top: artY(F, -190), ...AFTER_SPLIT }}
          >
            <span className="num block font-semibold tracking-[-0.01em] text-yt" style={{ fontSize: AMOUNT }}>
              {SPLIT.yt} YT
            </span>
            <span className="text-muted-foreground" style={{ fontSize: DETAIL }}>
              Yield · until {MATURITY_DATE}
            </span>
          </div>

          {/* The maturity meridian and the time axis from the split to it. */}
          <div
            aria-hidden="true"
            className="absolute w-[1.5px] bg-foreground"
            style={{ left: artX(F, 1560), top: artY(F, -200), height: artH(F, 1200) }}
          />
          <div
            aria-hidden="true"
            className="absolute h-px bg-input"
            style={{ left: artX(F, 0), top: artY(F, 1000), width: `${(1560 / F.width) * 100}%` }}
          />
          <div aria-hidden="true" className="num absolute text-faint" style={{ left: artX(F, 0), top: artY(F, 1014), fontSize: SMALL }}>
            {SPLIT_DATE} · split
          </div>
          <div
            aria-hidden="true"
            className="num absolute text-right font-semibold"
            style={{ right: artRight(F, 1562), top: artY(F, 1014), fontSize: SMALL }}
          >
            {MATURITY_DATE} · maturity
          </div>

          {/* One private quote on this market, in the empty lower right of the
              picture. Readable text, so it is not hidden from screen readers. */}
          <div
            className="absolute hidden rounded-xl border border-input bg-card shadow-e2 sm:block"
            style={{
              left: artX(F, 1040),
              top: artY(F, 560),
              width: `${(440 / F.width) * 100}%`,
              padding: `${artSize(F, 20, 10)} ${artSize(F, 26, 12)}`,
              ...AFTER_SPLIT,
            }}
          >
            <p className="text-muted-foreground" style={{ fontSize: SMALL }}>
              Private quote · {MARKET}
            </p>
            <p className="num mt-1 font-semibold" style={{ fontSize: artSize(F, 32, 13) }}>
              {QUOTE.pt} PT <span className="font-normal text-muted-foreground">at</span> {QUOTE.price}
            </p>
            <p className="num" style={{ fontSize: artSize(F, 32, 13) }}>
              {FIXED_APY_LABEL} fixed
            </p>
            <p
              className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 text-muted-foreground"
              style={{ fontSize: SMALL }}
            >
              <EyeIcon className="size-[1.1em]" aria-hidden />
              Visible to Alice + Bank
            </p>
          </div>
        </InstrumentArtboard>
      </div>
    </section>
  )
}
