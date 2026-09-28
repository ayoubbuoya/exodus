/**
 * The whole explainer: the moving background, then every scene in script
 * order with a short cross-fade between them.
 *
 * Each scene is as long as its narration (see timing.ts), so changing a
 * sentence in script.ts and re-running `npm run voice` re-times the video
 * by itself.
 */
import { linearTiming, TransitionSeries } from '@remotion/transitions'
import { fade } from '@remotion/transitions/fade'
import { Fragment, type ComponentType } from 'react'
import { AbsoluteFill } from 'remotion'
import { Background } from './components/Background.tsx'
import { Scene } from './components/Scene.tsx'
import { App } from './scenes/App.tsx'
import { Canton } from './scenes/Canton.tsx'
import { Dvp } from './scenes/Dvp.tsx'
import { Fixed } from './scenes/Fixed.tsx'
import { Intro } from './scenes/Intro.tsx'
import { Maturity } from './scenes/Maturity.tsx'
import { Outro } from './scenes/Outro.tsx'
import { Problem } from './scenes/Problem.tsx'
import { Rfq } from './scenes/Rfq.tsx'
import { Split } from './scenes/Split.tsx'
import { Stack } from './scenes/Stack.tsx'
import { Usyc } from './scenes/Usyc.tsx'
import { Yield } from './scenes/Yield.tsx'
import { TIMINGS, TRANSITION_FRAMES } from './timing.ts'

/** Which picture goes with which part of the script (ids from script.ts). */
const PICTURES: Record<string, ComponentType> = {
  intro: Intro,
  problem: Problem,
  usyc: Usyc,
  split: Split,
  fixed: Fixed,
  rfq: Rfq,
  dvp: Dvp,
  yield: Yield,
  maturity: Maturity,
  canton: Canton,
  stack: Stack,
  app: App,
  outro: Outro,
}

export function ExodusExplainer() {
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        {TIMINGS.map((timing, i) => {
          const Picture = PICTURES[timing.id]
          if (Picture === undefined) throw new Error(`No picture for scene "${timing.id}" in Video.tsx`)
          return (
            <Fragment key={timing.id}>
              {i > 0 && (
                <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
              )}
              <TransitionSeries.Sequence durationInFrames={timing.durationInFrames}>
                <Scene timing={timing}>
                  <Picture />
                </Scene>
              </TransitionSeries.Sequence>
            </Fragment>
          )
        })}
      </TransitionSeries>
    </AbsoluteFill>
  )
}
