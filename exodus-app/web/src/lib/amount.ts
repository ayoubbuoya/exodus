import { decimalToUnits, divideRoundDown6, hasAtMost6Decimals, multiplyRoundDown6 } from '@exodus/ledger'

// True when `text` is a positive amount the API accepts: digits, and at most
// 10 decimals (like a Daml Decimal). "12.5" yes; "", "0", "5.", "-1", "1e3" no.
export function isPositiveAmount(text: string): boolean {
  if (!/^\d{1,18}(\.\d{1,10})?$/.test(text)) {
    return false
  }
  return decimalToUnits(text) > 0n
}

// How much USYC `usdcAmount` buys at `index`, rounded down to 6 decimals like
// the contract. null while the input is not a valid amount yet.
// Example: previewUsyc("500", "1.025") -> "487.8048780000"
export function previewUsyc(usdcAmount: string, index: string): string | null {
  if (!isPositiveAmount(usdcAmount)) {
    return null
  }
  return divideRoundDown6(usdcAmount, index)
}

// True when `text` is a USYC amount the redeem contract accepts: positive and
// at most 6 decimals, like every holding. "100" and "0.000001" yes; "0.0000001" no.
export function isUsycAmount(text: string): boolean {
  return isPositiveAmount(text) && hasAtMost6Decimals(text)
}

// How much USDC redeeming `usycAmount` pays at `index`, rounded down to 6
// decimals like the contract. null while the input is not a valid amount yet.
// Example: previewUsdc("100", "1.03") -> "103.0000000000"
// Only an estimate: the fund pays at the price when it settles (a few seconds later).
export function previewUsdc(usycAmount: string, index: string): string | null {
  if (!isUsycAmount(usycAmount)) {
    return null
  }
  return multiplyRoundDown6(usycAmount, index)
}

// "60.0000000000" -> "60", "12.5000000000" -> "12.5" (to fill an input box).
export function trimZeros(amount: string): string {
  return amount.includes('.') ? amount.replace(/\.?0+$/, '') : amount
}

// True for a PT, YT or USYC amount the contracts accept: positive and at
// most 6 decimals (every token has 6). "20" and "12.5" yes; "1.1234567" no.
// The same rule as isUsycAmount, named for the market screens.
export function isTokenAmount(text: string): boolean {
  return isUsycAmount(text)
}
