/**
 * Scene 6 · Private quote (RFQ): Alice asks one dealer (Bank) for a price.
 *
 * What the picture shows (Rfq.daml): Alice's `RfqRequest` goes to Bank only;
 * Bank's bot answers with a `Quote` (0.975503, 487.7515 USDC, valid 60 s)
 * and locks its 500 PT (`PT_Lock`) so they cannot be sold twice. The
 * Operator, who signs every PT, never sees the `Quote`: our Daml tests assert
 * it sees zero Quote contracts.
 */
import { EyeOffIcon, LockIcon, WavesIcon } from 'lucide-react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp, mix } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Chip, Glass, Mono, Party, SceneTitle } from '../components/ui.tsx'
import { COLORS, FPS } from '../theme.ts'

// Where Alice and Bank stand (centre of their avatars).
const ALICE_X = 330
const BANK_X = 1590
const PARTY_Y = 520

export function Rfq() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const parties = enter(frame, 0, 24)
  const noPool = enter(frame, cue(0)) * (1 - between(frame, cue(1) - 8, cue(1)))
  const request = between(frame, cue(1, 0.6), cue(1, 2.2))
  const quote = between(frame, cue(2, 0.8), cue(2, 2.4))
  const locked = enter(frame, cue(2, 4.5))
  const tunnel = enter(frame, cue(3))
  const operator = enter(frame, cue(4))
  // Quote countdown: 60 s, running from the moment it reaches Alice.
  const secondsLeft = Math.max(0, 60 - Math.floor(Math.max(0, frame - cue(2, 2.4)) / FPS))

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 4 · Private quote (RFQ)" title="Ask one dealer. Nobody else sees it." />

      <Party name="Alice" role="Client · wants fixed yield" color={COLORS.usdc} style={{ position: 'absolute', left: ALICE_X - 150, width: 300, top: PARTY_Y - 60, ...fadeUp(parties) }} />
      <Party name="Bank" role="Dealer · holds 1,000 PT" color={COLORS.pt} style={{ position: 'absolute', left: BANK_X - 150, width: 300, top: PARTY_Y - 60, ...fadeUp(parties) }} />

      {/* The private channel between the two: a glowing frame with a lock. */}
      <div
        style={{
          position: 'absolute',
          left: ALICE_X + 150,
          top: PARTY_Y - 150,
          width: BANK_X - ALICE_X - 300,
          height: 320,
          borderRadius: 40,
          border: `3px solid ${COLORS.yt}`,
          boxShadow: `0 0 60px ${COLORS.yt}55, inset 0 0 60px ${COLORS.yt}22`,
          opacity: tunnel,
        }}
      />
      <div style={{ position: 'absolute', left: 960 - 190, top: PARTY_Y - 200, width: 380, display: 'flex', justifyContent: 'center', ...fadeUp(tunnel) }}>
        <Chip color={COLORS.yt}>
          <LockIcon size={26} /> Only Alice and Bank
        </Chip>
      </div>

      {/* "No public pool": a crossed-out pool, shown only during the first sentence. */}
      <div style={{ position: 'absolute', left: 960 - 170, top: PARTY_Y - 40, width: 340, textAlign: 'center', opacity: noPool }}>
        <Chip color={COLORS.danger}>
          <WavesIcon size={28} /> <s>Public pool</s>
        </Chip>
      </div>

      {/* The request travels from Alice to Bank (upper lane). */}
      <div style={{ position: 'absolute', left: mix(ALICE_X + 110, BANK_X - 430, request), top: PARTY_Y - 110, opacity: request > 0 ? 1 : 0 }}>
        <Glass style={{ padding: '18px 26px', borderRadius: 20 }}>
          <div style={{ fontSize: 22, color: COLORS.muted }}>Request for quote</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>Buy 500 PT</div>
        </Glass>
      </div>

      {/* The firm quote travels back from Bank to Alice (lower lane). */}
      <div style={{ position: 'absolute', left: mix(BANK_X - 520, ALICE_X + 180, quote), top: PARTY_Y + 10, opacity: quote > 0 ? 1 : 0 }}>
        <Glass style={{ padding: '18px 26px', borderRadius: 20, border: `1px solid ${COLORS.success}66` }}>
          <div style={{ fontSize: 22, color: COLORS.muted }}>Firm quote · valid {secondsLeft} s</div>
          <div style={{ fontSize: 32, fontWeight: 700 }}>
            <Mono>0.975503</Mono> · 487.7515 USDC · <span style={{ color: COLORS.success }}>5.10%</span>
          </div>
        </Glass>
      </div>

      {/* Bank's PT are locked for Alice while the quote is open. */}
      <div style={{ position: 'absolute', left: BANK_X - 170, top: PARTY_Y + 160, width: 340, display: 'flex', justifyContent: 'center', ...fadeUp(locked) }}>
        <Chip color={COLORS.warning}>
          <LockIcon size={24} /> 500 PT locked
        </Chip>
      </div>

      {/* The Operator: signs every PT, sees no price. */}
      <div style={{ position: 'absolute', left: 960 - 330, top: 770, width: 660, ...fadeUp(operator) }}>
        <Glass style={{ display: 'flex', alignItems: 'center', gap: 24, padding: '20px 28px' }}>
          <EyeOffIcon size={48} color={COLORS.muted} />
          <div>
            <div style={{ fontSize: 26, color: COLORS.muted }}>Market operator · signs every PT</div>
            <div style={{ fontSize: 36, fontWeight: 700 }}>
              Quotes it can see: <span style={{ color: COLORS.success }}>0</span>
            </div>
          </div>
        </Glass>
      </div>
    </AbsoluteFill>
  )
}
