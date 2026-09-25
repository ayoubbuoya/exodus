// Subscribe to the simulated USYC fund: pay USDC, get USYC in one atomic step.
//
// Example at index 1.025:
//   subscribeUsyc(ledger, { subscriber: alice, usycIssuer, usdcAmount: "500" })
//   -> Alice pays 500 USDC to UsycIssuer and gets 487.804878 USYC.
//
// Alice cannot see the fund or the price snapshot (privacy: no client list on
// shared contracts). So we read both AS UsycIssuer and attach them to Alice's
// command through explicit disclosure. Alice's own access pass proves she is
// an approved client; the contract checks it.
//
// Spec gap 12 (stale RateIndex id) is fixed in the contract: price snapshots
// stay usable for 30 s, even after a newer one is published. We still retry
// ONCE on a stale-contract error as a safety net, for example when two
// subscribes by the same user race for the same USDC holding.
import type { ContractId } from "@daml/types";
import { isStaleContractError, type LedgerClient } from "./client.ts";
import { decimalToUnits } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import { getClientAccess, getOwnedHoldings, getRateIndex, getUsycFund, isRateValid } from "./queries.ts";
import { UsycFund, type ClientAccess, type Holding, type RateIndex } from "./templates.ts";

export type SubscribeRequest = {
  subscriber: string; // full party id, for example "Alice::1220ab..."
  usycIssuer: string; // the fund's issuer; we read the fund and the price as this party
  usdcAmount: string; // decimal string, for example "500"
};

// What happened, for the UI. `retried` is true when the first try hit a
// stale contract and the second try worked.
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
    // Someone changed a contract we used. Read again and retry once.
    await subscribeOnce(ledger, request);
    return { retried: true };
  }
}

async function subscribeOnce(ledger: LedgerClient, request: SubscribeRequest): Promise<void> {
  // 1. The fund, read by its issuer (clients cannot see it).
  const fund = await getUsycFund(ledger, request.usycIssuer);
  if (fund === null) {
    throw new Error("No USYC fund found. Run `npm run bootstrap`.");
  }

  // 2. The subscriber's own access pass, from the fund's operator.
  const access = await getClientAccess(ledger, request.subscriber, request.subscriber);
  if (access === null || access.payload.operator !== fund.payload.operator) {
    throw new Error("This party is not an approved Exodus client (no access pass), so it cannot subscribe.");
  }

  // 3. USDC to pay with. Only USDC from the fund's accepted issuer counts.
  const owned = await getOwnedHoldings(ledger, request.subscriber);
  const usdcHoldings = owned.filter(
    (holding) =>
      holding.payload.instrumentId.id === "USDC" && holding.payload.instrumentId.admin === fund.payload.usdcIssuer,
  );
  const inputs = pickInputs(usdcHoldings, request.usdcAmount, "USDC");

  // 4. The newest price snapshot, read last and by the fund's issuer (a reader).
  //    It stays usable for its whole window (30 s), even if the oracle
  //    publishes a newer one meanwhile.
  const rate = await getRateIndex(ledger, request.usycIssuer);
  if (rate === null) {
    throw new Error("No USYC price found. The fund's issuer must be a reader of the price feed.");
  }
  if (!isRateValid(rate.payload)) {
    throw new Error("No valid USYC price right now. Start the oracle bot: `npm run oracle` or `npm run oracle:hold`.");
  }

  // 5. Subscribe as Alice, with the fund and the price attached (disclosed).
  await ledger.exercise(
    request.subscriber,
    UsycFund.Subscribe,
    fund.contractId,
    {
      subscriber: request.subscriber,
      accessCid: access.contractId as ContractId<ClientAccess>,
      rateCid: rate.contractId as ContractId<RateIndex>,
      // The CIP-56 view gives us the same contract id as our Holding template.
      usdcCids: inputs.map((input) => input.contractId as ContractId<Holding>),
      usdcAmount: request.usdcAmount,
    },
    { disclosedContracts: [fund.disclosure, rate.disclosure] },
  );
}
