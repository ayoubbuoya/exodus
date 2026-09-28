import { useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from 'cn'
import type { Frame } from '@/landing/artboard'
import { GLASS_HEIGHT, GLASS_WIDTH, SLIDE } from '@/landing/glass-geometry'

// The Exodus instrument: a solid SILVER block (the principal, PT) with a blue
// GLASS wedge (the yield, YT) seated in its slot. When the instrument splits,
// the wedge slides out of the slot and lights up:
//   1,000 USYC  →  1,000 PT (the block stays)  +  1,000 YT (the wedge leaves).
// Used by the hero and by the split story.
//
// It is a stack of Blender renders (public/glass/, made by the frontend's
// local asset pipeline, which is not part of the repo),
// all from one scene and one camera on a 1536 × 1024 canvas, so they line up
// exactly. Back to front:
//   shell         the block alone, with its soft floor shadow (what you see
//                 around the slot once the wedge has moved)
//   wedge         the whole glass wedge, including its tail inside the slot,
//                 with its own floor shadow, so the shadow moves with it
//   shell-front   the metal in FRONT of the wedge (the slot's walls). Blender
//                 renders it with the wedge as a "holdout" (a hole), so it is
//                 exact. Without it the wedge's tail would show through the metal.
//   hero-joined   everything together, shown until anything moves, so the
//                 first frame is exactly what Blender rendered
//
// The stage does not decide WHEN things move. Its parent sets CSS variables
// (registered in index.css):
//   --rise   the intro, 0 → 1 (the object comes out of the dark),
//   --seam   the "cut": a blue light gathers around the wedge,
//   --slide  how far the wedge has left the slot (1 = the full SLIDE),
//   --glow   how bright the blue light from the glass is.
// The hero plays them once with a keyframe; the split story drives them from
// the scroll position. Apart from that the object stands still: no float and
// no pointer tilt, so the render reads as a solid, calm object.

type Layer = { name: string; kind?: 'wedge' | 'joined' }
const LAYERS: Layer[] = [{ name: 'shell' }, { name: 'wedge', kind: 'wedge' }, { name: 'shell-front' }, { name: 'hero-joined', kind: 'joined' }]

// The intro: out of a blur, slightly lower and smaller, into place.
const RISE: CSSProperties = {
  opacity: 'var(--rise)',
  transform: 'translateY(calc((1 - var(--rise)) * 6%)) scale(calc(0.92 + 0.08 * var(--rise)))',
  filter: 'blur(calc((1 - var(--rise)) * 16px))',
}

// The wedge's slide as a share of the canvas (measured by the Blender script).
// Example: 206 px of 1536 = 13.4% to the right, 28 px of 1024 = 2.7% up.
const SLIDE_X = (SLIDE.x / GLASS_WIDTH) * 100
const SLIDE_Y = (SLIDE.y / GLASS_HEIGHT) * 100
const SLIDING = `translate(calc(var(--slide, 0) * ${SLIDE_X}%), calc(var(--slide, 0) * ${SLIDE_Y}%))`

function layerStyle(layer: Layer): CSSProperties | undefined {
  switch (layer.kind) {
    case 'wedge':
      // The cut: a blue halo around the glass, strongest at --seam = 1, gone
      // once the wedge has left (the render's own glass light takes over).
      // Example: --seam 1, --slide 0 → a 22 px halo at 90% strength.
      return {
        transform: SLIDING,
        filter:
          'drop-shadow(0 0 calc(var(--seam, 0) * 22px) rgb(110 165 255 / calc(var(--seam, 0) * (1 - var(--slide, 0)) * 0.9)))',
      }
    case 'joined':
      // Hidden as soon as the cut starts or the wedge moves.
      return { opacity: 'clamp(0, calc(1 - var(--slide, 0) * 14 - var(--seam, 0) * 14), 1)' }
    default:
      return undefined
  }
}

type GlassStageProps = {
  className?: string
  /** Load the renders straight away (hero) instead of when they get close. */
  eager?: boolean
  /** Called once every layer has loaded, so an animation can start on a complete picture. */
  onReady?: () => void
  /** Text for screen readers: the picture's meaning in its current state. */
  label: string
}

export function GlassStage({ className, eager = false, onReady, label }: GlassStageProps) {
  const loaded = useRef(0)

  function onLayerLoad() {
    loaded.current += 1
    if (loaded.current === LAYERS.length) onReady?.()
  }

  return (
    <div role="img" aria-label={label} className={cn('relative aspect-[1536/1024] w-full', className)}>
      <div className="absolute inset-0" style={RISE}>
        {/* Light on the floor under the object, brighter as the glass glows.
            It sits under the block and the slid wedge (canvas x 230–1230,
            y 840–970), inside the artboard, so no edge of it is ever cut off. */}
        <div
          aria-hidden="true"
          className="absolute top-[82%] right-[20%] left-[15%] h-[13%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(110_150_255/0.2),transparent)]"
          style={{ opacity: 'var(--glow)' }}
        />
        {LAYERS.map((layer) => (
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
            className="absolute inset-0 size-full"
            style={layerStyle(layer)}
          />
        ))}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------

type GlassArtboardProps = {
  frame: Frame
  className?: string
  style?: CSSProperties
  eager?: boolean
  onReady?: () => void
  label: string
  /** Labels, leader lines and cards, placed with artX / artY / artSize. */
  children?: ReactNode
}

// The instrument plus the space around it for labels, as one box that keeps
// its proportions. It is a CSS size container, so overlays can size their
// text with `cqw` (see artSize) and everything scales together.
// `overflow-x-clip` stops the moving wedge and the glow from making phones
// scroll sideways, while chips may still float a little above or below.
export function GlassArtboard({ frame, className, style, eager, onReady, label, children }: GlassArtboardProps) {
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
        <GlassStage eager={eager} onReady={onReady} label={label} />
      </div>
      {children}
    </div>
  )
}
