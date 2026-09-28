/**
 * Scene 7 · Atomic settlement (DvP): Alice's USDC and Bank's PT swap in one
 * Canton transaction (`Quote_Accept` in Rfq.daml). Both legs, or nothing.
 */
import { CheckIcon } from 'lucide-react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp, mix } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Chip, Coin, Party, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

const ALICE_X = 330
const BANK_X = 1590
const PARTY_Y = 470

export function Dvp() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const parties = enter(frame, 0, 24)
  const accept = enter(frame, cue(0))
  const box = enter(frame, cue(1))
  // Both coins move at the SAME time: that is the point of an atomic swap.
  const swap = between(frame, cue(1, 1.5), cue(1, 3.5))
  const both = enter(frame, cue(2))
  const benefits = enter(frame, cue(3))

  // The two coins cross in the middle on two arcs (USDC above, PT below).
  const arc = Math.sin(swap * Math.PI) * 90
  // Each coin travels between x = 500 and x = 1190, so its label never covers an avatar.
  const usdcX = mix(ALICE_X + 170, BANK_X - 400, swap)
  const ptX = mix(BANK_X - 400, ALICE_X + 170, swap)

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 5 · Atomic settlement" title="Cash and PT move together, or not at all" />

      <Party name="Alice" role="pays USDC" color={COLORS.usdc} style={{ position: 'absolute', left: ALICE_X - 150, width: 300, top: PARTY_Y - 60, ...fadeUp(parties) }} />
      <Party name="Bank" role="delivers PT" color={COLORS.pt} style={{ position: 'absolute', left: BANK_X - 150, width: 300, top: PARTY_Y - 60, ...fadeUp(parties) }} />

      {/* Alice presses Accept. */}
      <div style={{ position: 'absolute', left: ALICE_X - 100, top: PARTY_Y + 180, width: 200, display: 'flex', justifyContent: 'center', ...fadeUp(accept) }}>
        <Chip color={COLORS.success}>
          <CheckIcon size={26} /> Accept
        </Chip>
      </div>

      {/* The single Canton transaction that holds both legs. */}
      <div
        style={{
          position: 'absolute',
          left: ALICE_X + 130,
          top: PARTY_Y - 170,
          width: BANK_X - ALICE_X - 260,
          height: 360,
          borderRadius: 36,
          border: `3px dashed ${COLORS.yt}`,
          background: `${COLORS.yt}0d`,
          opacity: box,
        }}
      >
        <div style={{ position: 'absolute', top: -52, width: '100%', textAlign: 'center', fontSize: 30, fontWeight: 700, color: COLORS.yt }}>
          One Canton transaction
        </div>
      </div>

      <div style={{ position: 'absolute', left: usdcX, top: PARTY_Y - 90 - arc, opacity: box, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Coin kind="USDC" size={100} />
        <div style={{ fontSize: 34, fontWeight: 700, whiteSpace: 'nowrap' }}>487.75</div>
      </div>
      <div style={{ position: 'absolute', left: ptX, top: PARTY_Y + 40 + arc, opacity: box, display: 'flex', alignItems: 'center', gap: 16 }}>
        <Coin kind="PT" size={100} />
        <div style={{ fontSize: 34, fontWeight: 700, whiteSpace: 'nowrap' }}>500</div>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 740, display: 'flex', justifyContent: 'center', gap: 24 }}>
        <div style={fadeUp(both)}>
          <Chip color={COLORS.success}>
            <CheckIcon size={26} /> Both legs settle, or nothing does
          </Chip>
        </div>
        <div style={fadeUp(benefits)}>
          <Chip>No settlement risk</Chip>
        </div>
        <div style={fadeUp(enter(frame, cue(3, 0.8)))}>
          <Chip>Nothing to reconcile</Chip>
        </div>
      </div>
    </AbsoluteFill>
  )
}
