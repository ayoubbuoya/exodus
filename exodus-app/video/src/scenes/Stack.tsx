/**
 * Scene 11 · Under the hood: the three layers of the project, built from the
 * bottom up (Daml contracts → NestJS API with the bots → React app), and the
 * tests that check every payout of the story.
 */
import { CheckIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Chip, Glass, Mono, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

// The Daml templates in exodus-contract/main/daml/Exodus/, shown one by one.
const TEMPLATES = ['UsycFund', 'Market', 'PrincipalToken', 'YieldToken', 'RfqRequest', 'Quote', 'ClientAccess', 'RateIndex']

// What DemoTest.daml (spec section 9) checks. The trade price itself is the
// dealer's choice (0.975 in the test, 0.975503 from the bot), so it is not listed.
const CHECKS = [
  '1,000 USYC → 1,000 PT + 1,000 YT',
  'Bank claims 24.390243 USYC',
  'Alice redeems 476.190476 USYC',
  'Operator sees 0 quotes',
  'Total profit = the fund\'s yield',
]

/** One layer of the architecture. */
function Layer({ title, subtitle, children, progress, color }: { title: string; subtitle: string; children?: ReactNode; progress: number; color: string }) {
  return (
    <Glass style={{ padding: '24px 30px', borderLeft: `6px solid ${color}`, ...fadeUp(progress, 40) }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 24, color: COLORS.muted }}>{subtitle}</div>
      </div>
      {children}
    </Glass>
  )
}

export function Stack() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const daml = enter(frame, cue(0))
  const tests = enter(frame, cue(1))
  const api = enter(frame, cue(2))
  const web = enter(frame, cue(2, 2.5))

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Under the hood" title="Daml on Canton, end to end" />

      {/* Left: the layers, top = what users touch, bottom = the ledger. They appear bottom first. */}
      <div style={{ position: 'absolute', left: 120, top: 300, width: 1000, display: 'flex', flexDirection: 'column', gap: 22 }}>
        <Layer title="React web app" subtitle="markets · portfolio · dealer desk" progress={web} color={COLORS.text} />
        <Layer title="NestJS API" subtitle="JSON Ledger API v2 client" progress={api} color={COLORS.yt}>
          <div style={{ display: 'flex', gap: 14, marginTop: 16 }}>
            <Chip color={COLORS.yt}>Operator bot · matures + pays</Chip>
            <Chip color={COLORS.yt}>Dealer bot · quotes in 2 s</Chip>
          </div>
        </Layer>
        <Layer title="Canton ledger" subtitle="Daml smart contracts" progress={daml} color={COLORS.usyc}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {TEMPLATES.map((name, i) => (
              <div key={name} style={fadeUp(enter(frame, cue(0, 0.6) + i * 5), 12)}>
                <Chip color={COLORS.usyc} style={{ fontSize: 24, padding: '8px 18px' }}>
                  <Mono>{name}</Mono>
                </Chip>
              </div>
            ))}
          </div>
        </Layer>
      </div>

      {/* Right: rounding and the checked numbers. */}
      <div style={{ position: 'absolute', left: 1200, top: 300, width: 600, ...fadeUp(tests, 40) }}>
        <Glass>
          <div style={{ fontSize: 26, color: COLORS.muted }}>Every payout uses</div>
          <div style={{ fontSize: 40, fontWeight: 700, marginTop: 4 }}>
            <Mono>roundDown6</Mono>
          </div>
          <div style={{ fontSize: 26, color: COLORS.muted, marginTop: 4 }}>so the vault can never go negative</div>
          <div style={{ height: 1, background: COLORS.line, margin: '26px 0' }} />
          <div style={{ fontSize: 26, color: COLORS.muted, marginBottom: 14 }}>Daml tests check, to 6 decimals:</div>
          {CHECKS.map((check, i) => (
            <div key={check} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 27, marginTop: 10, ...fadeUp(enter(frame, cue(1, 2) + i * 8), 10) }}>
              <CheckIcon size={28} color={COLORS.success} /> {check}
            </div>
          ))}
        </Glass>
      </div>
    </AbsoluteFill>
  )
}
