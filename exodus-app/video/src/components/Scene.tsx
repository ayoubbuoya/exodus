/**
 * The frame around every scene: plays the scene's voice, shows the captions,
 * and gives the scene its timing (`useScene`).
 *
 * Why captions: judges often watch with the sound off, and the numbers
 * ("487.75 USDC") are easier to follow when they are also written.
 */
import { Audio } from '@remotion/media'
import { createContext, useContext, type ReactNode } from 'react'
import { AbsoluteFill, Sequence, staticFile, useCurrentFrame } from 'remotion'
import { between } from '../anim.ts'
import { COLORS, FONT, FPS } from '../theme.ts'
import { LEAD_SECONDS, type SceneTiming } from '../timing.ts'

const SceneContext = createContext<SceneTiming | null>(null)

/** The timing of the scene we are inside: `cue(i)` is the frame where sentence i starts. */
export function useScene(): SceneTiming {
  const timing = useContext(SceneContext)
  if (timing === null) throw new Error('useScene() must be used inside <Scene>')
  return timing
}

/** The caption bar: shows the sentence the voice is saying right now. */
function Captions({ timing }: { timing: SceneTiming }) {
  const frame = useCurrentFrame()
  const seconds = frame / FPS - LEAD_SECONDS
  // The current sentence is the last one that has started. Between two
  // sentences we keep the previous one on screen, so the bar does not flicker.
  let index = -1
  timing.captions.forEach((caption, i) => {
    if (seconds >= caption.startSeconds - 0.05) index = i
  })
  if (index === -1) return null
  const caption = timing.captions[index]
  const startFrame = Math.round((LEAD_SECONDS + caption.startSeconds) * FPS)
  const opacity = between(frame, startFrame - 4, startFrame + 4)
  // Hide the bar once the voice has ended.
  const endOpacity = 1 - between(frame, timing.voiceEnd + 6, timing.voiceEnd + 14)

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 56,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: Math.min(opacity, endOpacity),
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          padding: '14px 28px',
          borderRadius: 18,
          background: 'rgba(6, 10, 19, 0.72)',
          border: '1px solid rgba(154, 168, 191, 0.16)',
          color: COLORS.text,
          fontFamily: FONT,
          fontSize: 34,
          lineHeight: 1.35,
          textAlign: 'center',
        }}
      >
        {caption.text}
      </div>
    </div>
  )
}

export function Scene({ timing, children }: { timing: SceneTiming; children: ReactNode }) {
  return (
    <SceneContext.Provider value={timing}>
      <AbsoluteFill style={{ fontFamily: FONT, color: COLORS.text }}>
        {children}
        <Captions timing={timing} />
        {/* The voice starts LEAD_SECONDS after the scene, once the fade-in is done. */}
        <Sequence from={Math.round(LEAD_SECONDS * FPS)} layout="none">
          <Audio src={staticFile(timing.audioFile)} />
        </Sequence>
      </AbsoluteFill>
    </SceneContext.Provider>
  )
}
