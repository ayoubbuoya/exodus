// Small pure helpers for the Portfolio page (no React, easy to test).
import { decimalToUnits, unitsToDecimal } from '@exodus/ledger'
import type { MarketView, PortfolioPosition } from '../api/types.ts'

// Adds decimal amounts exactly, like the ledger (no floating point).
// Example: ["0.1", "0.2"] -> "0.3000000000" (with numbers it would be 0.30000000000000004).
export function sumDecimals(values: string[]): string {
  let units = 0n
  for (const value of values) {
    units += decimalToUnits(value)
  }
  return unitsToDecimal(units)
}

// One row of the positions list: a PT or a YT holding in one market.
export type PositionRow = {
  kind: 'pt' | 'yt'
  marketId: string
  symbol: string // "PT-USYC-APR2027"
  amount: string // PT: all PT (free + locked); YT: all YT
  lockedPt: string // PT reserved for a live quote ("0" for YT rows)
  usd: number // what the tokens are worth now (display only)
  claimableUsyc: string // YT rows: the yield ready to claim ("0" for PT rows)
  matured: boolean
}

// One row per token held, PT before YT, markets in the API's order. A token
// with 0 is skipped, so after Carol redeems all her PT only her YT row stays.
// Values follow Pendle: PT at the dealer's mid price, YT = (1 − that price)
// plus the yield it can already claim.
export function positionRows(positions: PortfolioPosition[]): PositionRow[] {
  const rows: PositionRow[] = []
  for (const position of positions) {
    if (decimalToUnits(position.ptTotal) > 0n) {
      rows.push({
        kind: 'pt',
        marketId: position.marketId,
        symbol: position.symbols.pt,
        amount: position.ptTotal,
        lockedPt: position.ptLocked,
        usd: position.value.ptUsd,
        claimableUsyc: '0',
        matured: position.matured,
      })
    }
    if (decimalToUnits(position.ytTotal) > 0n) {
      rows.push({
        kind: 'yt',
        marketId: position.marketId,
        symbol: position.symbols.yt,
        amount: position.ytTotal,
        lockedPt: '0',
        usd: position.value.ytUsd + position.value.claimableUsd,
        claimableUsyc: position.claimableUsyc,
        matured: position.matured,
      })
    }
  }
  return rows
}

// The earliest maturity among the markets where the client still holds PT or
// YT and that have not matured yet. null when there is none (nothing held, or
// everything matured already).
export function nextMaturity(positions: PortfolioPosition[], markets: MarketView[]): MarketView | null {
  const held = new Set(positionRows(positions).map((row) => row.marketId))
  const upcoming = markets
    .filter((market) => held.has(market.marketId) && !market.matured)
    .sort((a, b) => Date.parse(a.maturity) - Date.parse(b.maturity))
  return upcoming[0] ?? null
}
