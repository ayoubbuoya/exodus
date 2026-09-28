# @exodus/video: the explainer video

A ~3:40 explainer of Exodus for the HackCanton Season 3 judges, in the style of Pendle's
explainers: flat 2D motion graphics, one idea per scene, a voice-over and captions.
Everything is code, so the video can be re-rendered after any change.

- **[Remotion](https://www.remotion.dev)** draws each scene as a React component (`src/scenes/`).
- **[ElevenLabs](https://elevenlabs.io)** reads the narration in `src/script.ts` (voice "Eric").
- Each scene lasts as long as its narration, and its animations start on the sentence
  that talks about them (`cue(i)` in `src/timing.ts`).

"USYC" and "USDC" in the video are simulated test tokens issued by our demo parties, not by Circle
(the intro says so).

## Commands (from `exodus-app/`)

```bash
npm run video:studio   # live preview in the browser (Remotion Studio), scrub through every scene
npm run video:render   # render video/out/exodus-explainer.mp4 (1920 × 1080, 30 fps, H.264)
npm run video:voice    # re-generate the voice for the scenes whose text changed (needs video/.env)
npm test -w @exodus/video   # unit tests for the caption timing
```

## Changing the words

1. Edit the scene's `text` in `src/script.ts` (keep the numbers the same as `docs/demo/script.md`).
2. Put your ElevenLabs key in `video/.env` (git-ignored): `ELEVENLABS_API_KEY=sk_...`
3. `npm run video:voice`: only the changed scenes are sent (the free plan has 10,000 characters
   a month; the whole script is about 3,000). `--dry-run` prints the cost first, `--force` redoes all.
4. The generated `public/voice/` (MP3s + `manifest.json`) and the rendered `out/` are git-ignored, like every
   audio/video file in the repo. On a fresh clone, run `npm run video:voice` once (about 3,000 characters)
   before `video:studio` or `video:render`.

If a word is read wrongly, add it to `PRONUNCIATION` in `src/script.ts` (for example `USYC` →
`U.S.Y.C.`). Captions keep the written word.

## Files

| Path | What |
|---|---|
| `src/script.ts` | The narration, one entry per scene, and the pronunciation fixes |
| `scripts/voice.ts` | Calls ElevenLabs, saves `public/voice/<scene>.mp3` + `manifest.json` (length and sentence times) |
| `src/timing.ts` | Turns the manifest into frames: scene lengths and `cue(i)` |
| `src/Video.tsx` | The scene order and the cross-fades |
| `src/components/` | Background, the scene frame (voice + captions), shared pieces (coins, parties, cards) |
| `src/scenes/` | The 13 scenes: intro, problem, USYC, split, fixed yield, RFQ, DvP, YT yield, maturity, why Canton, stack, app, outro |

## Licence note

Remotion is free for individuals and companies of up to 3 people; bigger companies need a
[company licence](https://www.remotion.dev/license). The ElevenLabs free plan asks for attribution
and does not allow commercial use: fine for a hackathon video, check the plan before any other use.
