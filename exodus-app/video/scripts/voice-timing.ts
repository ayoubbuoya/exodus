/**
 * Pure helpers for the voice-over: turn ElevenLabs' per-character timings
 * into one start/end time per caption sentence.
 *
 * Why: ElevenLabs' "with-timestamps" endpoint tells us when each CHARACTER of
 * the spoken text starts and ends. The video shows one sentence at a time, so
 * we need the time of each SENTENCE. Kept pure (no network, no files) so
 * `voice-timing.test.ts` can check it.
 */
import { sentencesOf, spokenText } from '../src/script.ts'

/** The `alignment` object that ElevenLabs returns (one entry per character). */
export type Alignment = {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

/** One caption: the WRITTEN sentence and when the voice says it. */
export type Caption = {
  text: string
  startSeconds: number
  endSeconds: number
}

/**
 * The exact text we send to ElevenLabs for a scene: each written sentence with
 * its pronunciation fixes, joined by one space.
 *
 * We build it sentence by sentence (instead of fixing the whole text at once)
 * so we know where each sentence starts in the spoken text. We cannot split
 * the spoken text itself: "U.S.Y.C. and" would look like two sentences.
 */
export function spokenSentences(text: string): Array<{ written: string; spoken: string }> {
  return sentencesOf(text).map((written) => ({ written, spoken: spokenText(written) }))
}

/** The full spoken text of a scene (what we send to ElevenLabs). */
export function spokenScene(text: string): string {
  return spokenSentences(text)
    .map((sentence) => sentence.spoken)
    .join(' ')
}

/**
 * Finds when each sentence is said.
 *
 * Example: the spoken text "Hi. Go now." has sentences at characters 0–2 and
 * 4–10. If character 0 starts at 0.10 s and character 10 ends at 1.60 s, the
 * captions are "Hi." from 0.10 s and "Go now." until 1.60 s.
 */
export function captionsFromAlignment(text: string, alignment: Alignment): Caption[] {
  const starts = alignment.character_start_times_seconds
  const ends = alignment.character_end_times_seconds
  const lastIndex = starts.length - 1
  const captions: Caption[] = []

  // `offset` is where the current sentence starts in the spoken text.
  let offset = 0
  for (const sentence of spokenSentences(text)) {
    const first = Math.min(offset, lastIndex)
    const last = Math.min(offset + sentence.spoken.length - 1, lastIndex)
    captions.push({ text: sentence.written, startSeconds: starts[first], endSeconds: ends[last] })
    // +1 for the space that joins two sentences in `spokenScene`.
    offset += sentence.spoken.length + 1
  }
  return captions
}
