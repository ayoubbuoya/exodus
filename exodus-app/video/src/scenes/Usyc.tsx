/**
 * Scene 3 · The asset: USYC is a token whose price grows every day.
 *
 * The chart goes from $1.00 on Oct 1 to $1.05 on Apr 1 (the demo story's
 * maturity index). At the end, dashed "what if" lines show that nobody knows
 * the final number in advance — that uncertainty is why people want PT and YT.
 */
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Coin, Glass, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

// The plot area, in screen pixels.
const LEFT = 360
const RIGHT = 1500
const Y_AT_100 = 800 // where $1.00 is
const Y_AT_105 = 400 // where $1.05 is

/** Screen y of an index value. Example: 1.025 is half way between 800 and 400 → 600. */
function yOf(index: number): number {
  return Y_AT_100 + ((index - 1) / 0.05) * (Y_AT_105 - Y_AT_100)
}

/**
 * The fund's index at time t (0 = Oct 1, 1 = Apr 1): about +5 % over the
 * period, with a tiny wobble so it looks like real data. The wobble is 0 at
 * both ends, so the line starts at exactly 1.00 and ends at exactly 1.05.
 */
function indexAt(t: number, end = 1.05): number {
  return 1 + (end - 1) * t + 0.0016 * Math.sin(Math.PI * t * 5)
}

/** The line's points from t = 0 to t = `upTo`, as an SVG "x,y x,y …" string. */
function linePoints(upTo: number, end = 1.05): string {
  const points: string[] = []
  const steps = 80
  for (let i = 0; i <= steps * upTo; i++) {
    const t = i / steps
    points.push(`${LEFT + t * (RIGHT - LEFT)},${yOf(indexAt(t, end))}`)
  }
  return points.join(' ')
}

export function Usyc() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const chart = enter(frame, cue(0))
  // The line is drawn from "Oct 1" (sentence 2) to "Apr 1" (sentence 3).
  const drawn = between(frame, cue(1), cue(2, 1.2))
  const t = Math.max(drawn, 0.001)
  const tipX = LEFT + t * (RIGHT - LEFT)
  const tipY = yOf(indexAt(t))
  const area = enter(frame, cue(3))
  const unknown = between(frame, cue(3, 1.5), cue(3, 3))

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Step 1 · The asset" title={<>USYC: a token that <span style={{ color: COLORS.usyc }}>grows</span></>} />

      <Glass style={{ position: 'absolute', left: 240, top: 250, width: 1440, height: 670, padding: 0, ...fadeUp(chart) }} />

      <svg width={1920} height={1080} style={{ position: 'absolute', inset: 0, opacity: chart }}>
        {/* Grid lines and labels for $1.00, $1.025 and $1.05. */}
        {[1, 1.025, 1.05].map((level) => (
          <g key={level}>
            <line x1={LEFT} x2={RIGHT} y1={yOf(level)} y2={yOf(level)} stroke={COLORS.line} strokeWidth={2} />
            <text x={LEFT - 24} y={yOf(level) + 9} fill={COLORS.faint} fontSize={26} textAnchor="end">
              ${level.toFixed(level === 1.025 ? 3 : 2)}
            </text>
          </g>
        ))}
        <text x={LEFT} y={Y_AT_100 + 60} fill={COLORS.faint} fontSize={26}>Oct 1, 2026</text>
        <text x={RIGHT} y={Y_AT_100 + 60} fill={COLORS.faint} fontSize={26} textAnchor="end">Apr 1, 2027</text>

        {/* The yield, shaded under the line (sentence 4: "that growth is the yield"). */}
        <polygon
          points={`${LEFT},${Y_AT_100} ${linePoints(drawn)} ${tipX},${Y_AT_100}`}
          fill={COLORS.usyc}
          opacity={0.16 * area}
        />

        {/* Two other possible futures, dashed: the final index is not known today. */}
        {[1.035, 1.065].map((end) => (
          <polyline
            key={end}
            points={linePoints(1, end)}
            fill="none"
            stroke={COLORS.faint}
            strokeWidth={3}
            strokeDasharray="10 12"
            opacity={0.8 * unknown}
          />
        ))}
        <text x={RIGHT + 24} y={yOf(1.065) + 10} fill={COLORS.faint} fontSize={34} opacity={unknown}>?</text>
        <text x={RIGHT + 24} y={yOf(1.035) + 10} fill={COLORS.faint} fontSize={34} opacity={unknown}>?</text>

        <polyline points={linePoints(drawn)} fill="none" stroke={COLORS.usyc} strokeWidth={6} strokeLinejoin="round" />
      </svg>

      {/* The USYC coin rides on the tip of the line with its live price. */}
      <div
        style={{
          position: 'absolute',
          left: tipX - 45,
          top: tipY - 45,
          opacity: enter(frame, cue(1)),
        }}
      >
        <Coin kind="USYC" size={90} />
        <div style={{ position: 'absolute', left: 104, top: 20, fontSize: 40, fontWeight: 700, whiteSpace: 'nowrap' }}>
          ${indexAt(t).toFixed(4)}
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 980,
          top: 700,
          fontSize: 40,
          fontWeight: 700,
          color: COLORS.usyc,
          ...fadeUp(area),
        }}
      >
        +5% = the yield
      </div>
    </AbsoluteFill>
  )
}
