import { useCallback, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, EyeOffIcon } from 'lucide-react'
import { cn } from 'cn'
import { Amount } from '@/components/finance/Amount'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { artH, artSize, artW, artX, artY } from '@/landing/artboard'
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
// Then three technical annotations name the pieces, like an engineering
// drawing (a dot on the object, a leader line, a small label): Principal,
// Yield, and a private quote (0.9750 per PT, 5.19% fixed) that points at the
// silver block, because it is the price of PT.
// Everything on the right lives in one artboard (canvas units, see
// glass-geometry.ts), so it scales as a whole and never overlaps.

// Overlays that appear once the wedge has left the slot (--slide close to 1).
const AFTER_SPLIT: CSSProperties = { opacity: 'clamp(0, calc((var(--slide, 0) - 0.7) * 3.4), 1)' }
// The starting amount fades out as the cut begins.
const BEFORE_SPLIT: CSSProperties = { opacity: 'clamp(0, calc(1 - var(--seam, 0) * 1.5), 1)' }

// Annotation font sizes in canvas units (they scale with the artboard), with
// a floor in px. Quieter than the split story's big amounts just below, so
// the two sections do not look the same.
const NOTE_LABEL = artSize(F, 17, 10)
const NOTE_VALUE = artSize(F, 44, 17)

// The annotation layout, in canvas pixels (see glass-geometry.ts).
// The two labels on the right (Yield and the quote) share one left edge,
// NOTE_X, and their lines end at the same x, NOTE_END, so they read as one
// column. The Principal label hangs under the block, on a shoulder of the
// same length (219 px: 962 → 1181 and 437 → 656).
const NOTE_X = 962
const NOTE_END = ANCHORS.wedgeTopSlid.x // 1181
// The Yield label sits on this line, above the wedge (the wedge's top is at y ≈ 352).
const YT_SHOULDER_Y = 300
// The Principal label hangs under this line, just below the block (its lowest point is y 917).
const PT_SHOULDER_Y = 945
const PT_SHOULDER_END = ANCHORS.shellBottom.x + (NOTE_END - NOTE_X) // 656

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
          {/* A dim blue and silver light behind the instrument, so it does
              not sit on flat black. It comes in with the intro (--rise). */}
          <SoftLight className="inset-[-12%]" color="rgb(110 145 230 / 0.16)" style={{ opacity: 'var(--rise)' }} />
          <GlassArtboard
            frame={F}
            eager
            onReady={onReady}
            label={`${SPLIT.usyc} USYC split into ${SPLIT.pt} PT, the silver principal block, and ${SPLIT.yt} YT, the blue glass yield wedge. Both mature on ${MATURITY_DATE}.`}
          >
            {/* Where it starts: 1,000 USYC. It fades as the cut begins. */}
            <Note style={{ left: artX(F, 250), top: artY(F, 180), ...BEFORE_SPLIT }} label="Deposit">
              <span className="num">{SPLIT.usyc} USYC</span>
            </Note>

            {/* PT: a dot on the block's lowest point, a line down, a short
                shoulder to the right, and the label hanging under it. */}
            <AnchorDot at={ANCHORS.shellBottom} tone="pt" />
            <VLine x={ANCHORS.shellBottom.x} y1={ANCHORS.shellBottom.y} y2={PT_SHOULDER_Y} tone="pt" />
            <HLine y={PT_SHOULDER_Y} x1={ANCHORS.shellBottom.x} x2={PT_SHOULDER_END} tone="pt" />
            <Note style={{ left: artX(F, ANCHORS.shellBottom.x), top: artY(F, PT_SHOULDER_Y + 10), ...AFTER_SPLIT }} label="Principal">
              <Amount value={SPLIT.pt} unit="PT" />
            </Note>

            {/* YT: a dot on the top of the wedge, a line up, a shoulder to the
                left (to NOTE_X), and the label sitting on it. Blue = yield. */}
            <AnchorDot at={ANCHORS.wedgeTopSlid} tone="yt" />
            <VLine x={NOTE_END} y1={YT_SHOULDER_Y} y2={ANCHORS.wedgeTopSlid.y} tone="yt" />
            <HLine y={YT_SHOULDER_Y} x1={NOTE_X} x2={NOTE_END} tone="yt" />
            <Note
              style={{ left: artX(F, NOTE_X), top: artY(F, YT_SHOULDER_Y - 10), transform: 'translateY(-100%)', ...AFTER_SPLIT }}
              label="Yield"
              valueClassName="text-yt"
            >
              <Amount value={SPLIT.yt} unit="YT" />
            </Note>

            {/* The private quote on this market. It is the price of PT, so its
                line starts on the silver block (not the blue wedge, which
                means yield) and runs right to the same end as the Yield
                shoulder. The label hangs under it, clear of the wedge (whose
                lowest point there is y ≈ 624). Readable text, so it is not
                hidden from screen readers. */}
            <div className="hidden sm:block">
              <AnchorDot at={ANCHORS.shellRightFace} tone="pt" />
              <HLine y={ANCHORS.shellRightFace.y} x1={ANCHORS.shellRightFace.x} x2={NOTE_END} tone="pt" />
              <Note
                readable
                style={{ left: artX(F, NOTE_X), top: artY(F, ANCHORS.shellRightFace.y + 12), ...AFTER_SPLIT }}
                label={
                  <>
                    {/* The crossed-out eye says "private" without a sentence. */}
                    <EyeOffIcon className="mr-[0.4em] inline size-[1.2em] align-[-0.2em]" aria-hidden />
                    Private quote · PT
                  </>
                }
                footer={`${FIXED_APY_LABEL} fixed`}
              >
                <Amount value={QUOTE.price} />
              </Note>
            </div>
          </GlassArtboard>
        </div>
      </div>
    </section>
  )
}

// ----------------------------------------------------------------------------
// Technical annotations: the hero labels its pieces like an engineering
// drawing, with a dot ON the object, a 1 px leader line and a small label.
// They stay still (no floating cards), so they read as part of the
// instrument, not as app widgets. All positions are canvas pixels.

type Point = { x: number; y: number }
// 'yt' = the yield wedge (blue); 'pt' = the principal block (silver).
type Tone = 'pt' | 'yt'

const LINE_TONE: Record<Tone, string> = { pt: 'bg-foreground/35', yt: 'bg-yt/55' }

// A dot where an annotation is attached to the object, with a faint halo.
// The centre is always silver: a blue dot vanishes on the blue glass wedge,
// so the yield dot shows its colour in the halo instead.
function AnchorDot({ at, tone }: { at: Point; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-4',
        tone === 'yt' ? 'ring-yt/45' : 'ring-foreground/15',
      )}
      style={{ left: artX(F, at.x), top: artY(F, at.y), ...AFTER_SPLIT }}
    />
  )
}

// A horizontal leader line from x1 to x2 (x1 < x2), at height y.
function HLine({ y, x1, x2, tone }: { y: number; x1: number; x2: number; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn('absolute h-px', LINE_TONE[tone])}
      style={{ left: artX(F, x1), top: artY(F, y), width: artW(F, x2 - x1), ...AFTER_SPLIT }}
    />
  )
}

// A vertical leader line from y1 down to y2 (y1 < y2), at x.
function VLine({ x, y1, y2, tone }: { x: number; y1: number; y2: number; tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn('absolute w-px', LINE_TONE[tone])}
      style={{ left: artX(F, x), top: artY(F, y1), height: artH(F, y2 - y1), ...AFTER_SPLIT }}
    />
  )
}

type NoteProps = {
  /** Position (left / top, and a transform to sit above a line). */
  style: CSSProperties
  /** The small caps line, for example "Yield". */
  label: ReactNode
  /** The number. */
  children: ReactNode
  /** An optional small line under the number, for example "5.19% fixed". */
  footer?: string
  valueClassName?: string
  /** Screen readers read it (the quote). The others repeat the stage's own label, so they are hidden. */
  readable?: boolean
}

// The text of an annotation: a small caps label and the number under it.
function Note({ style, label, children, footer, valueClassName, readable = false }: NoteProps) {
  return (
    <div aria-hidden={readable ? undefined : true} className="absolute leading-tight whitespace-nowrap" style={style}>
      <p className="label-caps" style={{ fontSize: NOTE_LABEL }}>
        {label}
      </p>
      <p className={cn('mt-[0.2em] font-display', valueClassName)} style={{ fontSize: NOTE_VALUE }}>
        {children}
      </p>
      {footer !== undefined && (
        <p className="num mt-[0.3em] text-muted-foreground" style={{ fontSize: NOTE_LABEL }}>
          {footer}
        </p>
      )}
    </div>
  )
}
