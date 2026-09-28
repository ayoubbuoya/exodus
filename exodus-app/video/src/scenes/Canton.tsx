/**
 * Scene 10 · Why Canton: the judges' key question from Season 2 ("would this
 * lose anything without the blockchain?") answered with the four Canton
 * features Exodus really uses (spec section 3).
 */
import { EyeOffIcon, ShieldCheckIcon, WalletIcon, ZapIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Glass, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

/** One Canton feature: what it is, and what Exodus uses it for. */
function Feature({ icon, title, use, progress }: { icon: ReactNode; title: string; use: string; progress: number }) {
  return (
    <Glass style={{ display: 'flex', gap: 28, alignItems: 'flex-start', padding: '32px 36px', ...fadeUp(progress, 40) }}>
      <div style={{ color: COLORS.yt, marginTop: 4 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 36, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 28, color: COLORS.muted, marginTop: 10, lineHeight: 1.35 }}>{use}</div>
      </div>
    </Glass>
  )
}

export function Canton() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const yes = enter(frame, cue(1), 12)

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Why Canton" title="Would it lose anything without Canton?" />
      <div
        style={{
          position: 'absolute',
          right: 140,
          top: 110,
          fontSize: 120,
          fontWeight: 800,
          color: COLORS.yt,
          opacity: yes,
          transform: `scale(${1.3 - 0.3 * yes})`,
        }}
      >
        Yes.
      </div>

      <div
        style={{
          position: 'absolute',
          left: 120,
          right: 120,
          top: 330,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 32,
        }}
      >
        <Feature
          icon={<EyeOffIcon size={56} />}
          title="Sub-transaction privacy"
          use="The operator sees the PT move, never the price. The cash issuer sees the cash, never the PT."
          progress={enter(frame, cue(2))}
        />
        <Feature
          icon={<ZapIcon size={56} />}
          title="Atomic multi-party transactions"
          use="Cash leg and PT leg settle in one transaction: no settlement risk."
          progress={enter(frame, cue(3))}
        />
        <Feature
          icon={<ShieldCheckIcon size={56} />}
          title="Permissioned parties"
          use="Only approved clients trade: one on-ledger access pass per client."
          progress={enter(frame, cue(4))}
        />
        <Feature
          icon={<WalletIcon size={56} />}
          title="Canton Token Standard (CIP-56)"
          use="Our USYC and USDC are standard holdings: any Canton wallet can show and send them."
          progress={enter(frame, cue(5))}
        />
      </div>
    </AbsoluteFill>
  )
}
