/**
 * The narration of the explainer video, one entry per scene.
 *
 * Why this file exists: it is the single source of truth for what the voice
 * says. Two programs read it:
 * - `scripts/voice.ts` (Node) sends each `text` to ElevenLabs and saves one
 *   audio file per scene, plus the time of every sentence.
 * - the Remotion video (`src/`) uses the same ids to find each scene's audio
 *   and to show the matching captions.
 *
 * The video is for the HackCanton Season 3 judges, so it explains the product
 * AND why Canton matters, in under 4 minutes (about 2,900 characters of speech).
 *
 * Every number comes from the demo story (docs/demo/script.md and spec
 * section 9), which the Daml tests check to 6 decimals:
 * - Alice buys 500 PT at 0.975503 → pays 487.7515 USDC (5.10 % fixed a year).
 * - Bank's YT earns 1000 × (1/1.00 − 1/1.025) = 24.390243 USYC by Jan 1.
 * - At maturity Alice redeems 500 / 1.05 = 476.190476 USYC (= 500 USD).
 *
 * Budget: the ElevenLabs free tier gives 10,000 characters a month.
 * `voice.ts` only re-generates the scenes whose text changed, so editing one
 * sentence costs one scene, not the whole script.
 *
 * Keep this file free of imports: Node runs it directly (type stripping).
 */

/** One scene of narration. */
export type SceneScript = {
  /** Stable id: the audio file is `public/voice/<id>.mp3`. */
  id: string
  /** What the voice says, written the way it should be read on screen (captions). */
  text: string
}

export const SCENES: SceneScript[] = [
  {
    id: 'intro',
    text: 'This is Exodus: private, fixed-rate yield markets on Canton. The USYC and USDC in this video are simulated test tokens, issued by our own demo parties.',
  },
  {
    id: 'problem',
    text: 'Institutions hold tokenized Treasury funds like USYC, and the yield floats with interest rates. A treasury desk wants a fixed, known return. A trading desk wants to bet on rates. Pendle solved this on Ethereum, but there every trade is public: the price, the size and the wallet. Institutions cannot trade like that.',
  },
  {
    id: 'usyc',
    text: 'Start with USYC, a token that grows. On October first, one USYC is worth one dollar. On April first, it is worth one dollar and five cents. That growth is the yield, and nobody knows it in advance.',
  },
  {
    id: 'split',
    text: 'Exodus splits it in two, like Pendle. Deposit one thousand USYC and you get one thousand PT and one thousand YT. PT, the principal token, pays one dollar at maturity. YT, the yield token, collects all the floating yield until then.',
  },
  {
    id: 'fixed',
    text: 'Why buy PT? Because it trades below one dollar. Alice pays about ninety-seven and a half cents for each PT. At maturity, each one pays a full dollar. That gap is her fixed rate: 5.1 percent a year, locked in today, whatever rates do next.',
  },
  {
    id: 'rfq',
    text: 'There is no public pool. Alice asks one dealer for a private quote for 500 PT. The dealer answers in two seconds with a firm price, valid for one minute, and locks its PT so they cannot be sold twice. Only Alice and the dealer see that price. The market operator signs every PT, yet it sees zero quotes.',
  },
  {
    id: 'dvp',
    text: 'Alice accepts. Her 487.75 USDC and the 500 PT swap in one atomic Canton transaction. Both legs settle, or nothing does. No settlement risk, and nothing to reconcile.',
  },
  {
    id: 'yield',
    text: 'Three months later, the fund has grown from 1.00 to 1.025. The dealer holds the YT, so it claims 24.39 USYC of yield, and the operator pays it from the vault.',
  },
  {
    id: 'maturity',
    text: 'On April first, the market matures. Alice redeems her 500 PT for 476.19 USYC, worth exactly 500 dollars. She paid 487.75 and got 500 back. A fixed return, and her price stayed private.',
  },
  {
    id: 'canton',
    text: 'Would this lose anything without Canton? Yes. Sub-transaction privacy hides every price. Atomic transactions remove settlement risk. Access passes keep the market permissioned. And our tokens follow the Canton Token Standard, CIP-56, so any Canton wallet can hold them.',
  },
  {
    id: 'stack',
    text: 'Under the hood: Daml contracts for the fund, the market, the tokens and the private quotes. Every payout rounds down, so the vault can never go negative, and our Daml tests check every payout in this story to six decimals. A NestJS backend runs the operator and dealer bots, and a React app puts it all in the browser.',
  },
  {
    id: 'app',
    text: "Here is the real app. On the Markets page, Alice sees the fixed rate: 5.1 percent until April. She types 500 PT and asks for a firm quote. The dealer's price arrives in two seconds, and she accepts it. Her portfolio now shows 500 PT, worth 500 dollars at maturity.",
  },
  {
    id: 'outro',
    text: 'Next, we plug into the real USYC on Canton and deploy to DevNet. Exodus: fixed rates for tokenized Treasuries, private by design, on Canton.',
  },
]

/**
 * How some words must be SPOKEN, when the voice would read them wrong.
 * The captions keep the written form; only the text sent to ElevenLabs changes.
 * Example: "USYC" alone is often read as one word ("you-sick"), so we spell it.
 */
export const PRONUNCIATION: Array<[written: string, spoken: string]> = [
  ['USYC', 'U.S.Y.C.'],
  ['USDC', 'U.S.D.C.'],
  ['CIP-56', 'C.I.P. fifty-six'],
  ['NestJS', 'Nest J.S.'],
  ['Daml', 'Damel'],
  ['DevNet', 'Dev Net'],
]

/** The text we send to ElevenLabs for one scene (written text with the pronunciation fixes). */
export function spokenText(text: string): string {
  let spoken = text
  for (const [written, said] of PRONUNCIATION) {
    spoken = spoken.split(written).join(said)
  }
  // "Buy USYC." becomes "Buy U.S.Y.C.." after the fix: keep a single period.
  return spoken.replace(/\.{2,}/g, '.')
}

/**
 * Splits a scene's text into sentences, for the captions.
 * We split after ".", "?" or "!" followed by a space, so "1.025" stays whole.
 * Example: "Alice accepts. Both legs settle." → ["Alice accepts.", "Both legs settle."]
 */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
}
