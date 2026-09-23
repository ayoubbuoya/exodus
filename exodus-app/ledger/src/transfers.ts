// Sending USYC or USDC the way a Canton wallet does: through the issuer's
// CIP-56 TransferFactory (TransferFactory_Transfer), not through our own
// Holding.Transfer choice.
//
// Example: Bank holds 600 USYC and 400 USYC and sends 700 USYC to Alice.
//   1. Pick input holdings, biggest first, until they cover 700: [600, 400].
//   2. Find UsycIssuer's transfer factory (Bank can see it as a "user").
//   3. Exercise TransferFactory_Transfer. The factory archives both inputs and
//      creates 700 USYC for Alice and 300 USYC change for Bank, in one step.
import type { ContractId } from "@daml/types";
import type { LedgerClient } from "./client.ts";
import { decimalToUnits, unitsToDecimal } from "./decimal.ts";
import { getOwnedHoldings, getTransferFactory, type Contract } from "./queries.ts";
import { emptyMetadata, TransferFactoryInterface, type HoldingInterface, type HoldingView } from "./templates.ts";

export type SendRequest = {
  sender: string; // full party id, for example "Bank::1220ab..."
  receiver: string; // full party id, for example "Alice::1220ab..."
  instrument: string; // "USYC" or "USDC"
  amount: string; // decimal string, for example "700" or "487.5"
};

// How long the transfer instruction stays valid.
const EXECUTE_WITHIN_MS = 60 * 60 * 1000; // 1 hour

export async function sendHoldings(ledger: LedgerClient, request: SendRequest): Promise<void> {
  const amountUnits = decimalToUnits(request.amount);
  if (amountUnits === 0n) {
    throw new Error("Amount must be greater than 0");
  }

  // 1. Pick input holdings of this instrument, biggest first.
  const owned = await getOwnedHoldings(ledger, request.sender);
  const candidates = owned.filter((holding) => holding.payload.instrumentId.id === request.instrument);
  candidates.sort((a, b) => compareUnits(decimalToUnits(b.payload.amount), decimalToUnits(a.payload.amount)));

  const inputs: Contract<HoldingView>[] = [];
  let inputTotal = 0n;
  for (const holding of candidates) {
    if (inputTotal >= amountUnits) {
      break;
    }
    inputs.push(holding);
    inputTotal += decimalToUnits(holding.payload.amount);
  }
  if (inputTotal < amountUnits) {
    throw new Error(
      `Not enough ${request.instrument}: you have ${unitsToDecimal(inputTotal)}, you want to send ${request.amount}`,
    );
  }

  // 2. The issuer (instrument admin) owns the factory. All inputs share it,
  //    because they are the same instrument.
  const admin = inputs[0].payload.instrumentId.admin;
  const factory = await getTransferFactory(ledger, request.sender, admin);
  if (factory === null) {
    throw new Error(`No transfer factory for ${request.instrument} is visible to the sender`);
  }

  // 3. Send. The factory checks requestedAt <= ledger time < executeBefore,
  //    so requestedAt uses this machine's clock (see "clock drift" in the README).
  const now = Date.now();
  await ledger.exercise(request.sender, TransferFactoryInterface.TransferFactory_Transfer, factory.contractId, {
    expectedAdmin: admin,
    transfer: {
      sender: request.sender,
      receiver: request.receiver,
      amount: request.amount,
      instrumentId: { admin, id: request.instrument },
      requestedAt: new Date(now).toISOString(),
      executeBefore: new Date(now + EXECUTE_WITHIN_MS).toISOString(),
      inputHoldingCids: inputs.map((input) => input.contractId as ContractId<HoldingInterface>),
      meta: emptyMetadata,
    },
    extraArgs: {
      context: { values: {} },
      meta: emptyMetadata,
    },
  });
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
