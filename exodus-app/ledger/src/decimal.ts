// Money math without floating point errors.
//
// The ledger sends Daml Decimals as strings with 10 decimal places, for example
// "487.5000000000". JavaScript numbers cannot hold every such value exactly
// (0.1 + 0.2 = 0.30000000000000004), so we never use `number` to add or compare
// amounts. We turn them into whole "units" (1 unit = 0.0000000001) stored in a
// bigint instead:
//
//   decimalToUnits("487.5")   -> 4875000000000n
//   unitsToDecimal(4875000000000n) -> "487.5000000000"
//
// Converting to `number` is fine for DISPLAY only (see formatAmount).

const DECIMAL_PLACES = 10;
const UNITS_PER_ONE = 10n ** BigInt(DECIMAL_PLACES);

export function decimalToUnits(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Not a positive decimal number: "${value}"`);
  }
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > DECIMAL_PLACES) {
    throw new Error(`Too many decimal places (max ${DECIMAL_PLACES}): "${value}"`);
  }
  const paddedFraction = fractionPart.padEnd(DECIMAL_PLACES, "0");
  return BigInt(wholePart) * UNITS_PER_ONE + BigInt(paddedFraction);
}

// Negative units work too (the activity feed shows losses):
//   unitsToDecimal(-4875000000000n) -> "-487.5000000000"
// We format the absolute value and put the sign in front, because bigint
// division and % keep the sign on BOTH parts (-487 and -5000000000).
export function unitsToDecimal(units: bigint): string {
  const sign = units < 0n ? "-" : "";
  const absolute = units < 0n ? -units : units;
  const wholePart = absolute / UNITS_PER_ONE;
  const fractionPart = absolute % UNITS_PER_ONE;
  return `${sign}${wholePart}.${fractionPart.toString().padStart(DECIMAL_PLACES, "0")}`;
}

// numerator / denominator, rounded DOWN to 6 decimals, like roundDown6 in the
// contract. Example: divideRoundDown6("500", "1.025") -> "487.8048780000"
// (500 / 1.025 = 487.80487804..., the digits after the 6th are dropped).
//
// Use it for PREVIEWS only. The contract's own result is the real one.
export function divideRoundDown6(numerator: string, denominator: string): string {
  const numeratorUnits = decimalToUnits(numerator);
  const denominatorUnits = decimalToUnits(denominator);
  if (denominatorUnits === 0n) {
    throw new Error("Cannot divide by 0");
  }
  // bigint division always rounds down, which is what we want.
  const quotientUnits = (numeratorUnits * UNITS_PER_ONE) / denominatorUnits;
  // Keep 6 of the 10 decimals: drop the last 4 digits.
  const droppedPart = quotientUnits % 10_000n;
  return unitsToDecimal(quotientUnits - droppedPart);
}

// a * b, rounded DOWN to 6 decimals, like 'roundDown6 (usycAmount * rate.index)'
// in the redeem contract. Example: multiplyRoundDown6("487.804878", "1.025")
// -> "499.9999990000" (487.804878 * 1.025 = 499.99999995, the digits after the 6th are dropped).
//
// Use it for PREVIEWS and for choosing the fund's input holdings only. The
// contract's own result is the real one.
export function multiplyRoundDown6(a: string, b: string): string {
  // Both have 10 decimals, so the product has 20: divide once to get back to 10.
  const productUnits = (decimalToUnits(a) * decimalToUnits(b)) / UNITS_PER_ONE;
  // Keep 6 of the 10 decimals: drop the last 4 digits.
  const droppedPart = productUnits % 10_000n;
  return unitsToDecimal(productUnits - droppedPart);
}

// True if `value` has no digits after the 6th decimal, like every holding.
// The redeem contract refuses amounts such as "0.0000001" USYC.
// Examples: "100.5" -> true, "0.000001" -> true, "0.0000001" -> false.
export function hasAtMost6Decimals(value: string): boolean {
  return decimalToUnits(value) % 10_000n === 0n;
}

// ---------------------------------------------------------------------------
// Exact copies of Daml's Decimal maths, for the market previews.
//
// Daml keeps 10 decimals. When a product or a quotient has more, Daml rounds
// to the NEAREST 10th decimal, and exactly-half cases go to the even digit
// ("banker's rounding"). Then our contracts cut to 6 decimals with roundDown6.
// Doing the same steps here makes our previews match the contract to the last
// digit. Example (YT claim, spec section 9):
//   divideDaml("1000", "1.025")  -> "975.6097560976"  (975.60975609756... rounded)
//   1000 - 975.6097560976         = 24.3902439024
//   roundDown6(...)               -> "24.3902430000"
// ---------------------------------------------------------------------------

// Divides two unit counts and rounds half to even. Used by divideDaml and multiplyDaml.
function divideUnitsHalfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twiceRemainder = remainder * 2n;
  if (twiceRemainder > denominator) {
    return quotient + 1n;
  }
  if (twiceRemainder === denominator && quotient % 2n === 1n) {
    return quotient + 1n;
  }
  return quotient;
}

// a / b exactly like Daml: 10 decimals, round half to even.
// Example: divideDaml("100", "1.025") -> "97.5609756098"
export function divideDaml(a: string, b: string): string {
  const denominatorUnits = decimalToUnits(b);
  if (denominatorUnits === 0n) {
    throw new Error("Cannot divide by 0");
  }
  return unitsToDecimal(divideUnitsHalfEven(decimalToUnits(a) * UNITS_PER_ONE, denominatorUnits));
}

// a * b exactly like Daml: 10 decimals, round half to even.
// Example: multiplyDaml("333.333333", "1.025") -> "341.6666663250"
export function multiplyDaml(a: string, b: string): string {
  return unitsToDecimal(divideUnitsHalfEven(decimalToUnits(a) * decimalToUnits(b), UNITS_PER_ONE));
}

// a - b. Both must be >= 0 and the result too (decimalToUnits only reads
// positive numbers). Example: subtractDecimal("1000", "975.6097560976") -> "24.3902439024"
export function subtractDecimal(a: string, b: string): string {
  const difference = decimalToUnits(a) - decimalToUnits(b);
  if (difference < 0n) {
    throw new Error(`Negative result: ${a} - ${b}`);
  }
  return unitsToDecimal(difference);
}

// Like roundDown6 in the contract: keep 6 decimals, drop the rest.
// Example: roundDown6("24.3902439024") -> "24.3902430000"
export function roundDown6(value: string): string {
  const units = decimalToUnits(value);
  return unitsToDecimal(units - (units % 10_000n));
}

// For display only: "1000.0000000000" -> "1,000", "24.3902430000" -> "24.390243".
export function formatAmount(value: string | number, maxDecimals = 6): string {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

// For display only: always 2 decimals, for example 908.8 -> "908.80".
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
