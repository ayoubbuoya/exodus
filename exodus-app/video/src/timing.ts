/**
 * How long each scene lasts, and when each of its sentences is spoken.
 *
 * Why: the pictures must move WITH the voice. `scripts/voice.ts` saves, for
 * every scene, the audio length and the start time of each sentence in
 * `public/voice/manifest.json`. Here we turn those seconds into frames.
 *
 * Example: in the "fixed" scene the 5th sentence ("That gap is her fixed
 * rate…") starts at 9.8 s of its audio. The audio starts LEAD_SECONDS (0.5 s)
 * into the scene, so `cue(4)` = (0.5 + 9.8) × 30 fps = frame 309. The scene
 * shows the big "5.10 %" at that frame.
 */
import manifest from '../public/voice/manifest.json'
import { SCENES } from './script.ts'
import { FPS } from './theme.ts'

/** Silence before the voice starts in each scene (lets the scene fade in first). */
export const LEAD_SECONDS = 0.5
/** Silence after the voice ends (the next scene fades in over it). */
export const TAIL_SECONDS = 1.0
/** Length of the cross-fade between two scenes. Shorter than the tail, so two voices never overlap. */
export const TRANSITION_FRAMES = 15

/** Some scenes need more time than their narration (for example the app clips). */
const MIN_SECONDS: Record<string, number> = {
  intro: 11,
  outro: 11,
}

export type Caption = { text: string; startSeconds: number; endSeconds: number }

export type SceneTiming = {
  id: string
  /** The scene's audio, relative to `public/`. */
  audioFile: string
  durationInFrames: number
  captions: Caption[]
  /** The frame (inside the scene) where sentence `index` starts, plus an optional delay in seconds. */
  cue: (index: number, delaySeconds?: number) => number
  /** The frame where the voice of this scene ends. */
  voiceEnd: number
}

type VoiceScene = { file: string; durationSeconds: number; captions: Caption[] }
const voiceScenes = manifest.scenes as Record<string, VoiceScene | undefined>

/** Timing of one scene, from the voice manifest. Throws if the voice was not generated yet. */
export function sceneTiming(id: string): SceneTiming {
  const voice = voiceScenes[id]
  if (voice === undefined) {
    throw new Error(`No voice for scene "${id}": run \`npm run voice -w @exodus/video\` first.`)
  }
  const seconds = Math.max(LEAD_SECONDS + voice.durationSeconds + TAIL_SECONDS, MIN_SECONDS[id] ?? 0)
  const cue = (index: number, delaySeconds = 0) => {
    const caption = voice.captions[Math.min(index, voice.captions.length - 1)]
    return Math.round((LEAD_SECONDS + caption.startSeconds + delaySeconds) * FPS)
  }
  return {
    id,
    audioFile: voice.file,
    durationInFrames: Math.ceil(seconds * FPS),
    captions: voice.captions,
    cue,
    voiceEnd: Math.round((LEAD_SECONDS + voice.durationSeconds) * FPS),
  }
}

/** All scenes in script order. */
export const TIMINGS: SceneTiming[] = SCENES.map((scene) => sceneTiming(scene.id))

/**
 * The whole video's length. Each cross-fade overlaps two scenes, so it takes
 * TRANSITION_FRAMES off the total. Example: 13 scenes → 12 fades → 180 frames (6 s) shorter.
 */
export const TOTAL_FRAMES =
  TIMINGS.reduce((sum, timing) => sum + timing.durationInFrames, 0) - (TIMINGS.length - 1) * TRANSITION_FRAMES
