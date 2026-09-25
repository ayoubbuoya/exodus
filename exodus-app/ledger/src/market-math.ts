// Pure maths for the Exodus markets (the Pendle part): fixed APY, dealer price,
// and previews of what split, claim, merge and PT redeem will pay.
//
// No ledger calls here, so the dealer bot, the API and the web UI can all use
// these functions, and the unit tests can check them with the spec section 9
// numbers.
//
// Two kinds of maths:
// - PRICES AND RATES (fixedApyFromPrice, priceForApy) use plain JavaScript
//   numbers. They are for display and for choosing a quote price; a tiny float
//   error in "5.19%" does not move any money.
// - TOKEN AMOUNTS (the previews) copy the contract's Decimal maths exactly
//   (divideDaml / multiplyDaml, then roundDown6), so a preview of
//   "24.390243 USYC" is what the contract will really pay at that index.
import { decimalToUnits, divideDaml, multiplyDaml, roundDown6, subtractDecimal } from "./decimal.ts";

// Pendle measures time to expiry in years of exactly 365 days
// (IMPLIED_RATE_TIME = 365 * 86400 in MarketMathCore.sol). We do the same.
const MS_PER_YEAR = 365 * 24 * 60 * 60 * 1000;

// Years from `fromTime` to `toTime`, never below 0.
// Both are ISO times on the oracle's DEMO clock (simTime), because maturity is
// on the demo clock. Example: Oct 1 2026 -> Apr 1 2027 = 182 days = 0.4986 years.
export function yearsBetween(fromTime: string, toTime: string): number {
  const years = (Date.parse(toTime) - Date.parse(fromTime)) / MS_PER_YEAR;
  return Math.max(0, years);
}

// The fixed APY a buyer locks in by paying `price` USDC for 1 PT that pays
// 1 USD after `years`:
//
//   fixedApy = (1 / price)^(1 / years) - 1
//
// Example (spec section 9): price 0.975 with 0.5 years left
//   -> (1 / 0.975)^2 - 1 = 0.05194 -> about 5.19% a year.
// This is Pendle's implied rate turned into an APY: exchangeRate = 1 / price
// and APY = exchangeRate^(1 / years) - 1.
export function fixedApyFromPrice(price: number, years: number): number {
  if (!(price > 0)) {
    throw new Error("price must be greater than 0");
  }
  if (!(years > 0)) {
    throw new Error("years must be greater than 0: the market has matured");
  }
  return Math.pow(1 / price, 1 / years) - 1;
}

// The PT price that gives the buyer `apy` a year until maturity. The dealer
// bot uses it to quote from a target rate:
//
//   price = (1 + apy)^(-years)          (Pendle: 1 / exchangeRate)
//
// Example: 5.2% with 0.5 years left -> 1 / 1.052^0.5 = 0.97497 -> about 0.975.
// At maturity (years = 0) the price is 1: a PT then pays exactly 1 USD.
export function priceForApy(apy: number, years: number): number {
  if (!(apy > -1)) {
    throw new Error("apy must be greater than -100%");
  }
  return Math.pow(1 + apy, -Math.max(0, years));
}

// What a split gives: PT = YT = roundDown6 (usycAmount * index).
// Examples: 1000 USYC at 1.00 -> "1000"; 333.333333 USYC at 1.025 -> "341.666666".
export function previewSplit(usycAmount: string, index: string): string {
  return roundDown6(multiplyDaml(usycAmount, index));
}

// The USYC yield a YT claim pays when the index moves from `lastIndex` to `newIndex`:
//
//   roundDown6 (amount / lastIndex - amount / newIndex)
//
// (the contract's Claim_Settle, same order of operations). Examples (spec section 9):
//   1000 YT, 1.00  -> 1.025: "24.390243"
//   1000 YT, 1.025 -> 1.05:  "23.228803"
// "0" when the index has not moved up (the contract then pays nothing).
export function previewClaim(amount: string, lastIndex: string, newIndex: string): string {
  if (decimalToUnits(newIndex) <= decimalToUnits(lastIndex)) {
    return roundDown6("0");
  }
  const paidUpTo = divideDaml(amount, lastIndex);
  const worthNow = divideDaml(amount, newIndex);
  return roundDown6(subtractDecimal(paidUpTo, worthNow));
}

// What a merge of `amount` PT + YT pays: roundDown6 (amount / lastIndex) USYC.
// No price is needed: the PT's value plus the YT's unclaimed yield always adds
// up to this (see Merge_Settle). Example: 100 PT + 100 YT at lastIndex 1.025 -> "97.560975".
export function previewMerge(amount: string, lastIndex: string): string {
  return roundDown6(divideDaml(amount, lastIndex));
}

// What a PT redeem pays after maturity: roundDown6 (ptAmount / index) USYC,
// at the price of the settle moment, so 1 PT is always worth 1 USD.
// Example: 500 PT at 1.05 -> "476.190476"; at 1.06 -> "471.698113".
export function previewPtRedeem(ptAmount: string, index: string): string {
  return roundDown6(divideDaml(ptAmount, index));
}

// The cash of a quote: roundDown6 (price * ptAmount) USDC, like Rfq_Quote.
// Example: 500 PT at 0.975 -> "487.5".
export function previewQuoteCash(price: string, ptAmount: string): string {
  return roundDown6(multiplyDaml(price, ptAmount));
}

// The token symbols of a market, Pendle style. The market id is the PT's name:
//   marketSymbols("PT-USYC-APR2027") -> { pt: "PT-USYC-APR2027", yt: "YT-USYC-APR2027" }
// A market id without the "PT-" prefix gets both prefixes added:
//   marketSymbols("USYC-JUL2027")    -> { pt: "PT-USYC-JUL2027", yt: "YT-USYC-JUL2027" }
export function marketSymbols(marketId: string): { pt: string; yt: string } {
  const name = marketId.startsWith("PT-") ? marketId.slice("PT-".length) : marketId;
  return { pt: `PT-${name}`, yt: `YT-${name}` };
}
