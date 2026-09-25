// Choosing which holdings to spend, like picking banknotes from a wallet.
//
// Example: Alice owns USDC holdings of 100, 600 and 400 and must pay 700.
//   pickInputs(...)  ->  [600, 400]   (biggest first, stop once we have enough)
// The contract then merges them, pays 700 and gives back 300 as change.
//
// Works for anything with an `amount`: USYC/USDC holdings (CIP-56 views) and
// also PrincipalTokens, which have no CIP-56 view yet (spec gap 7). Example:
// Bank quotes 700 PT from its PT pieces of 600 and 400 -> [600, 400].
import { decimalToUnits, formatAmount, unitsToDecimal } from "./decimal.ts";
import type { Contract } from "./queries.ts";

export function pickInputs<T extends { amount: string }>(
  holdings: Contract<T>[],
  amount: string,
  instrument: string,
): Contract<T>[] {
  const amountUnits = decimalToUnits(amount);
  const sorted = [...holdings];
  sorted.sort((a, b) => compareUnits(decimalToUnits(b.payload.amount), decimalToUnits(a.payload.amount)));

  const inputs: Contract<T>[] = [];
  let inputTotal = 0n;
  for (const holding of sorted) {
    if (inputTotal >= amountUnits) {
      break;
    }
    inputs.push(holding);
    inputTotal += decimalToUnits(holding.payload.amount);
  }

  if (inputTotal < amountUnits) {
    throw new Error(`Not enough ${instrument}: you have ${formatAmount(unitsToDecimal(inputTotal))}, you need ${formatAmount(amount)}`);
  }
  return inputs;
}

// For sort(): negative if a < b, positive if a > b, 0 if equal.
function compareUnits(a: bigint, b: bigint): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}
