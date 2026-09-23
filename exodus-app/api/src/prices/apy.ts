// The APY formula of the price strip, kept apart from the database code so it
// is easy to read and to test.
//
// Growth between two prices, annualised with compounding:
//   apy = (indexNow / indexThen) ^ (365 / days) - 1
// Example: 1.0125 on Nov 15 and 1.0043 on Oct 16 (30 days):
//   (1.0125 / 1.0043) ^ (365 / 30) - 1 = 0.1040 -> 10.40 (percent)
//
// Number maths is fine here: the result is only displayed, never used for money.

// Below this span the annualised number jumps around too much to be useful.
export const MIN_APY_SPAN_DAYS = 7;

// Returns the APY in percent with 2 decimals (10.40 means 10.40 %), or null when
// the two prices are less than MIN_APY_SPAN_DAYS apart.
export function annualizedGrowthPercent(indexNow: number, indexThen: number, days: number): number | null {
  if (days < MIN_APY_SPAN_DAYS || indexThen <= 0) {
    return null;
  }
  const apy = Math.pow(indexNow / indexThen, 365 / days) - 1;
  return Math.round(apy * 10_000) / 100;
}
