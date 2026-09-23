// Choosing which holdings to spend, like picking banknotes from a wallet.
//
// Example: Alice owns USDC holdings of 100, 600 and 400 and must pay 700.
//   pickInputs(...)  ->  [600, 400]   (biggest first, stop once we have enough)
// The contract then merges them, pays 700 and gives back 300 as change.
import { decimalToUnits, formatAmount, unitsToDecimal } from "./decimal.ts";
import type { Contract } from "./queries.ts";
import type { HoldingView } from "./templates.ts";

export function pickInputs(
  holdings: Contract<HoldingView>[],
  amount: string,
  instrument: string,
): Contract<HoldingView>[] {
  const amountUnits = decimalToUnits(amount);
  const sorted = [...holdings];
  sorted.sort((a, b) => compareUnits(decimalToUnits(b.payload.amount), decimalToUnits(a.payload.amount)));

  const inputs: Contract<HoldingView>[] = [];
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
