/**
 * Scene 5 · Fixed yield: PT costs less than $1 today and is worth $1 at
 * maturity. The gap is a fixed rate.
 *
 * Numbers (docs/demo/script.md): the dealer's price on Oct 1 is 0.975503,
 * from Pendle's formula (1 + 5.2 % − 0.10 %)^(−182/365) = 1.051^(−0.4986) ≈ 0.975503,
 * which is a fixed 5.10 % a year for 182 days.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp, mix } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Coin, Glass, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

const PRICE_TODAY = 0.975503

// The plot area in screen pixels. y: $0.97 at the bottom, $1.005 at the top.
const LEFT = 260
const RIGHT = 1180
const BOTTOM = 820
const TOP = 340
function yOf(price: number): number {
  return BOTTOM - ((price - 0.97) / 0.035) * (BOTTOM - TOP)
}

export function Fixed() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const chart = enter(frame, cue(0))
  const today = enter(frame, cue(1))
  // "Pull to par": the PT price climbs from 0.9755 to 1.00 as maturity comes closer.
  const pull = between(frame, cue(3), cue(3, 2))
  const apy = enter(frame, cue(4))

  const tipX = mix(LEFT, RIGHT, pull)
  const tipPrice = mix(PRICE_TODAY, 1, pull)

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 3 · Fixed yield" title={<>Buy PT below $1, get <span style={{ color: COLORS.pt }}>$1</span> at maturity</>} />

      <Glass style={{ position: 'absolute', left: 120, top: 290, width: 1180, height: 620, padding: 0, ...fadeUp(chart) }} />
      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: chart }}>
        {/* The $1.00 line ("par"): what every PT is worth at maturity. */}
        <line x1={LEFT} x2={RIGHT} y1={yOf(1)} y2={yOf(1)} stroke={COLORS.faint} strokeWidth={3} strokeDasharray="12 10" />
        <text x={LEFT} y={yOf(1) - 18} fill={COLORS.muted} fontSize={28}>$1.00 at maturity</text>
        <text x={LEFT} y={BOTTOM + 56} fill={COLORS.faint} fontSize={26}>Today · Oct 1</text>
        <text x={RIGHT} y={BOTTOM + 56} fill={COLORS.faint} fontSize={26} textAnchor="end">Maturity · Apr 1</text>

        {/* The PT price line, drawn as it pulls to par. */}
        <line x1={LEFT} y1={yOf(PRICE_TODAY)} x2={tipX} y2={yOf(tipPrice)} stroke={COLORS.pt} strokeWidth={6} opacity={today} strokeLinecap="round" />

        {/* The gap between today's price and $1, shown as a bracket at maturity. */}
        <g opacity={apy}>
          <line x1={RIGHT + 40} x2={RIGHT + 40} y1={yOf(1)} y2={yOf(PRICE_TODAY)} stroke={COLORS.success} strokeWidth={4} />
          <line x1={RIGHT + 28} x2={RIGHT + 52} y1={yOf(1)} y2={yOf(1)} stroke={COLORS.success} strokeWidth={4} />
          <line x1={RIGHT + 28} x2={RIGHT + 52} y1={yOf(PRICE_TODAY)} y2={yOf(PRICE_TODAY)} stroke={COLORS.success} strokeWidth={4} />
          <line x1={LEFT} x2={RIGHT + 40} y1={yOf(PRICE_TODAY)} y2={yOf(PRICE_TODAY)} stroke={COLORS.success} strokeWidth={2} strokeDasharray="6 8" />
        </g>
      </svg>

      {/* Today's price, with the PT coin. */}
      <div style={{ position: 'absolute', left: LEFT - 40, top: yOf(PRICE_TODAY) - 40, display: 'flex', alignItems: 'center', gap: 20, ...fadeUp(today) }}>
        <Coin kind="PT" size={80} />
      </div>
      <div style={{ position: 'absolute', left: LEFT + 60, top: yOf(PRICE_TODAY) + 30, fontSize: 32, ...fadeUp(enter(frame, cue(2))) }}>
        Alice pays <b>$0.9755</b> per PT
      </div>

      {/* The moving coin at the tip of the line. */}
      <div style={{ position: 'absolute', left: tipX - 40, top: yOf(tipPrice) - 40, opacity: pull > 0 ? 1 : 0 }}>
        <Coin kind="PT" size={80} />
        <div style={{ position: 'absolute', left: -40, top: -56, fontSize: 32, fontWeight: 700, whiteSpace: 'nowrap' }}>
          ${tipPrice.toFixed(4)}
        </div>
      </div>

      {/* The result: the fixed rate. */}
      <div style={{ position: 'absolute', left: 1380, top: 360, width: 420, ...fadeUp(apy, 40) }}>
        <Glass style={{ textAlign: 'center', padding: '40px 28px', border: `1px solid ${COLORS.success}55` }}>
          <div style={{ fontSize: 28, color: COLORS.muted }}>Alice's fixed rate</div>
          <div style={{ fontSize: 120, fontWeight: 800, color: COLORS.success, letterSpacing: '-0.03em', lineHeight: 1.1 }}>5.10%</div>
          <div style={{ fontSize: 28, color: COLORS.muted }}>a year · locked in today</div>
          <div style={{ fontSize: 24, color: COLORS.faint, marginTop: 24 }}>+$0.0245 per PT in 182 days</div>
        </Glass>
      </div>
    </AbsoluteFill>
  )
}
