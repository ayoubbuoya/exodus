import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, EyeOffIcon } from 'lucide-react'
import { cn } from 'cn'
import { Amount } from '@/components/finance/Amount'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { artH, artRight, artSize, artX, artY } from '@/landing/artboard'
import { FIXED_APY_LABEL, MATURITY_DATE, QUOTE, SPLIT } from '@/landing/demo-numbers'
import { ANCHORS, GLASS_FRAME as F } from '@/landing/glass-geometry'
import { GlassArtboard } from './GlassStage.tsx'
import { SoftLight } from './SoftLight.tsx'
import { DEMO_ENTRY } from './links.ts'

// The top of the landing page, about one screen tall.
//
// Left: the promise ("Lock a fixed rate on tokenized T-bills. Privately."),
// one supporting line and the two calls to action. Nothing else: the object
// on the right does the explaining.
// Right, and the first thing the eye lands on: the Exodus instrument in silver
// and glass. On load it rises out of the dark, a blue light gathers around the
// glass wedge (the cut), then the wedge slides out of the block and lights up.
// That is the product in one gesture:
//   1,000 USYC  →  1,000 PT (silver, principal) + 1,000 YT (blue glass, yield).
// Then three glass chips name the pieces in one word each: Principal, Yield,
// and a private quote (0.9750 per PT, 5.19% fixed).
// Everything on the right lives in one artboard (canvas units, see
// glass-geometry.ts), so it scales as a whole and never overlaps.

// Overlays that appear once the wedge has left the slot (--slide close to 1).
const AFTER_SPLIT: CSSProperties = { opacity: 'clamp(0, calc((var(--slide, 0) - 0.7) * 3.4), 1)' }
// The starting amount fades out as the cut begins.
const BEFORE_SPLIT: CSSProperties = { opacity: 'clamp(0, calc(1 - var(--seam, 0) * 1.5), 1)' }

// Font sizes in canvas units (they scale with the artboard), with a floor in px.
const AMOUNT = artSize(F, 54, 18)
const LABEL = artSize(F, 21, 11)

// The page's blocks rise in one after the other.
const riseIn = (delayMs: number): CSSProperties => ({ animation: `rise-in 900ms var(--ease-standard) ${delayMs}ms both` })

export function Hero() {
  const reduceMotion = usePrefersReducedMotion()
  const [ready, setReady] = useState(false)
  // A stable function, so the stage never sees a "new" callback on re-render.
  const onReady = useCallback(() => setReady(true), [])

  // Before the renders are ready, the object waits in the dark; then the
  // intro plays once. With reduced motion we show the finished split.
  const director = (
    reduceMotion
      ? { '--rise': 1, '--seam': 1, '--slide': 1, '--glow': 1 }
      : ready
        ? { animation: 'glass-hero 3000ms var(--ease-standard) 150ms both' }
        : { '--rise': 0, '--seam': 0, '--slide': 0, '--glow': 0.2 }
  ) as CSSProperties

  return (
    <section
      aria-labelledby="hero-title"
      className="relative px-4 pt-12 pb-16 sm:px-6 lg:flex lg:min-h-[calc(100svh-80px)] lg:items-center lg:px-10 lg:py-10"
    >
      {/* The hero sits in the same centred box as the nav pill (same outer
          padding, max-w-330, 20 px inside like the pill's logo), so it never
          runs past the nav on wide screens.
          On desktop the text and the instrument stay TOGETHER: a fixed gap
          (64 px, 96 px from xl) between them, and the pair is centred in the
          box. So the gap is the same on every screen, and both page margins
          match. (With a stretchy column, short laptops left ~270 px of empty
          space between the text and the smaller instrument.)
          Examples: 1920 × 1080 → 540 + 96 + 580 = 1216 px, centred in 1280;
          a laptop at 125% zoom (1510 × 697) → 540 + 96 + 469 = 1105 px, centred. */}
      <div className="mx-auto grid w-full max-w-330 items-center gap-y-12 lg:flex lg:justify-center lg:gap-x-16 lg:px-5 xl:gap-x-24">
        <div className="lg:w-[460px] lg:shrink-0 xl:w-[540px]">
          <h1
            id="hero-title"
            className="font-display text-[44px] leading-[1.02] sm:text-[58px] lg:text-[62px] xl:text-[76px] xl:leading-[0.98]"
            style={riseIn(0)}
          >
            {/* U+2011 is a non-breaking hyphen, so "T-bills" never splits across lines. */}
            Lock a fixed rate on tokenized T&#8209;bills. <span className="text-foreground/40">Privately.</span>
          </h1>
          <p className="mt-7 max-w-[26rem] text-lg leading-[1.55] text-pretty text-muted-foreground" style={riseIn(150)}>
            Split tokenized T&#8209;bills into principal and yield. Trade privately on Canton.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3" style={riseIn(300)}>
            <Button asChild variant="bright" size="cta" className="rounded-full pr-1.5">
              <Link to={DEMO_ENTRY}>
                Open the demo
                {/* A round dark "go" button inside the pill, like a sign-in field's arrow. */}
                <span className="ml-1 grid size-8 place-items-center rounded-full bg-background text-foreground">
                  <ArrowRightIcon className="size-4" />
                </span>
              </Link>
            </Button>
            <Button asChild variant="glass" size="cta" className="rounded-full">
              <a href="#split">How the split works</a>
            </Button>
          </div>
        </div>

        {/* The instrument and its chips, as one scaled artboard. On desktop its
            width is the smaller of two limits, so it never dwarfs the headline:
              - 580 px at most, however wide the screen;
              - its height at most 60% of the hero (the screen minus the 80 px
                nav), turned into a width with the artboard's ratio 1.267.
            Examples: 1366 × 768 → ~523 px wide (the height limit wins);
            1536 × 864, 1920 × 1080, 2560 × 1440 → 580 px.
            On a narrow desktop (1024 px) it shrinks to fit (`min-w-0`, and
            flex items shrink by default). Phones and tablets keep it full
            width and centred (mx-auto). */}
        <div
          style={director}
          className="relative mx-auto w-full lg:mx-0 lg:w-[min(580px,calc((100svh-80px)*0.6*1.267))] lg:min-w-0"
        >
          {/* A dim blue and silver light behind the instrument, so the glass
              chips around it have something to pick up. It comes in with the
              intro (--rise). */}
          <SoftLight className="inset-[-12%]" color="rgb(110 145 230 / 0.16)" style={{ opacity: 'var(--rise)' }} />
          <GlassArtboard
            frame={F}
            eager
            onReady={onReady}
            label={`${SPLIT.usyc} USYC split into ${SPLIT.pt} PT, the silver principal block, and ${SPLIT.yt} YT, the blue glass yield wedge. Both mature on ${MATURITY_DATE}.`}
          >
            {/* Where it starts: 1,000 USYC. It fades as the cut begins. */}
            <div
              aria-hidden="true"
              className="glass absolute rounded-full px-[1em] py-[0.45em] leading-tight"
              style={{ left: artX(F, 250), top: artY(F, 180), fontSize: artSize(F, 22, 11), ...BEFORE_SPLIT }}
            >
              <span className="num font-medium">{SPLIT.usyc} USYC</span>
            </div>

            {/* PT: a hairline from the block's lowest point down to its chip. */}
            <div
              aria-hidden="true"
              className="absolute w-px bg-linear-to-b from-foreground/60 to-foreground/0"
              style={{ left: artX(F, ANCHORS.shellBottom.x), top: artY(F, ANCHORS.shellBottom.y + 8), height: artH(F, 22), ...AFTER_SPLIT }}
            />
            <FloatingChip delay="0s" style={{ left: artX(F, ANCHORS.shellBottom.x - 26), top: artY(F, 948), ...AFTER_SPLIT }}>
              <span className="block text-muted-foreground" style={{ fontSize: LABEL }}>
                Principal
              </span>
              <span className="mt-[0.1em] block font-display" style={{ fontSize: AMOUNT }}>
                <Amount value={SPLIT.pt} unit="PT" />
              </span>
            </FloatingChip>

            {/* YT: a hairline from the top of the wedge up to its chip. Blue = yield. */}
            <div
              aria-hidden="true"
              className="absolute w-px bg-linear-to-t from-yt/80 to-yt/0"
              style={{
                left: artX(F, ANCHORS.wedgeTopSlid.x),
                top: artY(F, 305),
                height: artH(F, ANCHORS.wedgeTopSlid.y - 315),
                ...AFTER_SPLIT,
              }}
            />
            <FloatingChip
              delay="-2.4s"
              className="text-right"
              style={{ right: artRight(F, 1320), top: artY(F, 185), ...AFTER_SPLIT }}
            >
              <span className="block text-muted-foreground" style={{ fontSize: LABEL }}>
                Yield
              </span>
              <span className="mt-[0.1em] block font-display text-yt" style={{ fontSize: AMOUNT }}>
                <Amount value={SPLIT.yt} unit="YT" />
              </span>
            </FloatingChip>

            {/* One private quote on this market, under the glass wedge.
                Readable text, so it is not hidden from screen readers. */}
            <div
              className="absolute hidden sm:block"
              style={{ right: artRight(F, 1330), top: artY(F, 665), ...AFTER_SPLIT }}
            >
              <div
                className="glass-strong glass-sheen rounded-[22px]"
                style={{ padding: `${artSize(F, 20, 10)} ${artSize(F, 24, 12)}`, animation: 'chip-float 7s ease-in-out -4s infinite' }}
              >
                {/* The crossed-out eye says "private" without a sentence. */}
                <p className="flex items-center gap-1.5 text-muted-foreground" style={{ fontSize: LABEL }}>
                  <EyeOffIcon className="size-[1.1em]" aria-hidden />
                  Private quote
                </p>
                <p className="mt-[0.15em] font-display" style={{ fontSize: artSize(F, 44, 16) }}>
                  <Amount value={QUOTE.price} />
                </p>
                <p className="num mt-[0.2em] text-muted-foreground" style={{ fontSize: LABEL }}>
                  {FIXED_APY_LABEL} fixed
                </p>
              </div>
            </div>
          </GlassArtboard>
        </div>
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
        style={{ padding: '0.7em 1.05em 0.75em', animation: `chip-float 6s ease-in-out ${delay} infinite` }}
      >
        {children}
      </div>
    </div>
  )
}
