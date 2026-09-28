/**
 * Generates the voice-over with ElevenLabs: one MP3 per scene of
 * `src/script.ts`, plus `public/voice/manifest.json` with each scene's length
 * and caption times. The video reads the manifest to size every scene to its
 * narration, so the pictures and the voice stay in sync.
 *
 * Run: `npm run voice -w @exodus/video` (reads ELEVENLABS_API_KEY from video/.env).
 *   --force     re-generate every scene, even if its text did not change
 *   --dry-run   only print what would be generated and how many characters it costs
 *
 * Why the cache: the free ElevenLabs plan gives 10,000 characters a month and
 * the whole script is about 2,900. Each scene stores a hash of its spoken text
 * and voice settings, so only the scenes you edited are sent again.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { SCENES } from '../src/script.ts'
import { captionsFromAlignment, spokenScene, type Alignment, type Caption } from './voice-timing.ts'

// "Eric - Smooth, Trustworthy" (American, middle-aged): calm enough for a
// financial product, clear at 1.0× speed. Change it here to try another voice.
const VOICE_ID = 'cjVigY5qzO86Huf0OWal'
// Multilingual v2: ElevenLabs' most natural long-form model (1 credit per character).
const MODEL_ID = 'eleven_multilingual_v2'
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true, speed: 1.0 }

const OUT_DIR = new URL('../public/voice/', import.meta.url)
const MANIFEST = new URL('manifest.json', OUT_DIR)

/** What the video needs to know about one scene's audio. */
type SceneVoice = {
  hash: string
  file: string
  durationSeconds: number
  captions: Caption[]
}

type Manifest = { voiceId: string; modelId: string; scenes: Record<string, SceneVoice> }

const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const apiKey = process.env.ELEVENLABS_API_KEY
if (apiKey === undefined && !dryRun) {
  throw new Error('ELEVENLABS_API_KEY is missing: put it in exodus-app/video/.env (never commit it).')
}

mkdirSync(OUT_DIR, { recursive: true })
const manifest: Manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { voiceId: VOICE_ID, modelId: MODEL_ID, scenes: {} }
manifest.voiceId = VOICE_ID
manifest.modelId = MODEL_ID

let charactersUsed = 0
for (const scene of SCENES) {
  const spoken = spokenScene(scene.text)
  // The hash covers everything that changes the audio, so a new voice or new
  // settings also trigger a re-generation.
  const hash = createHash('sha256')
    .update(JSON.stringify({ spoken, VOICE_ID, MODEL_ID, VOICE_SETTINGS }))
    .digest('hex')
    .slice(0, 16)
  const file = `voice/${scene.id}.mp3`
  const cached = manifest.scenes[scene.id]
  if (!force && cached?.hash === hash && existsSync(new URL(`${scene.id}.mp3`, OUT_DIR))) {
    console.log(`= ${scene.id}: unchanged`)
    continue
  }

  console.log(`+ ${scene.id}: ${spoken.length} characters`)
  charactersUsed += spoken.length
  if (dryRun) continue

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey as string, 'content-type': 'application/json' },
      body: JSON.stringify({ text: spoken, model_id: MODEL_ID, voice_settings: VOICE_SETTINGS }),
    },
  )
  if (!response.ok) {
    throw new Error(`ElevenLabs failed for "${scene.id}": ${response.status} ${await response.text()}`)
  }
  const body = (await response.json()) as { audio_base64: string; alignment: Alignment }

  writeFileSync(new URL(`${scene.id}.mp3`, OUT_DIR), Buffer.from(body.audio_base64, 'base64'))
  const captions = captionsFromAlignment(scene.text, body.alignment)
  const ends = body.alignment.character_end_times_seconds
  manifest.scenes[scene.id] = { hash, file, durationSeconds: ends[ends.length - 1], captions }
  // Save after each scene, so a failure halfway keeps what we already paid for.
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
}

const total = SCENES.reduce((sum, scene) => sum + (manifest.scenes[scene.id]?.durationSeconds ?? 0), 0)
console.log(`${dryRun ? 'Would use' : 'Used'} ${charactersUsed} characters. Narration: ${total.toFixed(1)} s.`)
