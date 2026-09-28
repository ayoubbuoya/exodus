/**
 * The list of videos this project can render (Remotion "compositions").
 * There is one: the ~3.5-minute explainer for the HackCanton S3 judges,
 * 1920 × 1080 at 30 fps.
 */
import { Composition, continueRender, delayRender } from 'remotion'
import { ExodusExplainer } from './Video.tsx'
import { FPS, HEIGHT, WIDTH } from './theme.ts'
import { TOTAL_FRAMES } from './timing.ts'

// Wait for both fonts before any frame is captured. The @fontsource CSS only
// downloads a font when text first uses it, so without this the first frames
// (or the first monospace text) could render in a fallback font.
const fontsHandle = delayRender('Loading Inter and Geist Mono')
Promise.all([
  document.fonts.load('700 40px "Inter Variable"'),
  document.fonts.load('400 40px "Inter Variable"'),
  document.fonts.load('400 40px "Geist Mono Variable"'),
]).then(() => continueRender(fontsHandle))

export function Root() {
  return (
    <Composition
      id="ExodusExplainer"
      component={ExodusExplainer}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  )
}
