/**
 * Video size, speed and colours.
 *
 * The colours are the app's dark "Glacier" theme (exodus-app/web/src/styles/tokens.css),
 * so the video looks like the product the judges will open:
 * silver = principal (PT), electric blue = yield (YT).
 */
import '@fontsource-variable/inter/opsz.css'
import '@fontsource-variable/geist-mono'

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

export const COLORS = {
  /** Page background (bg-0) and the raised surfaces on top of it. */
  bg: '#060a13',
  surface: '#0b1220',
  panel: '#111a2b',
  line: '#1a2438',
  lineStrong: '#2a3856',
  /** Text: main, secondary, labels. */
  text: '#e6ecf5',
  muted: '#9aa8bf',
  faint: '#7887a0',
  /** Token colours. PT and YT are the app's; USYC and USDC get their own so they never look like PT/YT. */
  pt: '#e6ecf5',
  yt: '#4d8dff',
  usyc: '#a99bff',
  usdc: '#6fd6a0',
  /** Status colours. */
  success: '#6fd6a0',
  danger: '#ff7a6b',
  warning: '#f0c75e',
}

export const FONT = '"Inter Variable", "Helvetica Neue", Arial, sans-serif'
export const MONO = '"Geist Mono Variable", ui-monospace, Menlo, monospace'

/** The frosted-glass panel used for every card (same idea as the app's glass surfaces). */
export const GLASS = {
  background: 'linear-gradient(160deg, rgba(30, 44, 72, 0.72), rgba(11, 18, 32, 0.78))',
  border: `1px solid ${'rgba(154, 168, 191, 0.22)'}`,
  boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 30px 60px -30px rgba(0, 0, 0, 0.8)',
  borderRadius: 28,
} as const
