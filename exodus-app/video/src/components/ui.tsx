/**
 * The building blocks the scenes are drawn with: glass cards, token coins,
 * people ("parties"), titles and chips.
 *
 * Why one visual language: the viewer learns once that a silver coin is PT,
 * a blue coin is YT, a violet coin is USYC and a green coin is USDC, and then
 * every scene reads at a glance (this is what Pendle's videos do well).
 */
import type { CSSProperties, ReactNode } from 'react'
import { COLORS, FONT, GLASS, MONO } from '../theme.ts'

/** A frosted-glass card. */
export function Glass({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return <div style={{ ...GLASS, padding: 32, ...style }}>{children}</div>
}

/** The four tokens of the story and their colours. */
export type TokenKind = 'PT' | 'YT' | 'USYC' | 'USDC'

const TOKEN_COLOR: Record<TokenKind, string> = {
  PT: COLORS.pt,
  YT: COLORS.yt,
  USYC: COLORS.usyc,
  USDC: COLORS.usdc,
}

export function tokenColor(kind: TokenKind): string {
  return TOKEN_COLOR[kind]
}

/**
 * A token drawn as a glossy coin with its ticker in the middle.
 * Example: <Coin kind="PT" size={120} /> is a silver coin that says "PT".
 */
export function Coin({ kind, size = 120, style }: { kind: TokenKind; size?: number; style?: CSSProperties }) {
  const color = TOKEN_COLOR[kind]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // Light from the top left, the token's colour as a rim and a soft glow.
        // The last layer is a solid colour, so lines behind the coin never show through.
        background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.35), ${color}33 45%, ${COLORS.surface} 100%), ${COLORS.surface}`,
        border: `${Math.max(2, size / 30)}px solid ${color}`,
        boxShadow: `0 0 ${size / 2.5}px ${color}40, inset 0 ${size / 20}px ${size / 10}px rgba(255,255,255,0.12)`,
        color,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size * (kind.length > 2 ? 0.22 : 0.34),
        letterSpacing: '0.02em',
        ...style,
      }}
    >
      {kind}
    </div>
  )
}

/** A coin with an amount under it, e.g. "1,000 PT". */
export function TokenAmount({
  kind,
  amount,
  size = 120,
  caption,
  style,
}: {
  kind: TokenKind
  amount: string
  size?: number
  caption?: string
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, ...style }}>
      <Coin kind={kind} size={size} />
      <div style={{ fontSize: size * 0.3, fontWeight: 700, color: COLORS.text, whiteSpace: 'nowrap' }}>
        {amount} <span style={{ color: TOKEN_COLOR[kind] }}>{kind}</span>
      </div>
      {caption !== undefined && <div style={{ fontSize: 24, color: COLORS.muted }}>{caption}</div>}
    </div>
  )
}

/**
 * A person or institution on the ledger (a Canton "party"): a round avatar
 * with an initial, a name and a role.
 */
export function Party({
  name,
  role,
  color = COLORS.text,
  size = 110,
  style,
}: {
  name: string
  role: string
  color?: string
  size?: number
  style?: CSSProperties
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, ...style }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(160deg, ${COLORS.panel}, ${COLORS.surface})`,
          border: `3px solid ${color}`,
          boxShadow: `0 0 40px ${color}33`,
          fontSize: size * 0.42,
          fontWeight: 700,
          color,
        }}
      >
        {name[0]}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>{name}</div>
      <div style={{ fontSize: 22, color: COLORS.muted, marginTop: -8 }}>{role}</div>
    </div>
  )
}

/** The small label above a scene title, e.g. "STEP 2 · SPLIT". */
export function Kicker({ children, color = COLORS.yt }: { children: ReactNode; color?: string }) {
  return (
    <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color }}>
      {children}
    </div>
  )
}

/** The title block in the top left of a scene. */
export function SceneTitle({ kicker, title, style }: { kicker: string; title: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ position: 'absolute', left: 120, top: 90, ...style }}>
      <Kicker>{kicker}</Kicker>
      <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 12, lineHeight: 1.1 }}>
        {title}
      </div>
    </div>
  )
}

/** A rounded label, e.g. "Simulated tokens". */
export function Chip({ children, color = COLORS.muted, style }: { children: ReactNode; color?: string; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 22px',
        borderRadius: 999,
        border: `1.5px solid ${color}66`,
        background: `${color}14`,
        color,
        fontSize: 26,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** Monospace text, for ledger-looking things (wallet addresses, contract names). */
export function Mono({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span style={{ fontFamily: MONO, ...style }}>{children}</span>
}

/**
 * The Exodus mark (same paths as web/src/components/brand/Mark.tsx): a silver
 * block (principal) with a blue glass wedge (yield) seated in it.
 * `wedgeOffset` pushes the wedge out to the right, to show "yield comes out".
 */
export function Mark({ height = 120, wedgeOffset = 0, blockOpacity = 1, wedgeOpacity = 1 }: {
  height?: number
  wedgeOffset?: number
  blockOpacity?: number
  wedgeOpacity?: number
}) {
  return (
    <svg viewBox="-2 -2 62 49" height={height} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="mark-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#C9D2DF" />
          <stop offset="1" stopColor="#8F9BAE" />
        </linearGradient>
        <linearGradient id="mark-glass" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#A6CAFF" />
          <stop offset="0.45" stopColor="#4D8DFF" />
          <stop offset="1" stopColor="#1A4FE0" />
        </linearGradient>
      </defs>
      <path
        opacity={blockOpacity}
        fill="url(#mark-silver)"
        d="M8.33 0H36.67Q45 0 45 8.33V9.33Q45 10.33 44.08 10.83L22.5 22.42Q20.83 23.33 22.5 24.25L44.08 35.83Q45 36.33 45 37.33V38.33Q45 45 38.33 45H8.33Q0 45 0 36.67V8.33Q0 0 8.33 0Z"
      />
      <path
        opacity={wedgeOpacity}
        transform={`translate(${wedgeOffset} 0)`}
        fill="url(#mark-glass)"
        d="M27.67 22.33L55 7.25Q57.5 5.83 57.5 8.75V37.92Q57.5 40.83 55 39.42L27.67 24.33Q25.83 23.33 27.67 22.33Z"
      />
    </svg>
  )
}

/**
 * A straight arrow drawn from (x1, y1) to (x2, y2) in a full-screen SVG.
 * `progress` (0 → 1) draws it from its start, so arrows "grow" on screen.
 */
export function Arrow({
  x1,
  y1,
  x2,
  y2,
  progress,
  color = COLORS.muted,
  dashed = false,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  progress: number
  color?: string
  dashed?: boolean
}) {
  const x = x1 + (x2 - x1) * progress
  const y = y1 + (y2 - y1) * progress
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 16
  return (
    <svg width={1920} height={1080} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
      <line
        x1={x1}
        y1={y1}
        x2={x}
        y2={y}
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={dashed ? '12 12' : undefined}
        opacity={progress > 0 ? 1 : 0}
      />
      {progress > 0.05 && (
        <polygon
          fill={color}
          points={`${x},${y} ${x - head * Math.cos(angle - 0.45)},${y - head * Math.sin(angle - 0.45)} ${x - head * Math.cos(angle + 0.45)},${y - head * Math.sin(angle + 0.45)}`}
        />
      )}
    </svg>
  )
}
