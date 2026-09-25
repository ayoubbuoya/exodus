// Redeem simulated USYC back into simulated USDC, in two steps (spec gap 13).
//
//   1. requestUsycRedeem  (as the client)  Alice burns 100 USYC and opens a UsycRedeemRequest.
//   2. settleUsycRedeems  (as UsycIssuer)  the fund pays each open request at the
//                                          price of that moment: at index 1.03,
//                                          100 USYC -> 103 USDC.
//   cancelUsycRedeem      (as the client)  before step 2, Alice gets her 100 USYC back.
//
// Why two steps: a redeem spends the FUND's USDC. If every client spent it
// directly, two redeems at the same moment would fight over the same fund
// holding, and clients would see the fund's cash. So only the fund's own
// settlement loop (in the API) spends it, one request after the other.
//
// "USYC" and "USDC" are SIMULATED tokens issued by our demo issuer parties,
// not by Circle.
import type { ContractId } from "@daml/types";
import { isStaleContractError, type LedgerClient } from "./client.ts";
import { decimalToUnits, hasAtMost6Decimals, multiplyRoundDown6, unitsToDecimal } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import { getClientAccess, getOwnedHoldings, getRateIndex, getUsycFund, isRateValid, type Contract } from "./queries.ts";
import { UsycFund, UsycRedeemRequest, type ClientAccess, type Holding, type RateIndex } from "./templates.ts";

export type RedeemRequestInput = {
  redeemer: string; // full party id, for example "Alice::1220ab..."
  usycIssuer: string; // the fund's issuer; we read the fund as this party
  usycAmount: string; // decimal string with at most 6 decimals, for example "100"
};

// `retried` is true when the first try hit a stale contract and the second worked.
export type RedeemRequestOutcome = {
  retried: boolean;
};

// Step 1: Alice asks to redeem. Her USYC is burned at once; the USDC comes
// when the fund settles (usually within a few seconds).
//
// Like subscribeUsyc, we retry ONCE on a stale-contract error, for example
// when Alice clicks twice and both commands pick the same USYC holding.
export async function requestUsycRedeem(ledger: LedgerClient, request: RedeemRequestInput): Promise<RedeemRequestOutcome> {
  if (decimalToUnits(request.usycAmount) === 0n) {
    throw new Error("Amount must be greater than 0");
  }
  if (!hasAtMost6Decimals(request.usycAmount)) {
    throw new Error("USYC amounts can have at most 6 decimals");
  }

  try {
    await requestOnce(ledger, request);
    return { retried: false };
  } catch (error) {
    if (!isStaleContractError(error)) {
      throw error;
    }
    await requestOnce(ledger, request);
    return { retried: true };
  }
}

async function requestOnce(ledger: LedgerClient, request: RedeemRequestInput): Promise<void> {
  // 1. The fund, read by its issuer (clients cannot see it).
  const fund = await getUsycFund(ledger, request.usycIssuer);
  if (fund === null) {
    throw new Error("No USYC fund found. Run `npm run bootstrap`.");
  }

  // 2. The redeemer's own access pass, from the fund's operator.
  const access = await getClientAccess(ledger, request.redeemer, request.redeemer);
  if (access === null || access.payload.operator !== fund.payload.operator) {
    throw new Error("This party is not an approved Exodus client (no access pass), so it cannot redeem.");
  }

  // 3. The USYC to redeem. Only USYC from this fund counts.
  const owned = await getOwnedHoldings(ledger, request.redeemer);
  const usycHoldings = owned.filter(
    (holding) => holding.payload.instrumentId.id === "USYC" && holding.payload.instrumentId.admin === request.usycIssuer,
  );
  const inputs = pickInputs(usycHoldings, request.usycAmount, "USYC");

  // 4. Request as Alice, with the fund attached (disclosed). No price is
  //    needed here: the fund uses the price at settle time.
  await ledger.exercise(
    request.redeemer,
    UsycFund.RequestRedeem,
    fund.contractId,
    {
      redeemer: request.redeemer,
      accessCid: access.contractId as ContractId<ClientAccess>,
      usycCids: inputs.map((input) => input.contractId as ContractId<Holding>),
      usycAmount: request.usycAmount,
    },
    { disclosedContracts: [fund.disclosure] },
  );
}

// The open redeem requests `party` can see, oldest first.
//   As Alice:      only her own requests.
//   As UsycIssuer: every open request (the settlement queue).
// Example: [{ contractId: "00d1...", payload: { owner: Alice, usycAmount: "100.0000000000",
//                                               requestedAt: "2026-09-25T10:00:00Z", ... } }]
export async function getRedeemRequests(ledger: LedgerClient, party: string): Promise<Contract<UsycRedeemRequest>[]> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: UsycRedeemRequest.templateId } },
  });
  const requests = events.map((event) => ({
    contractId: event.contractId,
    payload: UsycRedeemRequest.decoder.runWithException(event.createArgument),
  }));
  requests.sort((a, b) => Date.parse(a.payload.requestedAt) - Date.parse(b.payload.requestedAt));
  return requests;
}

// Alice cancels one of her open requests and gets her USYC back.
// Fails if the fund has already settled it (then the request is gone).
export async function cancelUsycRedeem(ledger: LedgerClient, owner: string, requestId: string): Promise<void> {
  const requests = await getRedeemRequests(ledger, owner);
  const request = requests.find((candidate) => candidate.contractId === requestId && candidate.payload.owner === owner);
  if (request === undefined) {
    throw new Error("No open redeem request with this id. It may already be paid or cancelled.");
  }
  await ledger.exercise(owner, UsycRedeemRequest.Cancel, request.contractId, {});
}

// One request the settlement loop paid.
export type SettledRedeem = {
  requestId: string;
  owner: string;
  usycAmount: string;
  usdcAmount: string; // what the contract paid, for example "103.0000000000"
  index: string; // the price used, for example "1.0300000000"
};

// One request the loop could not pay this time. It stays open: the loop
// tries again on its next run, and the owner can still cancel it.
export type SkippedRedeem = {
  requestId: string;
  owner: string;
  reason: string; // for example "The fund is short: Not enough USDC: you have 50, you need 102.5"
};

export type SettleReport = {
  settled: SettledRedeem[];
  skipped: SkippedRedeem[];
};

// Step 2: the fund (UsycIssuer) pays every open request, oldest first.
// Called by the API's settlement loop every few seconds.
//
// Example at index 1.03 with requests for 100 USYC (Alice) and 50 USYC (Bank):
//   -> Alice gets 103 USDC, Bank gets 51.5 USDC, both requests are archived.
//
// Throws only when NOTHING can be settled right now (no valid price); a
// problem with one request is reported in `skipped` and the loop goes on.
export async function settleUsycRedeems(ledger: LedgerClient, usycIssuer: string): Promise<SettleReport> {
  const report: SettleReport = { settled: [], skipped: [] };
  const requests = await getRedeemRequests(ledger, usycIssuer);
  const fundRequests = requests.filter((request) => request.payload.usycIssuer === usycIssuer);
  if (fundRequests.length === 0) {
    return report;
  }

  let rate = await readValidRate(ledger, usycIssuer);
  for (const request of fundRequests) {
    // A long queue can outlive the 30 s price window: read a fresh one if needed.
    if (!isRateValid(rate.payload)) {
      rate = await readValidRate(ledger, usycIssuer);
    }

    try {
      const usdcAmount = await settleOne(ledger, usycIssuer, request, rate);
      report.settled.push({
        requestId: request.contractId,
        owner: request.payload.owner,
        usycAmount: request.payload.usycAmount,
        usdcAmount,
        index: rate.payload.index,
      });
    } catch (error) {
      report.skipped.push({
        requestId: request.contractId,
        owner: request.payload.owner,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return report;
}

// The newest price snapshot, as UsycIssuer (a reader). Throws if it has expired.
async function readValidRate(ledger: LedgerClient, usycIssuer: string): Promise<Contract<RateIndex>> {
  const rate = await getRateIndex(ledger, usycIssuer);
  if (rate === null || !isRateValid(rate.payload)) {
    throw new Error("No valid USYC price right now, so no redeem can be settled. Is the oracle bot running?");
  }
  return rate;
}

// Pays one request. Returns the USDC amount paid.
async function settleOne(
  ledger: LedgerClient,
  usycIssuer: string,
  request: Contract<UsycRedeemRequest>,
  rate: Contract<RateIndex>,
): Promise<string> {
  // Same formula as the contract: roundDown6 (usycAmount * index).
  const usdcAmount = multiplyRoundDown6(request.payload.usycAmount, rate.payload.index);

  // The fund's USDC, re-read for every request: the previous Settle spent
  // some holdings and created change.
  const owned = await getOwnedHoldings(ledger, usycIssuer);
  const fundUsdc = owned.filter(
    (holding) =>
      holding.payload.instrumentId.id === "USDC" && holding.payload.instrumentId.admin === request.payload.usdcIssuer,
  );

  // We pick inputs for 0.000001 USDC more than our estimate. Daml rounds the
  // product to 10 decimals BEFORE roundDown6, so in rare cases the contract
  // pays 0.000001 more than our exact bigint maths. The contract gives any
  // extra back to the fund as change.
  const withMargin = unitsToDecimal(decimalToUnits(usdcAmount) + decimalToUnits("0.000001"));
  let inputs: Contract<unknown>[];
  try {
    inputs = pickInputs(fundUsdc, withMargin, "USDC");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`The fund is short: ${detail}`);
  }

  await ledger.exercise(usycIssuer, UsycRedeemRequest.Settle, request.contractId, {
    rateCid: rate.contractId as ContractId<RateIndex>,
    usdcCids: inputs.map((input) => input.contractId as ContractId<Holding>),
  });
  return usdcAmount;
}
