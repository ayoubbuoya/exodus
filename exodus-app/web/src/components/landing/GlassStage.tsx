import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from 'cn'
import type { Frame } from '@/landing/instrument-geometry'
import {
  DEPTH_LAYERS,
  DEPTH_STEP,
  GLASS_HEIGHT,
  GLASS_WIDTH,
  SHELL_FRONT,
  SLIDE,
  WEDGE_FRONT,
} from '@/landing/glass-geometry'

// The Exodus instrument in the Glacier look: a solid SILVER block (the
// principal, PT) with a blue GLASS wedge (the yield, YT) seated in its slot.
// When the instrument splits, the wedge slides out of the slot and lights up:
//   1,000 USYC  →  1,000 PT (the block stays)  +  1,000 YT (the wedge leaves).
// Used by the hero and by the split story.
//
// Two ways to draw it, chosen at run time:
//   - RENDERS: the Codex renders in public/glass/ (one 1536 × 1024 canvas, one
//     camera), stacked as layers. Used as soon as those files exist.
//   - VECTOR: an SVG drawn from the paths in landing/glass-geometry.ts. The
//     depth is faked by stacking copies of each face. Used until the renders
//     land, so the page already works and moves today.
//
// Like the old InstrumentStage, the stage does not decide WHEN things move.
// Its parent sets CSS variables (registered in index.css):
//   --rise   the intro, 0 → 1 (the object comes out of the dark),
//   --seam   how much of the outline of the wedge is traced in light,
//   --slide  how far the wedge has left the slot (1 = the full SLIDE),
//   --glow   how bright the blue light from the glass is.
// The hero plays them once with a keyframe; the split story drives them from
// the scroll position. The stage itself only adds the pointer tilt (hero) and
// a slow float.

type Look = 'checking' | 'renders' | 'vector'

// The render layers, back to front (file names in public/glass/).
//   shell         the block with the slot's inside rebuilt (stays)
//   shell-front   the parts of the block in FRONT of the wedge (stays, on top of
//                 the wedge). It is cut from hero-joined by us, not by Codex:
//                 without it the wedge's hidden tail would show through the block.
//   hero-joined   the original render, shown until the wedge starts to move,
//                 so the first frame is exactly what Codex rendered.
type Layer = { name: string; moves: boolean; kind?: 'shadow' | 'glow' | 'joined' }
const RENDER_LAYERS: Layer[] = [
  { name: 'shadow-shell', moves: false, kind: 'shadow' },
  { name: 'shadow-wedge', moves: true, kind: 'shadow' },
  { name: 'shell', moves: false },
  { name: 'glow-wedge', moves: true, kind: 'glow' },
  { name: 'wedge', moves: true },
  { name: 'shell-front', moves: false },
  { name: 'hero-joined', moves: false, kind: 'joined' },
]

// We ask the browser for one render once per page load, and every stage
// shares the answer. If it cannot load (the file is not there yet), the
// stages draw the vector version instead.
let lookProbe: Promise<Look> | null = null
function probeLook(): Promise<Look> {
  if (lookProbe === null) {
    lookProbe = new Promise((resolve) => {
      const image = new Image()
      image.onload = () => resolve('renders')
      image.onerror = () => resolve('vector')
      image.src = '/glass/shell-front.webp'
    })
  }
  return lookProbe
}

function useLook(): Look {
  const [look, setLook] = useState<Look>('checking')
  useEffect(() => {
    let cancelled = false
    probeLook().then((result) => {
      if (!cancelled) setLook(result)
    })
    return () => {
      cancelled = true
    }
  }, [])
  return look
}

// The intro: out of a blur, slightly lower and smaller, into place.
const RISE: CSSProperties = {
  opacity: 'var(--rise)',
  transform: 'translateY(calc((1 - var(--rise)) * 6%)) scale(calc(0.92 + 0.08 * var(--rise)))',
  filter: 'blur(calc((1 - var(--rise)) * 16px))',
}

// The pointer tilt: --tx / --ty go from −1 to 1 (written by the effect below).
// The transition smooths the jumps between pointer events.
const TILT: CSSProperties = {
  transform: 'perspective(1800px) rotateX(calc(var(--ty, 0) * -5deg)) rotateY(calc(var(--tx, 0) * 7deg))',
  transition: 'transform 900ms cubic-bezier(0.2, 0.8, 0.2, 1)',
}

// The slow float of the whole object (the global reduced-motion rule stops it).
const FLOAT: CSSProperties = { animation: 'glass-float 9s ease-in-out infinite' }

// The wedge's slide as a share of the canvas: 200 / 1536 = 13.02%.
const SLIDE_X = (SLIDE.x / GLASS_WIDTH) * 100
const SLIDE_Y = (SLIDE.y / GLASS_HEIGHT) * 100

// The wedge is closer to the viewer than the block, so it follows the pointer
// a little more (parallax): up to 10 px sideways and 6 px up or down.
const SLIDING_HTML: CSSProperties = {
  transform: `translate(calc(var(--slide, 0) * ${SLIDE_X}% + var(--tx, 0) * 10px), calc(var(--slide, 0) * ${SLIDE_Y}% + var(--ty, 0) * 6px))`,
}
// The same move inside the SVG, where px are canvas units.
const SLIDING_SVG: CSSProperties = {
  transform: `translate(calc(var(--slide, 0) * ${SLIDE.x}px + var(--tx, 0) * 14px), calc(var(--slide, 0) * ${SLIDE.y}px + var(--ty, 0) * 8px))`,
}

// The traced outline: draws with --seam, then fades while the wedge leaves.
const SEAM: CSSProperties = {
  strokeDasharray: 1,
  strokeDashoffset: 'calc(1 - var(--seam, 0))',
  opacity: 'clamp(0, calc(1 - var(--slide, 0) * 3), 1)',
}

type GlassStageProps = {
  className?: string
  /** Load the renders straight away (hero) instead of when they get close. */
  eager?: boolean
  /** Follow the pointer with a small 3D tilt (hero only). */
  tilt?: boolean
  /** Draw the dial ring behind the object (hero only). */
  halo?: boolean
  /** Called once the picture is complete, so an animation can start on it. */
  onReady?: () => void
  /** Text for screen readers: the picture's meaning in its current state. */
  label: string
}

export function GlassStage({ className, eager = false, tilt = false, halo = false, onReady, label }: GlassStageProps) {
  const look = useLook()
  const tiltRef = useRef<HTMLDivElement>(null)
  const loaded = useRef(0)
  // onReady must fire only once, even if the parent re-renders with a new function.
  const readyFired = useRef(false)

  function markReady() {
    if (readyFired.current) return
    readyFired.current = true
    onReady?.()
  }

  // The vector version is complete as soon as it is on screen.
  useEffect(() => {
    if (look === 'vector' && !readyFired.current) {
      readyFired.current = true
      onReady?.()
    }
  }, [look, onReady])

  function onLayerLoad() {
    loaded.current += 1
    if (loaded.current === RENDER_LAYERS.length) markReady()
  }

  // Pointer tilt. Only with a mouse or trackpad (not touch) and only when the
  // visitor has not asked for less motion. We write two numbers on the tilt
  // layer once per animation frame; the children read them through CSS.
  useEffect(() => {
    const element = tiltRef.current
    if (!tilt || element === null) return
    const finePointer = window.matchMedia('(pointer: fine)').matches
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!finePointer || calm) return
    let frame = 0
    let x = 0
    let y = 0
    const apply = () => {
      frame = 0
      element.style.setProperty('--tx', x.toFixed(3))
      element.style.setProperty('--ty', y.toFixed(3))
    }
    const onMove = (event: PointerEvent) => {
      // The pointer's place on the screen, from −1 (left/top) to 1 (right/bottom).
      x = (event.clientX / window.innerWidth) * 2 - 1
      y = (event.clientY / window.innerHeight) * 2 - 1
      if (frame === 0) frame = requestAnimationFrame(apply)
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [tilt])

  return (
    <div role="img" aria-label={label} className={cn('relative aspect-[1536/1024] w-full', className)}>
      {halo && <Halo />}
      <div className="absolute inset-0" style={RISE}>
        <div ref={tiltRef} className="absolute inset-0" style={TILT}>
          <div className="absolute inset-0" style={FLOAT}>
            {look === 'renders' && <RenderedInstrument eager={eager} onLayerLoad={onLayerLoad} />}
            {look === 'vector' && <VectorInstrument />}
            <SeamTrace />
          </div>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// The renders, stacked. Every file has the same 1536 × 1024 canvas.

function RenderedInstrument({ eager, onLayerLoad }: { eager: boolean; onLayerLoad: () => void }) {
  return (
    <>
      {RENDER_LAYERS.map((layer) => {
        let style: CSSProperties | undefined = layer.moves ? SLIDING_HTML : undefined
        // The light layer is drawn on black; "screen" blending makes black
        // disappear and adds the blue light to whatever is under it.
        if (layer.kind === 'glow') style = { ...SLIDING_HTML, mixBlendMode: 'screen', opacity: 'var(--glow)' }
        // The joined render hides as soon as the wedge starts to move.
        if (layer.kind === 'joined') style = { opacity: 'clamp(0, calc(1 - var(--slide, 0) * 14), 1)' }
        return (
          <img
            key={layer.name}
            src={`/glass/${layer.name}.webp`}
            srcSet={`/glass/${layer.name}-sm.webp 768w, /glass/${layer.name}.webp 1536w`}
            sizes="(min-width: 1024px) 60vw, 100vw"
            width={GLASS_WIDTH}
            height={GLASS_HEIGHT}
            alt=""
            decoding="async"
            loading={eager ? 'eager' : 'lazy'}
            fetchPriority={eager && layer.kind === 'joined' ? 'high' : undefined}
            onLoad={onLayerLoad}
            className={cn('absolute inset-0 size-full', layer.kind === 'shadow' && 'opacity-70')}
            style={style}
          />
        )
      })}
    </>
  )
}

// ----------------------------------------------------------------------------
// The vector version. Colours here are fixed, not theme tokens: they are the
// materials of a physical object (polished silver, blue optical glass), and
// the landing page is always dark.

function VectorInstrument() {
  // Gradient ids must be unique on the page (the hero and the split story both
  // draw this SVG). useId gives a unique string; we keep only safe characters.
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = (name: string) => `${uid}-${name}`
  const url = (name: string) => `url(#${id(name)})`

  // Depth copies, from the back (the furthest one) to the front.
  // Example: layer 24 is moved 24 × (−4.6, −3) = (−110, −72) up and to the left.
  const depth = Array.from({ length: DEPTH_LAYERS }, (_, index) => DEPTH_LAYERS - index)
  const at = (layer: number) => `translate(${layer * DEPTH_STEP.x} ${layer * DEPTH_STEP.y})`

  return (
    <svg viewBox={`0 0 ${GLASS_WIDTH} ${GLASS_HEIGHT}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <defs>
        {/* Polished silver, front face: bright, a cool dip, bright, darker at the bottom right. */}
        <linearGradient id={id('silver-face')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f8fafd" />
          <stop offset="0.32" stopColor="#c6cfdb" />
          <stop offset="0.5" stopColor="#eff3f8" />
          <stop offset="0.82" stopColor="#98a3b4" />
          <stop offset="1" stopColor="#ced5df" />
        </linearGradient>
        {/* Silver sides: the top face (y 208–280) catches the light, the left face
            falls into shade towards the bottom. Darker than the front face, so the
            block reads as one solid piece and not as two stacked squares. */}
        <linearGradient id={id('silver-side')} gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="830">
          <stop offset="0" stopColor="#d9e0ea" />
          <stop offset="0.14" stopColor="#a9b3c2" />
          <stop offset="0.5" stopColor="#5d687b" />
          <stop offset="1" stopColor="#1f2633" />
        </linearGradient>
        {/* The rounded edge around the front face (a chamfer that catches light top-left). */}
        <linearGradient id={id('bevel')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#dde4ee" />
          <stop offset="1" stopColor="#566073" />
        </linearGradient>
        {/* A soft vertical reflection band across the silver. */}
        <linearGradient id={id('reflection')} gradientUnits="userSpaceOnUse" x1="560" y1="0" x2="760" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Blue optical glass, front face: light at the top right, deep blue at the bottom left. */}
        <linearGradient id={id('glass-face')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a6caff" />
          <stop offset="0.28" stopColor="#4d8dff" />
          <stop offset="0.66" stopColor="#1a4fe0" />
          <stop offset="1" stopColor="#0a2785" />
        </linearGradient>
        <linearGradient id={id('glass-side')} gradientUnits="userSpaceOnUse" x1="0" y1="290" x2="0" y2="790">
          <stop offset="0" stopColor="#7eb0ff" />
          <stop offset="0.5" stopColor="#2358e8" />
          <stop offset="1" stopColor="#081c6a" />
        </linearGradient>
        {/* The light the glass gives off, and the caustic pool it throws on the floor. */}
        <radialGradient id={id('glow')}>
          <stop offset="0" stopColor="#4d8dff" stopOpacity="0.55" />
          <stop offset="0.45" stopColor="#2f6bff" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2f6bff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id('floor')}>
          <stop offset="0" stopColor="#000000" stopOpacity="0.65" />
          <stop offset="1" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        {/* Blue light spilling onto the silver around the slot's mouth. */}
        <radialGradient id={id('spill')} gradientUnits="userSpaceOnUse" cx="1090" cy="560" r="340">
          <stop offset="0" stopColor="#7fb0ff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7fb0ff" stopOpacity="0" />
        </radialGradient>
        {/* The band of light that crosses the glass now and then. */}
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id('wedge-clip')}>
          <path d={WEDGE_FRONT} />
        </clipPath>
        <clipPath id={id('shell-clip')}>
          <path d={SHELL_FRONT} />
        </clipPath>
      </defs>

      {/* Contact shadow under the block. */}
      <ellipse cx="770" cy="866" rx="400" ry="44" fill={url('floor')} />

      {/* The glow behind everything, travelling with the wedge. */}
      <g style={SLIDING_SVG}>
        <ellipse cx="1070" cy="560" rx="470" ry="360" fill={url('glow')} style={{ opacity: 'var(--glow)' }} />
        {/* Light through the glass lands on the floor as a blue pool. */}
        <ellipse cx="1040" cy="850" rx="240" ry="30" fill={url('glow')} style={{ opacity: 'var(--glow)' }} />
      </g>

      {/* The block's depth: its top and left faces, and the inside of the slot. */}
      <g>
        {depth.map((layer) => (
          <path key={layer} d={SHELL_FRONT} transform={at(layer)} fill={url('silver-side')} />
        ))}
      </g>

      {/* The glass wedge. It is drawn BEFORE the block's front face, so the
          block hides the part of the wedge that sits inside the slot. */}
      <g style={SLIDING_SVG}>
        {depth.map((layer) => (
          <path key={layer} d={WEDGE_FRONT} transform={at(layer)} fill={url('glass-side')} opacity="0.94" />
        ))}
        <path d={WEDGE_FRONT} fill={url('glass-face')} stroke="#cfe2ff" strokeOpacity="0.55" strokeWidth="3" />
        {/* The inner face: thick glass looks lighter in the middle than at its rim. */}
        <path
          d="M874 552L1136 409Q1152 400 1152 419V701Q1152 720 1136 711L874 568Q860 560 874 552Z"
          fill="#ffffff"
          opacity="0.1"
        />
        {/* A bright line where the top edge catches the key light. */}
        <path d="M836 541L1146 372" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="3" strokeLinecap="round" />
        {/* The sheen: a skewed band of light, clipped to the wedge's face. */}
        <g clipPath={url('wedge-clip')}>
          <polygon
            points="700,300 880,300 820,820 640,820"
            fill={url('sheen')}
            style={{ transformBox: 'fill-box', animation: 'glass-sheen 7s var(--ease-standard) 3s infinite' }}
          />
        </g>
      </g>

      {/* The block's front face, on top: a chamfer ring, then the silver. */}
      <path d={SHELL_FRONT} fill={url('silver-face')} stroke={url('bevel')} strokeWidth="10" strokeLinejoin="round" paintOrder="stroke" />
      <g clipPath={url('shell-clip')}>
        <rect x="520" y="280" width="540" height="540" fill={url('reflection')} />
        {/* Blue light on the silver around the slot, brighter as the glass glows. */}
        <path d={SHELL_FRONT} fill={url('spill')} style={{ opacity: 'calc(var(--glow) * 0.8)', mixBlendMode: 'screen' }} />
      </g>
      {/* The top edge of the front face catches the most light. */}
      <path d="M632 284H950" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

// ----------------------------------------------------------------------------

// The outline of the wedge traced in light: the "cut" of the split story.
// Two strokes: a wide soft one (the glow) and a thin bright one (the line).
function SeamTrace() {
  return (
    <svg viewBox={`0 0 ${GLASS_WIDTH} ${GLASS_HEIGHT}`} className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
      <path d={WEDGE_FRONT} pathLength={1} fill="none" stroke="#7fb0ff" strokeOpacity={0.35} strokeWidth={14} strokeLinejoin="round" style={SEAM} />
      <path d={WEDGE_FRONT} pathLength={1} fill="none" stroke="#eaf2ff" strokeWidth={3} strokeLinejoin="round" style={SEAM} />
    </svg>
  )
}

// The dial behind the hero object: a fine ring of ticks and a thin arc of
// light that turns very slowly, like the bezel of an instrument. Decoration
// only, in silver (never the yield blue).
function Halo() {
  return (
    <div aria-hidden="true" className="absolute top-[54%] left-[51%] aspect-square w-[58%] -translate-x-1/2 -translate-y-1/2">
      {/* Soft navy light behind the object. */}
      <div className="absolute inset-[-12%] rounded-full bg-[radial-gradient(closest-side,rgb(70_110_200/0.22),transparent)]" />
      {/* Tick ring: 72 ticks (one every 5°), kept only in a thin band near the edge. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'repeating-conic-gradient(rgb(200 215 240 / 0.28) 0deg 0.35deg, transparent 0.35deg 5deg)',
          mask: 'radial-gradient(closest-side, transparent 93%, #000 93.5%, #000 97%, transparent 97.5%)',
          WebkitMask: 'radial-gradient(closest-side, transparent 93%, #000 93.5%, #000 97%, transparent 97.5%)',
        }}
      />
      {/* The turning arc of light, on a 1 px ring. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg 40deg, rgb(230 240 255 / 0.7) 90deg, transparent 140deg 220deg, rgb(160 185 230 / 0.35) 270deg, transparent 320deg)',
          mask: 'radial-gradient(closest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px), #000 100%, transparent 100%)',
          WebkitMask: 'radial-gradient(closest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px), #000 100%, transparent 100%)',
          animation: 'halo-spin 48s linear infinite',
        }}
      />
      {/* An inner hairline ring, fixed. */}
      <div className="absolute inset-[9%] rounded-full border border-white/[0.06]" />
    </div>
  )
}

// ----------------------------------------------------------------------------

type GlassArtboardProps = {
  frame: Frame
  className?: string
  style?: CSSProperties
  eager?: boolean
  tilt?: boolean
  halo?: boolean
  onReady?: () => void
  label: string
  /** Labels, leader lines and cards, placed with artX / artY / artSize. */
  children?: ReactNode
}

// The instrument plus the space around it for labels, as one box that keeps
// its proportions. It is a CSS size container, so overlays can size their
// text with `cqw` (see artSize) and everything scales together.
// `overflow-x-clip` stops the glow from making phones scroll sideways, while
// chips may still float a little above or below the box.
export function GlassArtboard({ frame, className, style, eager, tilt, halo, onReady, label, children }: GlassArtboardProps) {
  return (
    <div
      className={cn('@container relative w-full overflow-x-clip', className)}
      style={{ aspectRatio: `${frame.width} / ${frame.height}`, ...style }}
    >
      <div
        className="absolute"
        style={{
          left: `${((0 - frame.x0) / frame.width) * 100}%`,
          top: `${((0 - frame.y0) / frame.height) * 100}%`,
          width: `${(GLASS_WIDTH / frame.width) * 100}%`,
        }}
      >
        <GlassStage eager={eager} tilt={tilt} halo={halo} onReady={onReady} label={label} />
      </div>
      {children}
    </div>
  )
}
