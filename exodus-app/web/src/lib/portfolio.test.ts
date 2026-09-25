// Unit tests for the Portfolio helpers.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MarketView, PortfolioPosition } from '../api/types.ts'
import { nextMaturity, positionRows, sumDecimals } from './portfolio.ts'

function position(overrides: Partial<PortfolioPosition>): PortfolioPosition {
  return {
    marketId: 'PT-USYC-APR2027',
    symbols: { pt: 'PT-USYC-APR2027', yt: 'YT-USYC-APR2027' },
    matured: false,
    ptTotal: '0',
    ptLocked: '0',
    ptFree: '0',
    ytTotal: '0',
    ytPieces: [],
    claimableUsyc: '0',
    index: '1.025',
    ptPrice: '0.975',
    value: { ptUsd: 0, ytUsd: 0, claimableUsd: 0, totalUsd: 0 },
    ...overrides,
  }
}

function market(marketId: string, maturity: string, matured = false): MarketView {
  return { marketId, maturity, matured } as MarketView
}

describe('sumDecimals', () => {
  it('adds exactly, without floating point dust', () => {
    assert.equal(sumDecimals(['0.1', '0.2']), '0.3000000000')
    assert.equal(sumDecimals(['24.390243', '0.487804']), '24.8780470000')
  })

  it('is 0 for an empty list', () => {
    assert.equal(sumDecimals([]), '0.0000000000')
  })
})

describe('positionRows', () => {
  it('gives a PT row and a YT row, PT first, with Pendle values', () => {
    const rows = positionRows([
      position({
        ptTotal: '500',
        ptLocked: '20',
        ytTotal: '1000',
        claimableUsyc: '24.390243',
        value: { ptUsd: 487.5, ytUsd: 25, claimableUsd: 25, totalUsd: 537.5 },
      }),
    ])
    assert.deepEqual(
      rows.map((row) => [row.kind, row.amount, row.lockedPt, row.usd, row.claimableUsyc]),
      [
        ['pt', '500', '20', 487.5, '0'],
        ['yt', '1000', '0', 50, '24.390243'],
      ],
    )
  })

  it('skips a token the client no longer holds', () => {
    const rows = positionRows([position({ ptTotal: '0', ytTotal: '8.5' })])
    assert.deepEqual(
      rows.map((row) => row.kind),
      ['yt'],
    )
  })
})

describe('nextMaturity', () => {
  const positions = [position({ marketId: 'A', ptTotal: '1' }), position({ marketId: 'B', ytTotal: '1' })]

  it('is the earliest open market the client holds', () => {
    const markets = [market('B', '2027-06-01T00:00:00Z'), market('A', '2027-04-01T00:00:00Z'), market('C', '2026-12-01T00:00:00Z')]
    assert.equal(nextMaturity(positions, markets)?.marketId, 'A')
  })

  it('skips matured markets and is null when nothing is left', () => {
    assert.equal(nextMaturity(positions, [market('A', '2027-04-01T00:00:00Z', true)]), null)
  })
})
