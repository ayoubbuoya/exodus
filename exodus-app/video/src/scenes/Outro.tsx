/**
 * Scene 13 · Outro: what comes next (spec section 14, "Next"), then the logo
 * and the repository link.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Chip, Kicker, Mark, Mono } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

const NEXT = ['Real USYC on Canton', 'Deploy to DevNet', 'PT & YT as CIP-56 holdings', 'Independent dealers']

export function Outro() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  // The roadmap shows during sentence 1, then gives way to the logo.
  const roadmap = enter(frame, cue(0)) * (1 - between(frame, cue(1) - 10, cue(1)))
  const logo = enter(frame, cue(1))

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36, opacity: roadmap }}>
        <Kicker>What's next</Kicker>
        <div style={{ display: 'flex', gap: 20 }}>
          {NEXT.map((item, i) => (
            <div key={item} style={fadeUp(enter(frame, cue(0, 0.3) + i * 6))}>
              <Chip color={COLORS.text}>{item}</Chip>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', ...fadeUp(logo, 40) }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <Mark height={140} />
          <div style={{ fontSize: 140, fontWeight: 700, letterSpacing: '-0.04em' }}>Exodus</div>
        </div>
        <div style={{ fontSize: 44, color: COLORS.muted, marginTop: 30 }}>
          Fixed rates for tokenized Treasuries · <span style={{ color: COLORS.yt }}>private by design</span>
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 44 }}>
          <Chip color={COLORS.yt}>HackCanton Season 3</Chip>
          <Chip>
            <Mono>github.com/ayoubbuoya/exodus</Mono>
          </Chip>
        </div>
      </div>
    </AbsoluteFill>
  )
}
