import { useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from 'cn'
import { CANVAS_HEIGHT, CANVAS_WIDTH, SEAM_POINTS, SLIDE, type Frame } from '@/landing/instrument-geometry'

// The Exodus instrument: one machined plate that comes apart into PRINCIPAL
// (silver) and YIELD (copper). Used by the hero and by the split story.
//
// How it is built: the Codex renders were cut into layers that share one camera
// and one 1510 × 720 canvas (public/instrument/), so they stack exactly:
//   1. shadow of the principal plate   (stays)
//   2. shadow of the yield plate       (moves with the yield plate)
//   3. yield plate                     (moves)
//   4. principal plate                 (stays; on top because it is closer to the camera)
//   5. the joined render               (on top until the plates start to move)
//
// The stage does not decide WHEN things move. Its parent sets two CSS variables
// (registered in index.css, each from 0 to 1):
//   --seam   how much of the cut line is drawn,
//   --slide  how far the yield plate has moved (1 = the full SLIDE).
// The hero animates them once with a keyframe; the split story drives them
// from the scroll position. Same object, two directors.

// The slide as a share of the canvas: 81 / 1510 = 5.36%, −25 / 720 = −3.47%.
const SLIDE_X = (SLIDE.x / CANVAS_WIDTH) * 100
const SLIDE_Y = (SLIDE.y / CANVAS_HEIGHT) * 100

// The yield layers follow --slide.
const SLIDING: CSSProperties = {
  transform: `translate(calc(var(--slide, 0) * ${SLIDE_X}%), calc(var(--slide, 0) * ${SLIDE_Y}%))`,
}
// The joined render disappears as soon as the plates start to move.
const JOINED: CSSProperties = { opacity: 'clamp(0, calc(1 - var(--slide, 0) * 14), 1)' }
// The cut line draws with --seam, then fades out while the plates separate.
const SEAM: CSSProperties = {
  strokeDasharray: 1,
  strokeDashoffset: 'calc(1 - var(--seam, 0))',
  opacity: 'clamp(0, calc(1 - var(--slide, 0) * 4), 1)',
}

type InstrumentStageProps = {
  className?: string
  /** Load the images straight away (hero) instead of when they get close (below the fold). */
  eager?: boolean
  /** Called once every layer has loaded, so an animation can start on a complete picture. */
  onReady?: () => void
  /** Text for screen readers: the picture's meaning in its current state. */
  label: string
}

const LAYERS = ['shadow-principal', 'shadow-yield', 'plate-yield', 'plate-principal', 'instrument-joined'] as const

export function InstrumentStage({ className, eager = false, onReady, label }: InstrumentStageProps) {
  const loaded = useRef(0)

  function onLayerLoad() {
    loaded.current += 1
    if (loaded.current === LAYERS.length) onReady?.()
  }

  return (
    // The moved layers' boxes (mostly transparent) would stick out and make
    // phones scroll sideways, so the stage clips them.
    <div role="img" aria-label={label} className={cn('relative aspect-[1510/720] w-full overflow-clip', className)}>
      {LAYERS.map((name) => (
        <img
          key={name}
          src={`/instrument/${name}.webp`}
          srcSet={`/instrument/${name}-sm.webp 755w, /instrument/${name}.webp 1510w`}
          sizes="(min-width: 1024px) 60vw, 100vw"
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          alt=""
          decoding="async"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager && name === 'instrument-joined' ? 'high' : undefined}
          onLoad={onLayerLoad}
          className={cn('absolute inset-0 size-full', name.startsWith('shadow') && 'opacity-60')}
          style={name.endsWith('yield') ? SLIDING : name === 'instrument-joined' ? JOINED : undefined}
        />
      ))}
      {/* The cut line. Its ink is fixed (not a theme colour): it sits on metal, not on the page. */}
      <svg viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} className="absolute inset-0 size-full" aria-hidden="true">
        <polyline
          points={SEAM_POINTS}
          pathLength={1}
          fill="none"
          stroke="#0e1210"
          strokeOpacity={0.9}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          style={SEAM}
        />
      </svg>
    </div>
  )
}

type InstrumentArtboardProps = {
  frame: Frame
  className?: string
  style?: CSSProperties
  eager?: boolean
  onReady?: () => void
  label: string
  /** Labels, leader lines and other overlays, placed with artX / artY / artSize. */
  children?: ReactNode
}

// The instrument plus the space around it for labels, as one box that keeps
// its proportions. It is a CSS size container, so overlays can size their
// text with `cqw` (see artSize) and everything scales together.
export function InstrumentArtboard({ frame, className, style, eager, onReady, label, children }: InstrumentArtboardProps) {
  return (
    <div
      className={cn('@container relative w-full', className)}
      style={{ aspectRatio: `${frame.width} / ${frame.height}`, ...style }}
    >
      <div
        className="absolute"
        style={{
          left: `${((0 - frame.x0) / frame.width) * 100}%`,
          top: `${((0 - frame.y0) / frame.height) * 100}%`,
          width: `${(CANVAS_WIDTH / frame.width) * 100}%`,
        }}
      >
        <InstrumentStage eager={eager} onReady={onReady} label={label} />
      </div>
      {children}
    </div>
  )
}
