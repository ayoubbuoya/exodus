// Every number the landing page shows, in one place.
//
// They all come from the worked example in docs/exodus.md, section 9, so the
// page never shows an invented metric. When a value is computed, the formula is
// written next to it. Amounts are kept as display strings on purpose: the
// landing page only shows them, it never does money maths with them.

/** Dates of the demo market PT-USYC-APR2027. */
export const SPLIT_DATE = '01 Oct 2026'
export const MATURITY_DATE = '01 Apr 2027'
/** Days from 01 Oct 2026 to 01 Apr 2027. The spec rounds this term to 0.5 years. */
export const TERM_DAYS = 182
export const TERM_YEARS = 0.5

/** The market name, as the app will show it. */
export const MARKET = 'PT-USYC-APR2027'

/** Step 1 of the example: Bank splits 1,000 USYC at index 1.00. */
export const SPLIT = {
  usyc: '1,000',
  index: '1.000000',
  usdValue: '$1,000.00',
  // PT = YT = shares × index = 1,000 × 1.00 = 1,000
  pt: '1,000',
  yt: '1,000',
} as const

/** Step 2 of the example: Alice buys 500 PT from Bank at 0.975. */
export const QUOTE = {
  pt: '500',
  price: '0.9750',
  // Cash = 500 × 0.975 = 487.50 USDC
  cash: '487.50',
  // At maturity 1 PT pays 1 USD of USYC, so 500 PT pay $500.00.
  atMaturity: '$500.00',
  validSeconds: 30,
} as const

/**
 * Fixed APY for the PT buyer: (1 / price) ^ (1 / years) − 1.
 * Example: (1 / 0.975) ^ (1 / 0.5) − 1 = 0.051939… → "5.19%".
 */
export function fixedApy(price: number, years: number): number {
  return Math.pow(1 / price, 1 / years) - 1
}

/** "5.19%", computed from the quote above so the two can never disagree. */
export const FIXED_APY_LABEL = `${(fixedApy(Number(QUOTE.price), TERM_YEARS) * 100).toFixed(2)}%`

/**
 * Steps 3–7 of the example: what the vault pays out, from split to maturity.
 * Every payout rounds DOWN to 6 decimals, so the vault can never go negative.
 */
export const VAULT = {
  deposited: '1,000.000000',
  payouts: [
    { label: 'Bank claims yield, 01 Jan 2027', formula: '1,000 × (1 ÷ 1.00 − 1 ÷ 1.025)', amount: '24.390243' },
    { label: 'Alice redeems 500 PT at maturity', formula: '500 ÷ 1.05', amount: '476.190476' },
    { label: 'Bank claims the last yield', formula: '1,000 × (1 ÷ 1.025 − 1 ÷ 1.05)', amount: '23.228803' },
    { label: 'Bank redeems its own 500 PT', formula: '500 ÷ 1.05', amount: '476.190476' },
  ],
  // 24.390243 + 476.190476 + 23.228803 + 476.190476
  paidOut: '999.999998',
  // 1,000 − 999.999998: rounding dust that stays in the vault.
  dust: '0.000002',
} as const

/** Who earned what, valued at the maturity index 1.05 (spec §9, last table). */
export const OUTCOME = {
  alice: {
    start: '487.50 USDC',
    end: '$500.00 of USYC',
    // 500.00 − 487.50
    profit: '12.50',
  },
  bank: {
    start: '1,000 USYC ($1,000.00)',
    // 24.390243 + 23.228803 + 476.190476 = 523.809522 USYC, worth $550.00 at 1.05, plus the 487.50 USDC from Alice.
    end: '523.809522 USYC + 487.50 USDC ($1,037.50)',
    // 1,037.50 − 1,000.00
    profit: '37.50',
  },
  // The fund's whole yield: 1,000 × (1.05 − 1.00). Equal to 12.50 + 37.50.
  fundYield: '50.00',
} as const
