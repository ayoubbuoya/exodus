import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { cn } from 'cn'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { MATURITY_DATE, SPLIT } from '@/landing/demo-numbers'
import { ANCHORS, GLASS_FRAME as F } from '@/landing/glass-geometry'
import { artH, artRight, artSize, artX, artY } from '@/landing/instrument-geometry'
import { GlassArtboard } from './GlassStage.tsx'

// Signature B: USYC → PT + YT, told by scrolling (spec §9, step 1).
//
// On tall desktop screens the section is three screens tall and its frame is sticky, so the
// instrument stays in view while you scroll through it:
//   1. Deposit  one unified instrument: 1,000 USYC at index 1.000000,
//   2. Cut      the outline of the glass wedge is traced in light: PT = YT = shares × index,
//   3. Split    the blue glass wedge (yield) slides out of the silver block
//               (principal) and lights up; the amounts appear.
// The scroll position becomes one number, --p (0 → 1), written straight onto
// the frame (no React re-render per frame). CSS turns --p into --seam, --slide
// and --glow, so the object moves continuously with your scroll. The page scrolls
// normally: no locking, no snapping. Every step is also a button.
// Phones, tablets and short laptop screens get no sticky frame: the step
// buttons set --p, and a CSS transition animates between steps.

type Step = 1 | 2 | 3

const STEPS: { step: Step; name: string; caption: string }[] = [
  {
    step: 1,
    name: 'Deposit',
    caption: `Bank deposits ${SPLIT.usyc} USYC, a tokenized T-bill fund. At index ${SPLIT.index} that is ${SPLIT.usdValue}. The number of tokens never changes; the index rises.`,
  },
  {
    step: 2,
    name: 'Cut',
    caption: `The market cuts it at today's index: PT = YT = shares × index = ${SPLIT.usyc} × 1.00. One atomic transaction moves the USYC into the Operator's vault.`,
  },
  {
    step: 3,
    name: 'Split',
    caption: `Two instruments, one date. ${SPLIT.pt} PT pays ${SPLIT.usdValue} of USYC on ${MATURITY_DATE}. ${SPLIT.yt} YT collects all the yield until then.`,
  },
]

// Where each step sits on the 0 → 1 progress scale, and the value a click sets.
const STEP_AT: Record<Step, number> = { 1: 0.08, 2: 0.4, 3: 1 }
function stepFor(progress: number): Step {
  if (progress < 0.24) return 1
  if (progress < 0.52) return 2
  return 3
}

// --p → the stage's own variables. The seam draws between 24% and 44% of the
// story, the wedge slides out between 52% and 78% (and its light rises with it),
// the amounts land after 74%.
const DIRECTOR: CSSProperties = {
  ['--seam' as string]: 'clamp(0, calc((var(--p) - 0.24) / 0.2), 1)',
  ['--slide' as string]: 'clamp(0, calc((var(--p) - 0.52) / 0.26), 1)',
  ['--glow' as string]: 'calc(0.3 + 0.7 * clamp(0, calc((var(--p) - 0.52) / 0.26), 1))',
}
const fade = (from: number, span: number): CSSProperties => ({
  opacity: `clamp(0, calc((var(--p) - ${from}) / ${span}), 1)`,
})
const fadeOut = (from: number, span: number): CSSProperties => ({
  opacity: `clamp(0, calc(1 - (var(--p) - ${from}) / ${span}), 1)`,
})

// The sticky frame starts under the 72 px navigation bar.
const NAV_HEIGHT = 72

// Label sizes in canvas units (they scale with the artboard), with a floor in px.
const AMOUNT = artSize(F, 58, 18)
const DETAIL = artSize(F, 24, 11)

// Scroll-driven mode needs a desktop screen at least 760 px tall (the tall: variant in index.css).
const SCROLLY_QUERY = '(min-width: 1024px) and (min-height: 760px)'

export function SplitStory() {
  const sectionRef = useRef<HTMLElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const scrolly = useMediaQuery(SCROLLY_QUERY)
  const [step, setStep] = useState<Step>(1)

  // Tall desktop screens: follow the scroll. One measurement per animation frame, passive
  // listener, and React only re-renders when the step name changes.
  useEffect(() => {
    if (!scrolly) return
    let frame = 0
    const update = () => {
      frame = 0
      const section = sectionRef.current
      if (section === null || frameRef.current === null) return
      const rect = section.getBoundingClientRect()
      const scrollable = rect.height - (window.innerHeight - NAV_HEIGHT)
      const progress = Math.min(1, Math.max(0, (NAV_HEIGHT - rect.top) / scrollable))
      frameRef.current.style.setProperty('--p', progress.toFixed(4))
      setStep(stepFor(progress))
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [scrolly])

  // A click on a step. Scroll-driven mode: scroll to where that step lives, so
  // the page and the picture always agree. Otherwise: just show that step.
  function choose(next: Step) {
    setStep(next)
    const section = sectionRef.current
    if (!scrolly || section === null) return
    const rect = section.getBoundingClientRect()
    const scrollable = rect.height - (window.innerHeight - NAV_HEIGHT)
    const target = window.scrollY + rect.top - NAV_HEIGHT + Math.min(STEP_AT[next] + 0.04, 1) * scrollable
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'auto' })
  }

  // Without scroll-driven mode, the chosen step drives --p, with a transition.
  const frameStyle: CSSProperties = scrolly
    ? DIRECTOR
    : { ...DIRECTOR, ['--p' as string]: STEP_AT[step], transition: '--p 900ms var(--ease-standard)' }

  return (
    <section
      id="split"
      ref={sectionRef}
      aria-labelledby="split-title"
      className="relative scroll-mt-[72px] border-t border-border tall:h-[300vh]"
    >
      <div
        ref={frameRef}
        style={frameStyle}
        className="mx-auto grid max-w-[1280px] gap-6 px-4 py-16 sm:px-6 lg:px-10 short:min-h-[calc(100svh-72px)] short:grid-cols-[minmax(0,400px)_minmax(0,1fr)] short:grid-rows-[1fr_1fr] short:gap-x-12 short:py-10 tall:sticky tall:top-[72px] tall:h-[calc(100svh-72px)] tall:grid-rows-[auto_minmax(0,1fr)_auto] tall:py-8"
      >
        {/* Title and the step rail. Short laptop screens: left column, top half. */}
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 short:col-start-1 short:row-start-1 short:self-end">
          <h2
            id="split-title"
            className="text-chrome font-display text-[32px] leading-[1.02] sm:text-[40px] xl:text-[48px]"
          >
            One instrument becomes two.
          </h2>
          <StepRail step={step} onChoose={choose} />
        </div>

        {/* The instrument and its amounts, as one scaled artboard (see
            instrument-geometry.ts), as large as the space allows:
            - tall screens: the middle row of the sticky frame is a CSS size
              container, and the artboard fits it (width <= height x 1.373),
            - short desktop screens: the right column, capped to the screen height,
            - phones and tablets: the full width. */}
        <div className="flex min-h-0 items-center justify-center py-6 short:col-start-2 short:row-span-2 short:row-start-1 short:py-0 tall:py-2 tall:[container-type:size]">
          <div className="w-full short:w-[min(100%,calc((100svh-150px)*1.373))] tall:w-[min(100cqw,calc(100cqh*1.373))]">
            <GlassArtboard
              frame={F}
              label={
                step === 3
                  ? `The instrument has split: ${SPLIT.pt} PT, the silver principal block, and ${SPLIT.yt} YT, the blue glass yield wedge.`
                  : `One instrument: ${SPLIT.usyc} USYC before the split.`
              }
            >
              {/* 1 · Deposit: what goes in. */}
              <div
                aria-hidden="true"
                className="absolute leading-tight"
                style={{ left: artX(F, 330), top: artY(F, 104), ...fadeOut(0.5, 0.08) }}
              >
                <span className="num block font-semibold" style={{ fontSize: artSize(F, 40, 14) }}>
                  {SPLIT.usyc} USYC
                </span>
                {/* Phones: first line only (the caption below carries the detail). */}
                <span className="num hidden text-muted-foreground sm:inline" style={{ fontSize: DETAIL }}>
                  index {SPLIT.index} · {SPLIT.usdValue}
                </span>
              </div>

              {/* 2 · Cut: the formula, in the empty lower right of the picture. */}
              <div
                aria-hidden="true"
                className="glass-strong absolute hidden rounded-xl sm:block"
                style={{
                  right: artRight(F, 1510),
                  top: artY(F, 850),
                  padding: `${artSize(F, 12, 6)} ${artSize(F, 22, 10)}`,
                  fontSize: DETAIL,
                  opacity: 'clamp(0, min(calc((var(--p) - 0.28) / 0.1), calc(1 - (var(--p) - 0.5) / 0.06)), 1)',
                }}
              >
                <span className="num">
                  PT = YT = {SPLIT.usyc} × {SPLIT.index} = <span className="font-semibold">{SPLIT.pt}</span>
                </span>
              </div>

              {/* 3 · Split: the amounts, with leader lines to their plates. */}
              <div
                aria-hidden="true"
                className="absolute w-px bg-linear-to-b from-foreground/70 to-foreground/0"
                style={{
                  left: artX(F, ANCHORS.shellBottom.x),
                  top: artY(F, ANCHORS.shellBottom.y + 14),
                  height: artH(F, 40),
                  ...fade(0.76, 0.1),
                }}
              />
              <div
                aria-hidden="true"
                className="absolute leading-tight"
                style={{ left: artX(F, ANCHORS.shellBottom.x - 20), top: artY(F, 876), ...fade(0.78, 0.1) }}
              >
                <span className="num block font-semibold tracking-[-0.015em]" style={{ fontSize: AMOUNT }}>
                  {SPLIT.pt}.00 PT
                </span>
                <span className="text-muted-foreground" style={{ fontSize: DETAIL }}>
                  Principal · {SPLIT.usdValue} at maturity
                </span>
              </div>
              <div
                aria-hidden="true"
                className="absolute w-px bg-linear-to-t from-yt/80 to-yt/0"
                style={{
                  left: artX(F, ANCHORS.wedgeTopSlid.x),
                  top: artY(F, 232),
                  height: artH(F, ANCHORS.wedgeTopSlid.y - 244),
                  ...fade(0.76, 0.1),
                }}
              />
              <div
                aria-hidden="true"
                className="absolute text-right leading-tight"
                style={{ right: artRight(F, 1510), top: artY(F, 110), ...fade(0.78, 0.1) }}
              >
                <span className="num block font-semibold tracking-[-0.015em] text-yt" style={{ fontSize: AMOUNT }}>
                  {SPLIT.yt}.00 YT
                </span>
                <span className="text-muted-foreground" style={{ fontSize: DETAIL }}>
                  Yield · until {MATURITY_DATE}
                </span>
              </div>
            </GlassArtboard>
          </div>
        </div>

        {/* The caption of the current step, and the transaction behind it. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-12 short:col-start-1 short:row-start-2 short:grid-cols-1 short:gap-6 short:self-start">
          <p aria-live="polite" className="max-w-[58ch] text-[15px] leading-6 text-muted-foreground">
            <span className="font-semibold text-foreground">{STEPS[step - 1].name}. </span>
            {STEPS[step - 1].caption}
          </p>
          <TransactionStrip />
        </div>
      </div>
    </section>
  )
}

type StepRailProps = {
  step: Step
  onChoose: (step: Step) => void
}

// Three steps with a line that fills with the story's progress (--p).
// Keyboard: Tab to the current step, arrow keys to move.
function StepRail({ step, onChoose }: StepRailProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (delta === 0) return
    event.preventDefault()
    const next = (index + delta + STEPS.length) % STEPS.length
    buttons.current[next]?.focus()
    onChoose(STEPS[next].step)
  }

  return (
    <div className="w-full max-w-[420px]">
      {/* Progress line, filled by --p. Decorative: the buttons carry the state. */}
      <div aria-hidden="true" className="relative h-px bg-white/10">
        <div
          className="absolute inset-y-0 left-0 w-full origin-left bg-linear-to-r from-foreground/40 to-foreground shadow-[0_0_12px_rgb(220_235_255/0.6)]"
          style={{ transform: 'scaleX(var(--p))' }}
        />
      </div>
      <div role="tablist" aria-label="Split, step by step" className="mt-3 grid grid-cols-3">
        {STEPS.map((info, index) => {
          const selected = info.step === step
          return (
            <button
              key={info.step}
              ref={(element) => {
                buttons.current[index] = element
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChoose(info.step)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'text-left text-sm transition-colors duration-200',
                index === 1 && 'text-center',
                index === 2 && 'text-right',
                selected ? 'font-semibold text-foreground' : 'text-faint hover:text-muted-foreground',
              )}
            >
              <span className="num mr-1.5 text-xs text-faint">0{info.step}</span>
              {info.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// The one transaction behind the split, and who can see it. It brightens when
// the split has happened.
function TransactionStrip() {
  return (
    <div
      aria-label="The split transaction"
      className="glass grid rounded-xl px-4 text-[13px] sm:grid-cols-[1fr_1.45fr_1fr] short:grid-cols-1"
      style={{ opacity: 'calc(0.45 + 0.55 * clamp(0, calc((var(--p) - 0.6) / 0.2), 1))' }}
    >
      <div className="py-3 sm:pr-4">
        <span className="label-caps block">Bank → vault</span>
        <span className="num">−{SPLIT.usyc}.000000 USYC</span>
      </div>
      <div className="border-t border-border py-3 sm:border-t-0 sm:border-l sm:px-4 short:border-t short:border-l-0 short:px-0">
        <span className="label-caps block">Minted to Bank</span>
        <span className="num whitespace-nowrap">
          +{SPLIT.pt}.00 PT · <span className="text-yt">+{SPLIT.yt}.00 YT</span>
        </span>
      </div>
      <div className="border-t border-border py-3 sm:border-t-0 sm:border-l sm:pl-4 short:border-t short:border-l-0 short:pl-0">
        <span className="label-caps block">Visible to</span>
        <span>Bank · Operator · UsycIssuer</span>
      </div>
    </div>
  )
}
