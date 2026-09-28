/**
 * Scene 1 · Intro: the logo builds itself, then the name, the tagline and
 * the simulation notice.
 *
 * The logo animation tells the whole idea in one second: the silver block
 * (principal) comes in from the left, the blue wedge (yield) from the right,
 * and they lock together — one instrument made of principal + yield.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp, mix } from '../anim.ts'
import { Chip, Mark } from '../components/ui.tsx'
import { useScene } from '../components/Scene.tsx'
import { COLORS } from '../theme.ts'

export function Intro() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const block = between(frame, 0, 22)
  const wedge = between(frame, 8, 32)
  const name = enter(frame, 22)
  const tagline = enter(frame, cue(0, 1.2))
  const badge = enter(frame, cue(0, 2.4))
  const notice = enter(frame, cue(1))

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 44 }}>
        <div style={{ transform: `translateX(${mix(-80, 0, block)}px)` }}>
          {/* The wedge slides 40 units in from the right until it is seated. */}
          <Mark height={170} blockOpacity={block} wedgeOpacity={wedge} wedgeOffset={mix(40, 0, wedge)} />
        </div>
        <div style={{ fontSize: 170, fontWeight: 700, letterSpacing: '-0.04em', ...fadeUp(name, 40) }}>Exodus</div>
      </div>

      <div style={{ fontSize: 50, color: COLORS.muted, marginTop: 36, ...fadeUp(tagline) }}>
        Private <span style={{ color: COLORS.text }}>fixed-rate yield markets</span> on{' '}
        <span style={{ color: COLORS.yt }}>Canton</span>
      </div>

      <div style={{ marginTop: 44, display: 'flex', gap: 20, ...fadeUp(badge) }}>
        <Chip color={COLORS.yt}>HackCanton Season 3</Chip>
        <Chip>Inspired by Pendle · built for institutions</Chip>
      </div>

      <div style={{ marginTop: 28, ...fadeUp(notice) }}>
        <Chip color={COLORS.warning}>Simulated USYC &amp; USDC · test tokens from our own demo parties, not Circle</Chip>
      </div>
    </AbsoluteFill>
  )
}
