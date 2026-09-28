/**
 * Scene 12 · The real app: a browser window walks through the four steps a
 * client takes (open the market → firm quote → accept → portfolio).
 *
 * For now each step is a simplified drawing of the real screen, with the
 * real values of the demo stack. When fresh screen recordings exist
 * (docs/demo/record-demo.mjs), they can replace these drawings.
 */
import { CheckIcon, LockIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AbsoluteFill, useCurrentFrame } from 'remotion'
import { between, enter, fadeUp } from '../anim.ts'
import { useScene } from '../components/Scene.tsx'
import { Chip, Coin, Mono, SceneTitle } from '../components/ui.tsx'
import { COLORS } from '../theme.ts'

/** A label and a value, stacked (the app's "stat" look). */
function Stat({ label, value, color = COLORS.text }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 22, color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: 40, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  )
}

/** A button as it looks in the app; `pressed` (0 → 1) makes it glow as if clicked. */
function Button({ children, pressed }: { children: ReactNode; pressed: number }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 30px',
        borderRadius: 14,
        background: COLORS.text,
        color: COLORS.bg,
        fontSize: 28,
        fontWeight: 700,
        transform: `scale(${1 - 0.05 * Math.sin(pressed * Math.PI)})`,
        boxShadow: `0 0 ${40 * pressed}px ${COLORS.yt}`,
      }}
    >
      {children}
    </div>
  )
}

/** Step 1: the market card on /markets. `pressAt` is when "Open market" is clicked. */
function MarketScreen({ frame, pressAt }: { frame: number; pressAt: number }) {
  return (
    <div style={{ padding: 48 }}>
      <div style={{ fontSize: 26, color: COLORS.muted }}>Markets</div>
      <div style={{ marginTop: 20, padding: 36, borderRadius: 24, border: `1px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Coin kind="PT" size={70} />
          <div>
            <div style={{ fontSize: 38, fontWeight: 700 }}>PT-USYC-APR2027</div>
            <div style={{ fontSize: 24, color: COLORS.muted }}>Matures Apr 1, 2027 · 182 days</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 80, marginTop: 36 }}>
          <Stat label="Fixed APY" value="5.10%" color={COLORS.success} />
          <Stat label="PT price" value="0.975503" />
          <Stat label="Underlying" value="USYC" color={COLORS.usyc} />
        </div>
        <div style={{ marginTop: 36 }}>
          <Button pressed={between(frame, pressAt, pressAt + 12)}>Open market</Button>
        </div>
      </div>
    </div>
  )
}

/** Step 2: the "Fixed Yield (PT)" tab: Alice asks (`at`), the firm quote arrives (`quoteAt`). */
function QuoteScreen({ frame, at, quoteAt }: { frame: number; at: number; quoteAt: number }) {
  const quote = enter(frame, quoteAt)
  return (
    <div style={{ padding: 48 }}>
      <div style={{ fontSize: 26, color: COLORS.muted }}>PT-USYC-APR2027 · Fixed Yield (PT)</div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 24 }}>
        <div style={{ flex: 1, padding: '22px 28px', borderRadius: 16, border: `1px solid ${COLORS.lineStrong}`, fontSize: 36 }}>
          500 <span style={{ color: COLORS.muted }}>PT</span>
        </div>
        <Button pressed={between(frame, at + 40, at + 52)}>Get firm quote</Button>
      </div>
      <div style={{ marginTop: 30, padding: 32, borderRadius: 20, border: `1px solid ${COLORS.success}66`, background: `${COLORS.success}0d`, ...fadeUp(quote) }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: COLORS.muted }}>
          <span>Firm quote from Bank</span>
          <span>
            <LockIcon size={20} /> private · valid 60 s
          </span>
        </div>
        <div style={{ display: 'flex', gap: 80, marginTop: 20 }}>
          <Stat label="Price" value="0.975503" />
          <Stat label="You pay" value="487.7515 USDC" color={COLORS.usdc} />
          <Stat label="Fixed APY" value="5.10%" color={COLORS.success} />
        </div>
      </div>
    </div>
  )
}

/** Step 3: Accept, then the success toast. */
function AcceptScreen({ frame, at }: { frame: number; at: number }) {
  const toast = enter(frame, at + 18)
  return (
    <div style={{ padding: 48 }}>
      <div style={{ fontSize: 26, color: COLORS.muted }}>PT-USYC-APR2027 · Fixed Yield (PT)</div>
      <div style={{ marginTop: 24, padding: 32, borderRadius: 20, border: `1px solid ${COLORS.success}66`, background: `${COLORS.success}0d` }}>
        <div style={{ display: 'flex', gap: 80 }}>
          <Stat label="Price" value="0.975503" />
          <Stat label="You pay" value="487.7515 USDC" color={COLORS.usdc} />
          <Stat label="You get" value="500 PT" />
        </div>
        <div style={{ marginTop: 30 }}>
          <Button pressed={between(frame, at + 2, at + 16)}>
            <CheckIcon size={28} /> Accept
          </Button>
        </div>
      </div>
      <div style={{ position: 'absolute', right: 48, bottom: 48, ...fadeUp(toast) }}>
        <Chip color={COLORS.success} style={{ fontSize: 28, padding: '16px 26px' }}>
          <CheckIcon size={28} /> Bought 500 PT for 487.7515 USDC
        </Chip>
      </div>
    </div>
  )
}

/** Step 4: the position on /portfolio. */
function PortfolioScreen() {
  return (
    <div style={{ padding: 48 }}>
      <div style={{ fontSize: 26, color: COLORS.muted }}>Portfolio</div>
      <div style={{ display: 'flex', gap: 80, marginTop: 20 }}>
        <Stat label="Value at maturity" value="$500.00" />
        <Stat label="Fixed APY" value="5.10%" color={COLORS.success} />
        <Stat label="Matures" value="Apr 1, 2027" />
      </div>
      <div style={{ marginTop: 36, display: 'flex', alignItems: 'center', gap: 24, padding: '24px 28px', borderRadius: 18, border: `1px solid ${COLORS.lineStrong}`, background: COLORS.surface }}>
        <Coin kind="PT" size={60} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 30, fontWeight: 700 }}>PT-USYC-APR2027</div>
          <div style={{ fontSize: 22, color: COLORS.muted }}>Fixed yield · redeem 1 USD of USYC per PT on Apr 1</div>
        </div>
        <div style={{ fontSize: 36, fontWeight: 700 }}>500 PT</div>
      </div>
    </div>
  )
}

export function App() {
  const frame = useCurrentFrame()
  const { cue } = useScene()

  const browser = enter(frame, cue(0))
  // Which step is on screen, following the voice:
  //   sentence 1 "On the Markets page…"        → the market card
  //   sentence 2 "She types 500 PT…"           → the quote form (the quote arrives with sentence 3)
  //   sentence 3 "…and she accepts it."        → Accept + toast, 2.4 s into the sentence
  //   sentence 4 "Her portfolio now shows…"    → the portfolio
  const acceptAt = cue(3, 2.4)
  const steps = [
    { at: cue(1), url: 'localhost:8080/markets', screen: <MarketScreen frame={frame} pressAt={cue(2) - 14} /> },
    { at: cue(2), url: 'localhost:8080/markets/PT-USYC-APR2027', screen: <QuoteScreen frame={frame} at={cue(2)} quoteAt={cue(3)} /> },
    { at: acceptAt, url: 'localhost:8080/markets/PT-USYC-APR2027', screen: <AcceptScreen frame={frame} at={acceptAt} /> },
    { at: cue(4), url: 'localhost:8080/portfolio', screen: <PortfolioScreen /> },
  ]
  let current = 0
  steps.forEach((step, i) => {
    if (frame >= step.at) current = i
  })

  return (
    <AbsoluteFill>
      <SceneTitle kicker="Try it" title="The real app, four steps" />

      {/* A browser window. */}
      <div
        style={{
          position: 'absolute',
          left: 260,
          top: 280,
          width: 1400,
          height: 600,
          borderRadius: 24,
          overflow: 'hidden',
          border: `1px solid ${COLORS.lineStrong}`,
          background: COLORS.bg,
          boxShadow: '0 40px 80px -30px rgba(0,0,0,0.9)',
          ...fadeUp(browser, 50),
        }}
      >
        <div style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 22px', background: COLORS.panel }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
            <div key={color} style={{ width: 16, height: 16, borderRadius: '50%', background: color }} />
          ))}
          <div style={{ marginLeft: 24, padding: '6px 20px', borderRadius: 10, background: COLORS.bg, fontSize: 22, color: COLORS.muted }}>
            <Mono>{steps[current].url}</Mono>
          </div>
        </div>
        {/* Each screen cross-fades in when its sentence starts. */}
        {steps.map((step, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 56,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: i === current ? between(frame, step.at, step.at + 8) : 0,
            }}
          >
            {step.screen}
          </div>
        ))}
      </div>

      {/* Step dots under the window. */}
      <div style={{ position: 'absolute', top: 905, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16, opacity: browser }}>
        {steps.map((step, i) => (
          <div key={i} style={{ width: i === current && frame >= step.at ? 40 : 14, height: 14, borderRadius: 7, background: frame >= step.at ? COLORS.yt : COLORS.lineStrong }} />
        ))}
      </div>
    </AbsoluteFill>
  )
}
