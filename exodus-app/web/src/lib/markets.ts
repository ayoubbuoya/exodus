// Small pure helpers for the market screens (no React, easy to test).
import { decimalToUnits } from '@exodus/ledger'
import type { ActivityRow, QuoteView, RfqSide } from '../api/types.ts'
import { formatDemoDate } from './format.ts'

// A market's name the way Pendle writes it: the asset and the maturity.
// Example: { instrument: "USYC", maturity: "2027-04-01T00:00:00Z" } -> "USYC · Apr 1, 2027"
export function marketName(market: { instrument: string; maturity: string }): string {
  return `${market.instrument} · ${formatDemoDate(market.maturity)}`
}

// The four tabs of a market page, in Pendle's words:
//   fixed     Fixed Yield (PT): buy or sell PT privately
//   mint      Mint / Redeem: USYC <-> PT + YT
//   yield     Yield (YT): claim what YT has earned
//   maturity  At maturity: redeem PT
export type MarketTab = 'fixed' | 'mint' | 'yield' | 'maturity'

const MARKET_TABS: MarketTab[] = ['fixed', 'mint', 'yield', 'maturity']

// The tab to open from the page address (?tab=yield), so other pages can link
// straight to an action (the Portfolio's "Claim" opens the Yield tab).
// Anything missing or unknown opens the most useful tab: trading PT before
// maturity, redeeming PT after.
export function marketTabFrom(value: string | null, matured: boolean): MarketTab {
  const known = MARKET_TABS.find((tab) => tab === value)
  if (known !== undefined) {
    return known
  }
  return matured ? 'maturity' : 'fixed'
}

// How much of a firm quote's life is left, from 1 (just arrived) to 0
// (expired), for the countdown bar. `seenAtMs`: when the quote first showed up.
// Example: valid until 10:01:00, seen at 10:00:00, now 10:00:45 -> 0.25.
export function quoteTimeLeftShare(validUntil: string, seenAtMs: number, nowMs: number): number {
  const total = Date.parse(validUntil) - seenAtMs
  if (total <= 0) {
    return 0
  }
  return Math.min(1, Math.max(0, (Date.parse(validUntil) - nowMs) / total))
}

// Where a "Get firm quote" is, from Alice's point of view:
//   idle      nothing asked yet
//   waiting   asked; the dealer has not answered yet
//   quoted    a firm quote is on screen and can be accepted
//   expired   the quote ran out (or the dealer withdrew it after expiry)
//   declined  the request is gone without a quote (for example over the dealer's size limit)
export type QuoteFlowStatus = 'idle' | 'waiting' | 'quoted' | 'expired' | 'declined'

// The same safety margin as the API's isLive: a quote with less than 2 s left
// would expire on its way to the ledger.
const ACCEPT_MARGIN_MS = 2000

export type QuoteFlowInput = {
  askedAtMs: number | null // when Alice asked (null = not asked)
  seenQuote: Pick<QuoteView, 'validUntil'> | null // the quote that answered her, once seen
  hasOpenRequest: boolean // her request is still in the dealer's queue
  // Both lists were reloaded AFTER she asked. Right after asking, the old
  // (empty) lists are still on screen: that is "waiting", not "declined".
  listsRefreshedAfterAsk: boolean
  nowMs: number
}

export function quoteFlowStatus(input: QuoteFlowInput): QuoteFlowStatus {
  if (input.askedAtMs === null) {
    return 'idle'
  }
  if (input.seenQuote !== null) {
    return input.nowMs + ACCEPT_MARGIN_MS < Date.parse(input.seenQuote.validUntil) ? 'quoted' : 'expired'
  }
  if (input.hasOpenRequest || !input.listsRefreshedAfterAsk) {
    return 'waiting'
  }
  return 'declined'
}

// The quote that answers an ask: same market and side, and still valid after
// the moment Alice asked (a quote is valid for about 60 s from when it is made,
// so an older quote of the same kind cannot match). null if none yet.
export function findAnsweringQuote(
  quotes: QuoteView[],
  ask: { marketId: string; side: RfqSide; askedAtMs: number },
): QuoteView | null {
  const match = quotes.find(
    (quote) => quote.marketId === ask.marketId && quote.side === ask.side && Date.parse(quote.validUntil) > ask.askedAtMs,
  )
  return match ?? null
}

// Time left on a quote: "0:42", "1:00", "0:00" once expired.
export function formatSecondsLeft(validUntil: string, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((Date.parse(validUntil) - nowMs) / 1000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The lastIndex a merge of `amount` would use, or null if no YT can cover it.
//
// Why: a merge pays amount / lastIndex, and the ledger client first joins the
// YT pieces that share a lastIndex, then uses the biggest piece. Pieces with
// different lastIndex cannot be joined. Example:
//   pieces 300 @1.00, 200 @1.00, 100 @1.025, amount 400 -> "1.00" (300 + 200 = 500 covers it)
//   same pieces, amount 600                             -> null (claim first to join them)
export function mergeLastIndex(pieces: { amount: string; lastIndex: string }[], amount: string): string | null {
  const totals = new Map<bigint, { lastIndex: string; units: bigint }>()
  for (const piece of pieces) {
    const key = decimalToUnits(piece.lastIndex)
    const group = totals.get(key) ?? { lastIndex: piece.lastIndex, units: 0n }
    group.units += decimalToUnits(piece.amount)
    totals.set(key, group)
  }
  let best: { lastIndex: string; units: bigint } | null = null
  for (const group of totals.values()) {
    if (best === null || group.units > best.units) {
      best = group
    }
  }
  if (best === null || best.units < decimalToUnits(amount)) {
    return null
  }
  return best.lastIndex
}

// True for activity rows that moved PT or YT (a split, a trade, a payout),
// so the Portfolio shows them and the Wallet tags them "Markets".
export function isMarketActivity(row: ActivityRow): boolean {
  if (row.kind === 'CLAIMED') {
    // A claim only pays USYC (the YT stays), but it is still market activity.
    return true
  }
  return Object.keys(row.changes).some((symbol) => symbol.startsWith('PT-') || symbol.startsWith('YT-'))
}
