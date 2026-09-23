import { decimalToUnits, divideRoundDown6 } from '@exodus/ledger'

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

// "60.0000000000" -> "60", "12.5000000000" -> "12.5" (to fill an input box).
export function trimZeros(amount: string): string {
  return amount.includes('.') ? amount.replace(/\.?0+$/, '') : amount
}
