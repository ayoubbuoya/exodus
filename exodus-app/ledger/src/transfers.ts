// Sending USYC or USDC the way a Canton wallet does: through the issuer's
// CIP-56 TransferFactory (TransferFactory_Transfer), not through our own
// Holding.Transfer choice.
//
// Example: Bank holds 600 USYC and 400 USYC and sends 700 USYC to Alice.
//   1. Pick input holdings, biggest first, until they cover 700: [600, 400].
//   2. Read UsycIssuer's transfer factory AS UsycIssuer (clients cannot see it).
//   3. Find both access passes: Bank's (Bank sees its own) and Alice's (read
//      as UsycIssuer, which observes every pass; Bank cannot see it).
//   4. Exercise TransferFactory_Transfer as Bank, with the passes in
//      extraArgs.context and the factory + Alice's pass disclosed. The factory
//      checks both passes, archives both inputs, and creates 700 USYC for
//      Alice and 300 USYC change for Bank, in one step.
//
// Only approved clients may send and receive (spec gap 11): step 3 fails with
// a clear message if either side has no pass, and the contract checks again.
import type { ContractId } from "@daml/types";
import type { LedgerClient } from "./client.ts";
import { decimalToUnits } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import { getClientAccess, getOwnedHoldings, getTransferFactory } from "./queries.ts";
import {
  emptyMetadata,
  TransferFactoryInterface,
  type AnyContract,
  type ChoiceContext,
  type HoldingInterface,
} from "./templates.ts";

// The keys under which the factory looks for the two passes in
// extraArgs.context. They must match senderAccessKey / receiverAccessKey in
// exodus-contract/main/daml/Exodus/TransferFactory.daml.
export const SENDER_ACCESS_KEY = "exodus-sender-access";
export const RECEIVER_ACCESS_KEY = "exodus-receiver-access";

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
  const inputs = pickInputs(candidates, request.amount, request.instrument);

  // 2. The issuer (instrument admin) owns the factory. All inputs share it,
  //    because they are the same instrument. Only the issuer sees the factory.
  const admin = inputs[0].payload.instrumentId.admin;
  const factory = await getTransferFactory(ledger, admin, admin);
  if (factory === null) {
    throw new Error(`No transfer factory found for ${request.instrument}. Run \`npm run bootstrap\`.`);
  }

  // 3. Both access passes, from the operator the factory trusts.
  const operator = factory.payload.operator;
  const senderAccess = await getClientAccess(ledger, request.sender, request.sender);
  if (senderAccess === null || senderAccess.payload.operator !== operator) {
    throw new Error("The sender is not an approved Exodus client (no access pass), so it cannot send.");
  }
  // The receiver's pass is read by the issuer: the sender must not be able to
  // list other clients' passes, but the issuer observes them all.
  const receiverAccess = await getClientAccess(ledger, admin, request.receiver);
  if (receiverAccess === null || receiverAccess.payload.operator !== operator) {
    throw new Error(`The receiver is not an approved Exodus client, so it cannot receive ${request.instrument}.`);
  }

  // The context the factory reads the passes from (the CIP-56 "extra args").
  // The standard stores any contract id as "ContractId AnyContract"; the
  // factory turns it back into a ClientAccess id.
  const context: ChoiceContext = {
    values: {
      [SENDER_ACCESS_KEY]: { tag: "AV_ContractId", value: senderAccess.contractId as ContractId<AnyContract> },
      [RECEIVER_ACCESS_KEY]: { tag: "AV_ContractId", value: receiverAccess.contractId as ContractId<AnyContract> },
    },
  };

  // The sender cannot see the factory nor the receiver's pass, so both are disclosed.
  // (Sending to yourself: your own pass is already visible, so we only disclose the factory.)
  const disclosedContracts = [factory.disclosure];
  if (request.receiver !== request.sender) {
    disclosedContracts.push(receiverAccess.disclosure);
  }

  // 4. Send. The factory checks requestedAt <= ledger time < executeBefore,
  //    so requestedAt uses this machine's clock (see "clock drift" in the README).
  const now = Date.now();
  await ledger.exercise(
    request.sender,
    TransferFactoryInterface.TransferFactory_Transfer,
    factory.contractId,
    {
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
        context,
        meta: emptyMetadata,
      },
    },
    { disclosedContracts },
  );
}
