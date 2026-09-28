/**
 * Scene 8 · Floating yield: on Jan 1 the index is 1.025, and Bank's 1,000 YT
 * have earned 1,000 × (1/1.00 − 1/1.025) = 24.390243 USYC (spec section 9).
 * The Operator pays it from the vault that holds the split USYC
 * (`YT_RequestClaim` → `Claim_Settle` in Tokens.daml).
 */
import { CalendarIcon, VaultIcon } from 'lucide-react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp, mix } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Arrow, Chip, Coin, Glass, Mono, Party, SceneTitle, TokenAmount } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

export function Yield() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const clock = enter(frame, cue(0))
  // The index and the date move together over 3 seconds.
  const grow = between(frame, cue(0, 1.2), cue(0, 3.4))
  const index = mix(1, 1.025, grow)
  const days = Math.round(mix(0, 92, grow)) // Oct 1 → Jan 1 is 92 days
  const date = new Date(Date.UTC(2026, 9, 1 + days))
  const dateText = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  const bank = enter(frame, cue(1))
  const vault = enter(frame, cue(1, 1.5))
  const pay = between(frame, cue(1, 3), cue(1, 4.5))
  const formula = enter(frame, cue(1, 5))

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 6 · Floating yield" title={<>YT collects what the fund <span style={{ color: COLORS.yt }}>earns</span></>} />

      {/* Left: the clock and the index. */}
      <div style={{ position: 'absolute', left: 120, top: 320, width: 560, ...fadeUp(clock) }}>
        <Glass>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, color: COLORS.muted }}>
            <CalendarIcon size={34} /> {dateText}
          </div>
          <div style={{ fontSize: 26, color: COLORS.muted, marginTop: 36 }}>USYC index</div>
          <div style={{ fontSize: 110, fontWeight: 800, color: COLORS.usyc, letterSpacing: '-0.03em' }}>{index.toFixed(3)}</div>
          <div style={{ fontSize: 26, color: COLORS.faint }}>was 1.000 on Oct 1</div>
        </Glass>
      </div>

      {/* Middle: the Operator's vault (holds the USYC that was split). */}
      <div style={{ position: 'absolute', left: 820, top: 360, width: 320, textAlign: 'center', ...fadeUp(vault) }}>
        <Glass style={{ padding: '36px 20px' }}>
          <VaultIcon size={90} color={COLORS.usyc} />
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 12 }}>Operator vault</div>
          <div style={{ fontSize: 22, color: COLORS.muted }}>the split USYC</div>
        </Glass>
      </div>

      {/* Right: Bank holds the YT. */}
      <div style={{ position: 'absolute', left: 1380, top: 300, width: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, ...fadeUp(bank) }}>
        <Party name="Bank" role="holds the YT" color={COLORS.yt} />
        <TokenAmount kind="YT" amount="1,000" size={90} />
      </div>

      <Arrow x1={1150} y1={470} x2={1500} y2={380} progress={pay} color={COLORS.usyc} />
      {/* The payout coin flies from the vault to Bank. */}
      <div style={{ position: 'absolute', left: mix(940, 1500, pay), top: mix(440, 300, pay), opacity: pay > 0 && pay < 1 ? 1 : 0 }}>
        <Coin kind="USYC" size={80} />
      </div>
      <div style={{ position: 'absolute', left: 1360, top: 200, width: 460, textAlign: 'center', ...fadeUp(enter(frame, cue(1, 4.5))) }}>
        <Chip color={COLORS.usyc}>+24.39 USYC of yield</Chip>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 800, textAlign: 'center', fontSize: 30, color: COLORS.muted, ...fadeUp(formula) }}>
        <Mono>1,000 YT × (1/1.00 − 1/1.025) = 24.390243 USYC</Mono>
      </div>
    </AbsoluteFill>
  )
}
