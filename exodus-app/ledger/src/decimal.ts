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

export function unitsToDecimal(units: bigint): string {
  const wholePart = units / UNITS_PER_ONE;
  const fractionPart = units % UNITS_PER_ONE;
  return `${wholePart}.${fractionPart.toString().padStart(DECIMAL_PLACES, "0")}`;
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

// For display only: "1000.0000000000" -> "1,000", "24.3902430000" -> "24.390243".
export function formatAmount(value: string | number, maxDecimals = 6): string {
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

// For display only: always 2 decimals, for example 908.8 -> "908.80".
export function formatUsd(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
