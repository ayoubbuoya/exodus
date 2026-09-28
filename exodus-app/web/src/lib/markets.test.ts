// Unit tests for the market screen helpers.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { ActivityRow, QuoteView } from '../api/types.ts'
import {
  findAnsweringQuote,
  formatSecondsLeft,
  isMarketActivity,
  marketName,
  marketTabFrom,
  mergeLastIndex,
  quoteFlowStatus,
  quoteTimeLeftShare,
} from './markets.ts'

const ASKED = Date.parse('2026-09-25T10:00:00Z')
const VALID_UNTIL = '2026-09-25T10:01:00Z'

describe('quoteFlowStatus', () => {
  const base = { askedAtMs: ASKED, seenQuote: null, hasOpenRequest: false, listsRefreshedAfterAsk: true, nowMs: ASKED + 1000 }

  it('is idle before asking', () => {
    assert.equal(quoteFlowStatus({ ...base, askedAtMs: null }), 'idle')
  })

  it('waits while the request is queued, or while the lists are still the old ones', () => {
    assert.equal(quoteFlowStatus({ ...base, hasOpenRequest: true }), 'waiting')
    assert.equal(quoteFlowStatus({ ...base, listsRefreshedAfterAsk: false }), 'waiting')
  })

  it('shows the quote until 2 s before it expires, then expired', () => {
    const seenQuote = { validUntil: VALID_UNTIL }
    assert.equal(quoteFlowStatus({ ...base, seenQuote, nowMs: Date.parse(VALID_UNTIL) - 5000 }), 'quoted')
    assert.equal(quoteFlowStatus({ ...base, seenQuote, nowMs: Date.parse(VALID_UNTIL) - 1000 }), 'expired')
  })

  it('is declined when the request is gone without a quote', () => {
    assert.equal(quoteFlowStatus(base), 'declined')
  })
})

describe('findAnsweringQuote', () => {
  const quote = (marketId: string, side: 'BuyPt' | 'SellPt', validUntil: string) =>
    ({ quoteId: `${marketId}-${side}-${validUntil}`, marketId, side, validUntil }) as QuoteView

  it('matches the same market and side, valid after the ask', () => {
    const answer = quote('PT-USYC-APR2027', 'BuyPt', VALID_UNTIL)
    const quotes = [quote('PT-USYC-APR2027', 'SellPt', VALID_UNTIL), quote('PT-USYC-APR2027', 'BuyPt', '2026-09-25T09:59:00Z'), answer]
    assert.equal(findAnsweringQuote(quotes, { marketId: 'PT-USYC-APR2027', side: 'BuyPt', askedAtMs: ASKED }), answer)
  })

  it('is null while nothing matches', () => {
    assert.equal(findAnsweringQuote([], { marketId: 'PT-USYC-APR2027', side: 'BuyPt', askedAtMs: ASKED }), null)
  })
})

describe('formatSecondsLeft', () => {
  it('counts down in m:ss and stops at 0:00', () => {
    assert.equal(formatSecondsLeft(VALID_UNTIL, ASKED), '1:00')
    assert.equal(formatSecondsLeft(VALID_UNTIL, Date.parse(VALID_UNTIL) - 42_500), '0:42')
    assert.equal(formatSecondsLeft(VALID_UNTIL, Date.parse(VALID_UNTIL) + 5000), '0:00')
  })
})

describe('mergeLastIndex', () => {
  const pieces = [
    { amount: '300', lastIndex: '1.0000000000' },
    { amount: '200', lastIndex: '1.0' },
    { amount: '100', lastIndex: '1.025' },
  ]

  it('uses the biggest group of pieces with the same lastIndex', () => {
    assert.equal(mergeLastIndex(pieces, '400'), '1.0000000000')
  })

  it('is null when no group covers the amount (claim first)', () => {
    assert.equal(mergeLastIndex(pieces, '600'), null)
    assert.equal(mergeLastIndex([], '1'), null)
  })
})

describe('isMarketActivity', () => {
  const row = (kind: ActivityRow['kind'], changes: Record<string, string>) => ({ updateId: '1', at: '', kind, changes }) as ActivityRow

  it('is true for rows that moved PT or YT, and for yield claims', () => {
    assert.equal(isMarketActivity(row('SPLIT', { USYC: '-30', 'PT-USYC-APR2027': '30', 'YT-USYC-APR2027': '30' })), true)
    assert.equal(isMarketActivity(row('CLAIMED', { USYC: '0.487804' })), true)
  })

  it('is false for the fund on-ramp', () => {
    assert.equal(isMarketActivity(row('SUBSCRIBED', { USDC: '-60', USYC: '60' })), false)
  })
})

describe('marketName', () => {
  it('reads like Pendle: asset and maturity', () => {
    assert.equal(marketName({ instrument: 'USYC', maturity: '2027-04-01T00:00:00Z' }), 'USYC · Apr 1, 2027')
  })
})

describe('marketTabFrom', () => {
  it('opens the tab named in the address', () => {
    assert.equal(marketTabFrom('yield', false), 'yield')
    assert.equal(marketTabFrom('mint', true), 'mint')
  })

  it('falls back to trading before maturity and to redeeming after', () => {
    assert.equal(marketTabFrom(null, false), 'fixed')
    assert.equal(marketTabFrom('nonsense', false), 'fixed')
    assert.equal(marketTabFrom(null, true), 'maturity')
  })
})

describe('quoteTimeLeftShare', () => {
  const seenAt = Date.parse('2026-09-25T10:00:00Z')

  it('goes from 1 to 0 over the quote life', () => {
    assert.equal(quoteTimeLeftShare(VALID_UNTIL, seenAt, seenAt), 1)
    assert.equal(quoteTimeLeftShare(VALID_UNTIL, seenAt, seenAt + 45_000), 0.25)
    assert.equal(quoteTimeLeftShare(VALID_UNTIL, seenAt, seenAt + 90_000), 0)
  })

  it('is 0 for a quote seen after it expired', () => {
    assert.equal(quoteTimeLeftShare(VALID_UNTIL, seenAt + 120_000, seenAt + 120_000), 0)
  })
})
