import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, EyeIcon } from 'lucide-react'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { FIXED_APY_LABEL, MARKET, MATURITY_DATE, QUOTE, SPLIT } from '@/landing/demo-numbers'
import { ANCHORS, GLASS_FRAME as F } from '@/landing/glass-geometry'
import { artH, artRight, artSize, artX, artY } from '@/landing/instrument-geometry'
import { PARTS, SEATS } from '@/landing/privacy-lens-data'
import { GlassArtboard } from './GlassStage.tsx'
import { DEMO_ENTRY } from './links.ts'

// The top of the landing page, about one screen tall.
//
// Left: a "live" badge, the promise ("Lock a fixed rate on tokenized T-bills.
// Privately."), the supporting line, the calls to action and three facts on
// glass tiles.
// Right, and the first thing the eye lands on: the Exodus instrument in glass
// and silver. On load it rises out of the dark, rests, then the blue glass
// wedge slides out of the silver block and lights up. That is the product in
// one gesture:
//   1,000 USYC  →  1,000 PT (silver, principal) + 1,000 YT (blue glass, yield).
// Then glass chips explain it in the product's own numbers, and one private
// quote (500 PT at 0.9750, 5.19% fixed, visible to Alice and Bank).
// Everything on the right lives in one artboard (canvas units, see
// glass-geometry.ts), so it scales as a whole and never overlaps.

// Overlays that appear once the wedge has left the slot (--slide close to 1).
const AFTER_SPLIT: CSSProperties = { opacity: 'clamp(0, calc((var(--slide, 0) - 0.7) * 3.4), 1)' }
// The starting amount fades out as the split happens.
const BEFORE_SPLIT: CSSProperties = { opacity: 'clamp(0, calc(1 - var(--slide, 0) * 2.5), 1)' }

// Font sizes in canvas units (they scale with the artboard), with a floor in px.
const AMOUNT = artSize(F, 50, 16)
const DETAIL = artSize(F, 22, 11)

// "2 of 4": how many of the four parties' nodes store the price (the Quote).
// Taken from the privacy data, so the hero and the privacy section always agree.
const PRICE_SEEN_BY = `${PARTS[0].visibleTo.length} of ${SEATS.length}`

// Three facts on glass tiles under the calls to action.
const FACTS = [
  { value: FIXED_APY_LABEL, label: 'Fixed APY, locked', detail: `${QUOTE.pt} PT at ${QUOTE.price}` },
  { value: '1 tx', label: 'Atomic settlement', detail: 'PT and cash, together' },
  { value: PRICE_SEEN_BY, label: 'Parties see the price', detail: 'Alice and Bank only' },
]

export function Hero() {
  const reduceMotion = usePrefersReducedMotion()
  const [ready, setReady] = useState(false)
  // A stable function, so the stage's "ready" effect does not run again on each render.
  const onReady = useCallback(() => setReady(true), [])

  // Before the picture is ready, it waits in the dark; then the intro plays
  // once. With reduced motion we show the finished split straight away.
  const director = (
    reduceMotion
      ? { '--rise': 1, '--slide': 1, '--glow': 1 }
      : ready
        ? { animation: 'glass-hero 2600ms var(--ease-standard) 150ms both' }
        : { '--rise': 0, '--slide': 0, '--glow': 0.25 }
  ) as CSSProperties

  return (
    <section
      aria-labelledby="hero-title"
      className="relative grid items-center gap-y-12 px-4 pt-10 pb-16 sm:px-6 lg:min-h-[calc(100svh-72px)] lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:gap-x-10 lg:py-10 lg:pr-8 lg:pl-[max(2.5rem,calc((100vw-1280px)/2))] xl:grid-cols-[minmax(0,560px)_minmax(0,1fr)]"
    >
      {/* The promise. Each block rises in, one after the other. */}
      <div>
       
        <h1
          id="hero-title"
          className="mt-7 font-display text-[42px] leading-[1.02] sm:text-[54px] lg:text-[58px] xl:text-[72px] xl:leading-[0.98]"
          style={{ animation: 'rise-in 900ms var(--ease-standard) 100ms both' }}
        >
          <span className="text-chrome block pb-1">Lock a fixed rate</span>
          {/* U+2011 is a non-breaking hyphen, so "T-bills" never splits across lines. */}
          <span className="text-chrome block pb-1">on tokenized T&#8209;bills.</span>
          <span className="text-chrome-sheen block pb-1">Privately.</span>
        </h1>
        <p
          className="mt-7 max-w-[31rem] text-lg leading-[1.6] text-pretty text-muted-foreground"
          style={{ animation: 'rise-in 900ms var(--ease-standard) 250ms both' }}
        >
          Exodus splits a yield-bearing fund token into principal and yield on Canton. Buy the principal below par to
          lock a fixed rate. Trades settle atomically, and only you and your dealer see the price.
        </p>
        <div
          className="mt-9 flex flex-wrap items-center gap-3"
          style={{ animation: 'rise-in 900ms var(--ease-standard) 400ms both' }}
        >
          <Button asChild variant="chrome" size="cta" className="rounded-full">
            <Link to={DEMO_ENTRY}>
              Open the demo
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild variant="glass" size="cta" className="rounded-full">
            <a href="#split">How the split works</a>
          </Button>
        </div>

        <dl
          className="mt-10 grid max-w-[34rem] grid-cols-3 gap-2.5"
          style={{ animation: 'rise-in 900ms var(--ease-standard) 550ms both' }}
        >
          {FACTS.map((fact) => (
            // In a <dl> the term (dt) must come first; `order` puts the big value on top visually.
            <div key={fact.label} className="glass glass-glow flex flex-col rounded-xl px-3.5 py-3 sm:px-4">
              <dt className="order-2 mt-2 text-[12px] leading-4 font-medium text-foreground/90">{fact.label}</dt>
              <dd className="num order-1 font-display text-[22px] leading-none sm:text-[26px]">{fact.value}</dd>
              <dd className="order-3 mt-0.5 hidden text-[11px] leading-4 text-faint sm:block">{fact.detail}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-5 text-xs text-faint">USYC and USDC here are simulated test tokens, not issued by Circle.</p>
      </div>

      {/* The instrument and its chips, as one scaled artboard.
          On tall-but-narrow laptops it is also capped by the screen height. */}
      <div style={director} className="mx-auto w-full lg:max-w-[calc((100svh-130px)*1.373)]">
        <GlassArtboard
          frame={F}
          eager
          tilt
          halo
          onReady={onReady}
          label={`${SPLIT.usyc} USYC split into ${SPLIT.pt} PT, the silver principal block, and ${SPLIT.yt} YT, the blue glass yield wedge. Both mature on ${MATURITY_DATE}.`}
        >
          {/* Where it starts: 1,000 USYC. It fades as the wedge leaves. */}
          <div
            aria-hidden="true"
            className="glass absolute rounded-full px-[1.1em] py-[0.45em] leading-tight"
            style={{ left: artX(F, 330), top: artY(F, 150), fontSize: artSize(F, 24, 11), ...BEFORE_SPLIT }}
          >
            <span className="num font-semibold">{SPLIT.usyc} USYC</span>
            <span className="num text-muted-foreground"> · index {SPLIT.index}</span>
          </div>

          {/* PT: a hairline from the block's bottom edge down to its chip. */}
          <div
            aria-hidden="true"
            className="absolute w-px bg-linear-to-b from-foreground/70 to-foreground/0"
            style={{ left: artX(F, ANCHORS.shellBottom.x), top: artY(F, ANCHORS.shellBottom.y + 12), height: artH(F, 30), ...AFTER_SPLIT }}
          />
          <FloatingChip
            delay="0s"
            style={{ left: artX(F, ANCHORS.shellBottom.x - 24), top: artY(F, 846), ...AFTER_SPLIT }}
          >
            <span className="num flex items-center gap-[0.35em] font-semibold tracking-[-0.01em]" style={{ fontSize: AMOUNT }}>
              <i className="inline-block size-[0.42em] rounded-[0.1em] bg-pt" />
              {SPLIT.pt} PT
            </span>
            <span className="text-muted-foreground" style={{ fontSize: DETAIL }}>
              Principal · pays {SPLIT.usdValue} at maturity
            </span>
          </FloatingChip>

          {/* YT: a hairline from the wedge's top corner up to its chip. Blue = yield. */}
          <div
            aria-hidden="true"
            className="absolute w-px bg-linear-to-t from-yt/80 to-yt/0"
            style={{
              left: artX(F, ANCHORS.wedgeTopSlid.x),
              top: artY(F, 250),
              height: artH(F, ANCHORS.wedgeTopSlid.y - 262),
              ...AFTER_SPLIT,
            }}
          />
          <FloatingChip
            delay="-2.4s"
            className="text-right"
            style={{ right: artRight(F, 1520), top: artY(F, 118), ...AFTER_SPLIT }}
          >
            <span className="num block font-semibold tracking-[-0.01em] text-yt" style={{ fontSize: AMOUNT }}>
              {SPLIT.yt} YT
            </span>
            <span className="text-muted-foreground" style={{ fontSize: DETAIL }}>
              Yield · until {MATURITY_DATE}
            </span>
          </FloatingChip>

          {/* One private quote on this market, under the glass wedge.
              Readable text, so it is not hidden from screen readers. */}
          <div
            className="absolute hidden sm:block"
            style={{
              right: artRight(F, 1520),
              top: artY(F, 790),
              width: `${(400 / F.width) * 100}%`,
              ...AFTER_SPLIT,
            }}
          >
            <div
              className="glass-strong rounded-xl"
              style={{ padding: `${artSize(F, 18, 9)} ${artSize(F, 22, 11)}`, animation: 'chip-float 7s ease-in-out -4s infinite' }}
            >
              <p className="flex items-center justify-between text-muted-foreground" style={{ fontSize: artSize(F, 20, 10) }}>
                <span>Private quote</span>
                <span className="num text-faint">{MARKET}</span>
              </p>
              <p className="num mt-1 font-semibold" style={{ fontSize: artSize(F, 30, 13) }}>
                {QUOTE.pt} PT <span className="font-normal text-muted-foreground">at</span> {QUOTE.price}
              </p>
              <p className="num" style={{ fontSize: artSize(F, 26, 12) }}>
                {FIXED_APY_LABEL} <span className="text-muted-foreground">fixed APY</span>
              </p>
              <p
                className="mt-2 flex items-center gap-1.5 border-t border-white/10 pt-2 text-muted-foreground"
                style={{ fontSize: artSize(F, 20, 10) }}
              >
                <EyeIcon className="size-[1.1em]" aria-hidden />
                Visible to Alice + Bank
              </p>
            </div>
          </div>
        </GlassArtboard>
      </div>
    </section>
  )
}



type FloatingChipProps = {
  className?: string
  style: CSSProperties
  /** A negative delay starts the float part-way through, so chips never bob in step. */
  delay: string
  children: ReactNode
}

// A label on glass that floats gently next to the object. Decorative (the
// stage's label already says the same thing to screen readers).
function FloatingChip({ className, style, delay, children }: FloatingChipProps) {
  return (
    <div aria-hidden="true" className={cn('absolute', className)} style={style}>
      <div
        className="glass rounded-xl leading-tight"
        style={{ padding: '0.55em 0.9em 0.6em', animation: `chip-float 6s ease-in-out ${delay} infinite` }}
      >
        {children}
      </div>
    </div>
  )
}
