/**
 * Scene 2 · The problem: yield floats, two kinds of desks want opposite
 * things, and on a public chain (Pendle on Ethereum) everyone sees every trade.
 */
import { EyeIcon, LandmarkIcon, TrendingUpIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Chip, Glass, Mono, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

/** A made-up public trade feed: what anyone can read on a public chain. */
const PUBLIC_TRADES = [
  { wallet: '0x7a3f…c21', side: 'buys', size: '5,000,000 PT', price: '0.9612' },
  { wallet: '0x19be…07d', side: 'sells', size: '2,500,000 PT', price: '0.9608' },
  { wallet: '0xd04c…9aa', side: 'buys', size: '12,000,000 PT', price: '0.9615' },
  { wallet: '0x5e71…f3b', side: 'buys', size: '800,000 PT', price: '0.9611' },
]

/** One "who wants what" card on the left. */
function NeedCard({ icon, who, wants, progress }: { icon: ReactNode; who: string; wants: string; progress: number }) {
  return (
    <Glass style={{ display: 'flex', alignItems: 'center', gap: 28, padding: '28px 32px', ...fadeUp(progress) }}>
      <div style={{ color: COLORS.yt }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, color: COLORS.muted }}>{who}</div>
        <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>{wants}</div>
      </div>
    </Glass>
  )
}

/** A small line that wiggles up and down: the floating yield. */
function FloatingLine({ progress }: { progress: number }) {
  const points: string[] = []
  for (let i = 0; i <= 60; i++) {
    const x = (i / 60) * 520
    const y = 50 + Math.sin(i / 4) * 22 + Math.sin(i / 1.7) * 8
    points.push(`${x},${y}`)
  }
  return (
    <svg width={520} height={100}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={COLORS.usyc}
        strokeWidth={4}
        // Draw the line from left to right: the dash offset shrinks as progress grows.
        strokeDasharray={900}
        strokeDashoffset={900 * (1 - progress)}
      />
    </svg>
  )
}

export function Problem() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const fund = enter(frame, cue(0))
  const treasury = enter(frame, cue(1))
  const trading = enter(frame, cue(2))
  const feed = enter(frame, cue(3))
  const stamp = enter(frame, cue(4), 14)

  return (
    <AbsoluteFill>
      <SceneTitle kicker="The problem" title="Floating yield, public trades" />

      {/* Left: the asset and the two desks. */}
      <div style={{ position: 'absolute', left: 120, top: 300, width: 720, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Glass style={{ padding: '26px 32px', ...fadeUp(fund) }}>
          <div style={{ fontSize: 26, color: COLORS.muted }}>Tokenized Treasury fund (USYC)</div>
          <div style={{ fontSize: 36, fontWeight: 700, marginTop: 4 }}>
            Yield <span style={{ color: COLORS.usyc }}>floats</span> with rates
          </div>
          <FloatingLine progress={between(frame, cue(0), cue(0) + 60)} />
        </Glass>
        <NeedCard icon={<LandmarkIcon size={56} />} who="Treasury desk" wants="A fixed, known return" progress={treasury} />
        <NeedCard icon={<TrendingUpIcon size={56} />} who="Trading desk" wants="A bet on rates" progress={trading} />
      </div>

      {/* Right: a public chain's trade feed, readable by anyone. */}
      <div style={{ position: 'absolute', left: 960, top: 300, width: 840, ...fadeUp(feed) }}>
        <Glass style={{ padding: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 28, color: COLORS.muted }}>
            <EyeIcon size={32} color={COLORS.danger} /> Pendle on a public chain · visible to everyone
          </div>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PUBLIC_TRADES.map((trade, i) => {
              const row = enter(frame, cue(3) + 12 + i * 8)
              return (
                <div
                  key={trade.wallet}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 28,
                    padding: '14px 18px',
                    borderRadius: 14,
                    background: 'rgba(255, 122, 107, 0.07)',
                    ...fadeUp(row, 16),
                  }}
                >
                  <Mono style={{ color: COLORS.danger }}>{trade.wallet}</Mono>
                  <span>
                    {trade.side} <b>{trade.size}</b>
                  </span>
                  <Mono>@ {trade.price}</Mono>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 26, display: 'flex', gap: 14, opacity: enter(frame, cue(3, 3)) }}>
            <Chip color={COLORS.danger}>price</Chip>
            <Chip color={COLORS.danger}>size</Chip>
            <Chip color={COLORS.danger}>wallet</Chip>
          </div>
        </Glass>

        {/* The stamp: lands with a small zoom, tilted like a rubber stamp. */}
        <div
          style={{
            position: 'absolute',
            right: 40,
            top: 150,
            opacity: stamp,
            transform: `rotate(-8deg) scale(${1.4 - 0.4 * stamp})`,
            padding: '14px 30px',
            border: `5px solid ${COLORS.danger}`,
            borderRadius: 16,
            color: COLORS.danger,
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: '0.04em',
            background: 'rgba(6, 10, 19, 0.85)',
          }}
        >
          NOT FOR INSTITUTIONS
        </div>
      </div>
    </AbsoluteFill>
  )
}
