/**
 * Scene 4 · Split: 1,000 USYC go into the Exodus mark and come out as
 * 1,000 PT (principal) and 1,000 YT (yield).
 *
 * Formula (spec section 9, same as Pendle): PT = YT = shares × index.
 * On Oct 1 the index is 1.00, so 1,000 USYC → 1,000 PT + 1,000 YT.
 */
import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp, mix } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Arrow, Chip, Coin, Glass, Mark, SceneTitle, TokenAmount } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

/** The explanation card next to PT or YT. */
function Explain({ title, color, children, progress }: { title: string; color: string; children: ReactNode; progress: number }) {
  return (
    <Glass style={{ width: 540, padding: '24px 28px', ...fadeUp(progress) }}>
      <div style={{ fontSize: 30, fontWeight: 700, color }}>{title}</div>
      <div style={{ fontSize: 28, color: COLORS.muted, marginTop: 8, lineHeight: 1.35 }}>{children}</div>
    </Glass>
  )
}

export function Split() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const mark = enter(frame, cue(0))
  // 1,000 USYC appear on the left, then travel into the mark.
  const usyc = enter(frame, cue(1))
  const intoMark = between(frame, cue(1, 1.2), cue(1, 2.2))
  // Then PT and YT fly out to the right.
  const out = between(frame, cue(1, 2.2), cue(1, 3.2))
  // The mark "opens": the wedge (yield) moves away from the block (principal).
  const open = between(frame, cue(1, 2.0), cue(1, 3.0))

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 2 · Split" title="One token in, two tokens out" />

      {/* 1,000 USYC deposited on the left; a small coin travels from it into the mark (x 330 → 700). */}
      <div style={{ position: 'absolute', left: 190, top: 450, ...fadeUp(usyc) }}>
        <TokenAmount kind="USYC" amount="1,000" size={140} caption="deposited" />
      </div>
      <Arrow x1={400} y1={520} x2={620} y2={560} progress={intoMark} color={COLORS.usyc} />
      <div
        style={{
          position: 'absolute',
          left: mix(330, 700, intoMark),
          top: mix(480, 540, intoMark),
          opacity: intoMark > 0 && intoMark < 1 ? 1 : 0,
        }}
      >
        <Coin kind="USYC" size={70} />
      </div>

      {/* The Exodus mark in the middle is the "splitter". */}
      <div style={{ position: 'absolute', left: 640, top: 470, ...fadeUp(mark) }}>
        <Mark height={180} wedgeOffset={mix(0, 18, open)} />
      </div>
      <div style={{ position: 'absolute', left: 560, top: 700, width: 420, textAlign: 'center', opacity: enter(frame, cue(1, 3.4)) }}>
        <Chip>PT = YT = 1,000 × index 1.00</Chip>
      </div>

      <Arrow x1={900} y1={520} x2={1060} y2={400} progress={out} color={COLORS.pt} />
      <Arrow x1={900} y1={600} x2={1060} y2={720} progress={out} color={COLORS.yt} />

      {/* PT (top) and YT (bottom) come out, then each gets its explanation. */}
      <div style={{ position: 'absolute', left: 1080, top: 250, display: 'flex', alignItems: 'center', gap: 36 }}>
        <TokenAmount kind="PT" amount="1,000" size={120} style={{ ...fadeUp(out, 40) }} />
        <Explain title="Principal Token" color={COLORS.pt} progress={enter(frame, cue(2))}>
          Pays <b style={{ color: COLORS.text }}>$1</b> of USYC at maturity, Apr 1
        </Explain>
      </div>
      <div style={{ position: 'absolute', left: 1080, top: 600, display: 'flex', alignItems: 'center', gap: 36 }}>
        <TokenAmount kind="YT" amount="1,000" size={120} style={{ ...fadeUp(out, 40) }} />
        <Explain title="Yield Token" color={COLORS.yt} progress={enter(frame, cue(3))}>
          Collects <b style={{ color: COLORS.text }}>all the floating yield</b> until maturity
        </Explain>
      </div>
    </AbsoluteFill>
  )
}
