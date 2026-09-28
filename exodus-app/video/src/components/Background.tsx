/**
 * The background behind every scene: deep navy, a faint grid and three slow
 * blue glows that drift across the whole video.
 *
 * Why it lives outside the scenes: the scenes cross-fade into each other, and
 * a background that keeps moving underneath makes the video feel like one
 * continuous piece instead of a slideshow.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { COLORS } from '../theme.ts'

/** One soft glow. It drifts on a slow circle; `phase` makes the three glows move differently. */
function Glow({ color, size, x, y, phase }: { color: string; size: number; x: number; y: number; phase: number }) {
  const frame = useCurrentFrame()
  // One full circle every 40 s (1200 frames at 30 fps): slow enough to feel still.
  const angle = (frame / 1200) * Math.PI * 2 + phase
  return (
    <div
      style={{
        position: 'absolute',
        left: x + Math.cos(angle) * 120 - size / 2,
        top: y + Math.sin(angle) * 80 - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
      }}
    />
  )
}

export function Background() {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg, overflow: 'hidden' }}>
      <Glow color="rgba(77, 141, 255, 0.22)" size={1300} x={1500} y={200} phase={0} />
      <Glow color="rgba(130, 190, 255, 0.12)" size={1100} x={300} y={900} phase={2} />
      <Glow color="rgba(169, 155, 255, 0.10)" size={900} x={900} y={500} phase={4} />
      {/* A 60 px grid, very faint, fading out towards the edges. */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(154,168,191,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(154,168,191,0.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
    </AbsoluteFill>
  )
}
