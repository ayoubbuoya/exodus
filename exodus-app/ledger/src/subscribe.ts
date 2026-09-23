// Subscribe to the simulated USYC fund: pay USDC, get USYC in one atomic step.
//
// Example at index 1.025: subscribeUsyc(ledger, { subscriber: alice, usdcAmount: "500" })
//   -> Alice pays 500 USDC to UsycIssuer and gets 487.804878 USYC.
//
// Spec gap 12 (stale RateIndex id) is fixed in the contract: price snapshots
// stay usable for 30 s, even after a newer one is published. We still retry
// ONCE on a stale-contract error as a safety net, for example when two
// subscribes by the same user race for the same USDC holding.
import type { ContractId } from "@daml/types";
import { isStaleContractError, type LedgerClient } from "./client.ts";
import { decimalToUnits } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import { getOwnedHoldings, getRateIndex, getUsycFund, isRateValid } from "./queries.ts";
import { UsycFund, type Holding, type RateIndex } from "./templates.ts";

export type SubscribeRequest = {
  subscriber: string; // full party id, for example "Alice::1220ab..."
  usdcAmount: string; // decimal string, for example "500"
};

// What happened, for the UI. `retried` is true when the first try hit a
// stale RateIndex and the second try worked.
export type SubscribeOutcome = {
  retried: boolean;
};

export async function subscribeUsyc(ledger: LedgerClient, request: SubscribeRequest): Promise<SubscribeOutcome> {
  if (decimalToUnits(request.usdcAmount) === 0n) {
    throw new Error("Amount must be greater than 0");
  }

  try {
    await subscribeOnce(ledger, request);
    return { retried: false };
  } catch (error) {
    if (!isStaleContractError(error)) {
      throw error;
    }
    // Someone (usually the oracle bot) changed a contract we used. Read again and retry once.
    await subscribeOnce(ledger, request);
    return { retried: true };
  }
}

async function subscribeOnce(ledger: LedgerClient, request: SubscribeRequest): Promise<void> {
  const fund = await getUsycFund(ledger, request.subscriber);
  if (fund === null) {
    throw new Error("No USYC fund is visible to this party. Run `npm run bootstrap`.");
  }

  // Only USDC from the fund's accepted issuer can pay.
  const owned = await getOwnedHoldings(ledger, request.subscriber);
  const usdcHoldings = owned.filter(
    (holding) =>
      holding.payload.instrumentId.id === "USDC" && holding.payload.instrumentId.admin === fund.payload.usdcIssuer,
  );
  const inputs = pickInputs(usdcHoldings, request.usdcAmount, "USDC");

  // Read the newest price snapshot last. It stays usable for its whole window
  // (30 s), even if the oracle publishes a newer one meanwhile.
  const rate = await getRateIndex(ledger, request.subscriber);
  if (rate === null) {
    throw new Error("This party cannot see the USYC index (it must be a RateIndex reader).");
  }
  if (!isRateValid(rate.payload)) {
    throw new Error("No valid USYC price right now. Start the oracle bot: `npm run oracle` or `npm run oracle:hold`.");
  }

  await ledger.exercise(request.subscriber, UsycFund.Subscribe, fund.contractId, {
    subscriber: request.subscriber,
    rateCid: rate.contractId as ContractId<RateIndex>,
    // The CIP-56 view gives us the same contract id as our Holding template.
    usdcCids: inputs.map((input) => input.contractId as ContractId<Holding>),
    usdcAmount: request.usdcAmount,
  });
}
