import assert from 'node:assert/strict'
import { test } from 'node:test'
import { captionsFromAlignment, spokenScene, type Alignment } from './voice-timing.ts'

// Builds a fake alignment where character i starts at i × 0.1 s and lasts 0.1 s.
function fakeAlignment(spoken: string): Alignment {
  const characters = [...spoken]
  return {
    characters,
    character_start_times_seconds: characters.map((_, i) => i * 0.1),
    character_end_times_seconds: characters.map((_, i) => (i + 1) * 0.1),
  }
}

test('spokenScene spells USYC but keeps the sentences apart', () => {
  assert.equal(spokenScene('Buy USYC. It grows.'), 'Buy U.S.Y.C. It grows.')
})

test('captions keep the written text and use the spoken timings', () => {
  const text = 'Buy USYC. It grows.'
  const captions = captionsFromAlignment(text, fakeAlignment(spokenScene(text)))

  // "Buy U.S.Y.C." is 12 characters: 0.0 s → 1.2 s. Then a space, then
  // "It grows." (9 characters) from character 13: 1.3 s → 2.2 s.
  assert.equal(captions.length, 2)
  assert.equal(captions[0].text, 'Buy USYC.')
  assert.equal(captions[0].startSeconds, 0)
  assert.ok(Math.abs(captions[0].endSeconds - 1.2) < 1e-9)
  assert.equal(captions[1].text, 'It grows.')
  assert.ok(Math.abs(captions[1].startSeconds - 1.3) < 1e-9)
  assert.ok(Math.abs(captions[1].endSeconds - 2.2) < 1e-9)
})

test('numbers with a decimal point stay in one sentence', () => {
  const text = 'It grew to 1.025 today. Done.'
  const captions = captionsFromAlignment(text, fakeAlignment(spokenScene(text)))
  assert.deepEqual(
    captions.map((caption) => caption.text),
    ['It grew to 1.025 today.', 'Done.'],
  )
})
