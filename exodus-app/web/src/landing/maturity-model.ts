// The small model behind "Two instruments. One date."
//
// It shows how PT and YT behave as the demo clock moves from the split
// (01 Oct 2026, day 0) to maturity (01 Apr 2027, day 182):
// - USYC index: the spec's demo schedule, 1.00 on 01 Oct → 1.025 on 01 Jan
//   → 1.05 on 01 Apr, straight lines in between (what the oracle bot publishes).
// - PT price: a zero-coupon price at a CONSTANT implied rate of 5.19% (the rate
//   of the example quote). PT = 1 / (1 + 5.19%) ^ (years left). It "pulls to par":
//   0.9750 at the split, exactly 1.0000 at maturity.
// - YT value: what the rest of the yield is worth per 1 USD of notional,
//   1 − PT. It falls to exactly 0 at maturity.
// - Bank's claimable yield on 1,000 YT (never claimed): 1,000 × (1 − 1 / index),
//   rounded down to 6 decimals like every Exodus payout.
//   Example on 01 Jan: 1,000 × (1 − 1 / 1.025) = 24.390243 USYC.
//
// This is an illustration: on Exodus, real PT prices only exist inside private
// quotes. The page says so next to the chart.
import { TERM_DAYS } from './demo-numbers.ts'

/** Day number of 01 Jan 2027, when the index reaches 1.025. */
export const JAN_1 = 92

/** (1 / 0.975) ^ 2 − 1 ≈ 0.051939: the fixed APY of the example quote. */
const IMPLIED_RATE = Math.pow(1 / 0.975, 2) - 1

export function usycIndex(day: number): number {
  if (day <= JAN_1) return 1 + (0.025 * day) / JAN_1
  return 1.025 + (0.025 * (day - JAN_1)) / (TERM_DAYS - JAN_1)
}

export function ptPrice(day: number): number {
  const yearsLeft = (TERM_DAYS - day) / 365
  return 1 / Math.pow(1 + IMPLIED_RATE, yearsLeft)
}

export function ytValue(day: number): number {
  return 1 - ptPrice(day)
}

/** Claimable yield on 1,000 YT with last index 1.00, as a 6-decimal string. */
export function claimableOn1000(day: number): string {
  const raw = 1000 * (1 - 1 / usycIndex(day))
  // Round DOWN to 6 decimals (the vault never pays out more than it holds).
  // The tiny epsilon stops 24.3902439… from becoming 24.390242 through float error.
  return (Math.floor(raw * 1e6 + 1e-7) / 1e6).toFixed(6)
}

const START_UTC = Date.UTC(2026, 9, 1)

/** "01 Jan 2027" for a day number. */
export function dateLabel(day: number): string {
  return new Date(START_UTC + day * 86_400_000).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
