/**
 * Scene 9 · Maturity: on Apr 1 the index is 1.05. Alice redeems 500 PT for
 * 500 / 1.05 = 476.190476 USYC, worth exactly $500 (`PT_RequestRedeem` →
 * `Redeem_Settle`). She paid 487.7515 USDC, so she earned $12.25 in 182 days:
 * the 5.10 % fixed rate she locked on Oct 1.
 */
import { LockIcon } from 'lucide-react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Arrow, Chip, Glass, SceneTitle, TokenAmount } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

/** One horizontal bar of the "paid vs got back" comparison. */
function Bar({ label, value, width, color, progress }: { label: string; value: string; width: number; color: string; progress: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <div style={{ width: 150, fontSize: 28, color: COLORS.muted }}>{label}</div>
      <div style={{ width: width * progress, height: 54, borderRadius: 14, background: color }} />
      <div style={{ fontSize: 36, fontWeight: 700, opacity: progress }}>{value}</div>
    </div>
  )
}

export function Maturity() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const badge = enter(frame, cue(0))
  const pt = enter(frame, cue(1))
  const redeem = between(frame, cue(1, 1.5), cue(1, 2.5))
  const usyc = enter(frame, cue(1, 2.5))
  const equals = enter(frame, cue(1, 4.5))
  const bars = between(frame, cue(2), cue(2, 1.6))
  const privacy = enter(frame, cue(3))

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 7 · Maturity" title="Each PT pays one dollar" />
      <div style={{ position: 'absolute', right: 120, top: 110, ...fadeUp(badge) }}>
        <Chip color={COLORS.success}>Apr 1, 2027 · matured · index 1.05</Chip>
      </div>

      {/* 500 PT → 476.19 USYC. */}
      <div style={{ position: 'absolute', left: 200, top: 320, ...fadeUp(pt) }}>
        <TokenAmount kind="PT" amount="500" size={130} />
      </div>
      <Arrow x1={470} y1={390} x2={660} y2={390} progress={redeem} color={COLORS.muted} />
      <div style={{ position: 'absolute', left: 700, top: 320, ...fadeUp(usyc) }}>
        <TokenAmount kind="USYC" amount="476.19" size={130} />
      </div>
      <div style={{ position: 'absolute', left: 1120, top: 360, ...fadeUp(equals) }}>
        <Glass style={{ padding: '26px 32px' }}>
          <div style={{ fontSize: 28, color: COLORS.muted }}>476.19 USYC × $1.05</div>
          <div style={{ fontSize: 64, fontWeight: 800 }}>= $500.00</div>
        </Glass>
      </div>

      {/* Paid vs got back. The bars are drawn to scale (7 px per dollar above $400) so the gap is visible. */}
      <div style={{ position: 'absolute', left: 200, top: 620, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Bar label="Paid" value="487.75 USDC" width={(487.75 - 400) * 7} color={COLORS.usdc} progress={bars} />
        <Bar label="Got back" value="$500.00" width={(500 - 400) * 7} color={COLORS.pt} progress={bars} />
      </div>
      <div style={{ position: 'absolute', left: 1320, top: 650, ...fadeUp(enter(frame, cue(2, 1.8))) }}>
        <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.success }}>+$12.25</div>
        <div style={{ fontSize: 28, color: COLORS.muted }}>5.10% a year, fixed</div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 830, display: 'flex', justifyContent: 'center', ...fadeUp(privacy) }}>
        <Chip color={COLORS.yt}>
          <LockIcon size={24} /> Her price was only ever seen by Alice and Bank
        </Chip>
      </div>
    </AbsoluteFill>
  )
}
