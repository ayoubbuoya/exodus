// The market life cycle after the split: claim YT yield, mature the market,
// redeem PT, and the Operator's settlement of every payout.
//
// Payouts come from the Operator's vault in two steps (spec sections 8.3 to 8.6):
//
//   1. the owner asks        requestClaim / requestPtRedeem / requestMerge (markets.ts)
//                            -> the tokens go into a ClaimRequest / RedeemRequest /
//                               MergeRequest at once, so they cannot be spent twice
//   2. the Operator settles  settleMarketRequests (the API's settlement loop)
//                            -> USYC from the vault to the owner
//   until then, the owner can cancel: cancelClaim / cancelPtRedeem / cancelMerge
//
// Why two steps: clients cannot see the vault, and two payouts at the same
// moment would fight over the same vault holding (UTXO contention). Same
// pattern as the fund's USYC redeem (redeem.ts), but for market tokens.
//
// Example (spec section 9):
//   Jan 1  Bank requestClaim(1000 YT @1.00)  -> settle at 1.025 pays 24.390243 USYC
//   Apr 1  the Operator matures the market   -> MaturitySnapshot(index 1.05)
//          Alice requestPtRedeem(500 PT)     -> settle at 1.05 pays 476.190476 USYC
import type { ContractId } from "@daml/types";
import { exerciseCommand, type LedgerClient } from "./client.ts";
import { decimalToUnits, unitsToDecimal } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import { previewClaim, previewMerge, previewPtRedeem } from "./market-math.ts";
import {
  getMarketRate,
  getMarkets,
  getMaturitySnapshot,
  hasReachedMaturity,
  requireMarket,
  requireOwnPass,
} from "./markets.ts";
import { getOwnedHoldings, isRateValid, type Contract, type Disclosable } from "./queries.ts";
import { getPrincipalTokens, getYieldTokens, isFreePt, mergePtPieces, mergeYtPieces } from "./tokens.ts";
import {
  ClaimRequest,
  Market,
  MergeRequest,
  PrincipalToken,
  PtRedeemRequest,
  YieldToken,
  type ClientAccess,
  type Holding,
  type IndexSource,
  type MarketTerms,
  type MaturitySnapshot,
  type RateIndex,
} from "./templates.ts";

// ---------------------------------------------------------------------------
// Client side: ask, list, cancel
// ---------------------------------------------------------------------------

export type MarketTokenInput = {
  owner: string; // full party id
  operator: string; // the market's operator
  marketId: string; // for example "PT-USYC-APR2027"
};

// Claims the yield of ALL the owner's YT of one market, in one transaction.
// Works before maturity (paid at the live price) and after it (the final
// claim, paid up to the maturity index; the YT is then used up).
//
// Pieces with the same lastIndex are joined first, because every payout is
// rounded down to 6 decimals PER REQUEST: claiming 1000 YT in one piece never
// pays less than claiming it as 600 + 400. Pieces with different lastIndex
// cannot be joined, so each gets its own ClaimRequest.
export async function requestClaim(ledger: LedgerClient, input: MarketTokenInput): Promise<void> {
  await requireMarket(ledger, input.operator, input.marketId);
  const access = await requireOwnPass(ledger, input.owner, input.operator, "claim");
  await mergeYtPieces(ledger, input.owner, input.marketId);
  const yts = await getYieldTokens(ledger, input.owner, input.marketId);
  if (yts.length === 0) {
    throw new Error("You hold no YT of this market.");
  }
  const accessCid = access.contractId as ContractId<ClientAccess>;
  await ledger.submitCommands(
    input.owner,
    yts.map((yt) => exerciseCommand(YieldToken.YT_RequestClaim, yt.contractId, { accessCid })),
  );
}

// Redeems ALL the owner's free PT of a matured market.
// Why all: after maturity a PT earns nothing, so there is no reason to keep
// some. A redeem pays roundDown6 (ptAmount / index at settle time) USYC, so
// 1 PT is always worth 1 USD (previewPtRedeem).
//
// The free pieces are joined into one PT first, because rounding happens per
// request. Example at index 1.05: 500 PT in one piece pays 476.190476 USYC,
// but 400 + 100 PT would pay 380.952380 + 95.238095 = 476.190475.
//
// The MaturitySnapshot proves the market has matured. Clients cannot see it:
// we read it as the Operator and disclose it.
export async function requestPtRedeem(ledger: LedgerClient, input: MarketTokenInput): Promise<void> {
  const snapshot = await getMaturitySnapshot(ledger, input.operator, input.marketId);
  if (snapshot === null) {
    throw new Error("This market has not matured yet: PT can be redeemed after maturity. Before that, sell it or merge it with YT.");
  }
  const access = await requireOwnPass(ledger, input.owner, input.operator, "redeem");
  await mergePtPieces(ledger, input.owner, input.marketId);
  const pts = (await getPrincipalTokens(ledger, input.owner, input.marketId)).filter(isFreePt);
  if (pts.length === 0) {
    throw new Error("You hold no free PT of this market (PT locked in a quote does not count).");
  }
  const accessCid = access.contractId as ContractId<ClientAccess>;
  const snapshotCid = snapshot.contractId as ContractId<MaturitySnapshot>;
  await ledger.submitCommands(
    input.owner,
    pts.map((pt) => exerciseCommand(PrincipalToken.PT_RequestRedeem, pt.contractId, { accessCid, snapshotCid })),
    { disclosedContracts: [snapshot.disclosure] },
  );
}

// The open requests `party` can see, oldest first.
//   As a client:     only its own requests.
//   As the Operator: every open request (the settlement queue).
export async function getClaimRequests(ledger: LedgerClient, party: string): Promise<Contract<ClaimRequest>[]> {
  return readRequests(ledger, party, ClaimRequest);
}

export async function getPtRedeemRequests(ledger: LedgerClient, party: string): Promise<Contract<PtRedeemRequest>[]> {
  return readRequests(ledger, party, PtRedeemRequest);
}

export async function getMergeRequests(ledger: LedgerClient, party: string): Promise<Contract<MergeRequest>[]> {
  return readRequests(ledger, party, MergeRequest);
}

async function readRequests<T extends { requestedAt: string }>(
  ledger: LedgerClient,
  party: string,
  template: { templateId: string; decoder: { runWithException: (value: unknown) => T } },
): Promise<Contract<T>[]> {
  const events = await ledger.getActiveContracts(party, {
    TemplateFilter: { value: { templateId: template.templateId } },
  });
  const requests = events.map((event) => ({
    contractId: event.contractId,
    payload: template.decoder.runWithException(event.createArgument),
  }));
  requests.sort((a, b) => Date.parse(a.payload.requestedAt) - Date.parse(b.payload.requestedAt));
  return requests;
}

// The owner takes back the YT of an open claim. Fails once it is settled.
export async function cancelClaim(ledger: LedgerClient, owner: string, requestId: string): Promise<void> {
  const request = await requireOwnRequest(await getClaimRequests(ledger, owner), owner, requestId);
  await ledger.exercise(owner, ClaimRequest.Claim_Cancel, request.contractId, {});
}

// The owner takes back the PT of an open redeem.
export async function cancelPtRedeem(ledger: LedgerClient, owner: string, requestId: string): Promise<void> {
  const request = await requireOwnRequest(await getPtRedeemRequests(ledger, owner), owner, requestId);
  await ledger.exercise(owner, PtRedeemRequest.Redeem_Cancel, request.contractId, {});
}

// The owner takes back the PT and the YT of an open merge.
export async function cancelMerge(ledger: LedgerClient, owner: string, requestId: string): Promise<void> {
  const request = await requireOwnRequest(await getMergeRequests(ledger, owner), owner, requestId);
  await ledger.exercise(owner, MergeRequest.Merge_Cancel, request.contractId, {});
}

function requireOwnRequest<T extends { owner: string }>(requests: Contract<T>[], owner: string, requestId: string): Contract<T> {
  const request = requests.find((candidate) => candidate.contractId === requestId && candidate.payload.owner === owner);
  if (request === undefined) {
    throw new Error("No open request with this id. It may already be paid or cancelled.");
  }
  return request;
}

// ---------------------------------------------------------------------------
// Operator side: mature and settle (called by the API's operator bot)
// ---------------------------------------------------------------------------

export type MaturedMarket = {
  marketId: string;
  index: string; // the frozen index, for example "1.0500000000"
  simTime: string; // the demo date of that price
};

// Matures every market whose maturity date the demo clock has reached.
//
// It uses the newest price, which is the first price on or after maturity as
// long as the bot runs often (decision Q1, like Pendle's firstPYIndex).
// Example: the oracle publishes Apr 1 2027 at 1.05 -> Mature -> MaturitySnapshot(1.05).
export async function matureDueMarkets(ledger: LedgerClient, operator: string): Promise<MaturedMarket[]> {
  const matured: MaturedMarket[] = [];
  for (const market of await getMarkets(ledger, operator)) {
    if (market.payload.matured) {
      continue;
    }
    const rate = await getMarketRate(ledger, operator, market.payload.terms);
    if (rate === null || !isRateValid(rate.payload) || !hasReachedMaturity(rate.payload, market.payload.terms)) {
      continue;
    }
    await ledger.exercise(operator, Market.Mature, market.contractId, {
      rateCid: rate.contractId as ContractId<RateIndex>,
    });
    matured.push({
      marketId: market.payload.terms.marketId,
      index: rate.payload.index,
      simTime: rate.payload.simTime,
    });
  }
  return matured;
}

export type MarketRequestKind = "CLAIM" | "PT_REDEEM" | "MERGE";

// One request the settlement paid.
export type SettledMarketRequest = {
  kind: MarketRequestKind;
  requestId: string;
  owner: string;
  marketId: string;
  usycPaid: string; // for example "24.3902430000"; "0.0000000000" for a claim when the index did not move
  index: string | null; // the index used; null for a merge (it needs no price)
};

// One request the settlement could not pay this time. It stays open: the
// next run tries again, and the owner can still cancel it.
export type SkippedMarketRequest = {
  kind: MarketRequestKind;
  requestId: string;
  owner: string;
  reason: string; // for example "Waiting for the market to mature"
};

export type MarketSettleReport = {
  matured: MaturedMarket[];
  settled: SettledMarketRequest[];
  skipped: SkippedMarketRequest[];
};

// One open request, of any kind, for the queue.
type QueuedRequest =
  | { kind: "CLAIM"; request: Contract<ClaimRequest> }
  | { kind: "PT_REDEEM"; request: Contract<PtRedeemRequest> }
  | { kind: "MERGE"; request: Contract<MergeRequest> };

// The Operator's settlement run:
//   1. mature every market that is due (so after-maturity claims can be paid);
//   2. pay every open claim, PT redeem and merge, OLDEST FIRST across all three
//      kinds, from the Operator's USYC vault.
//
// Which index each kind uses:
//   claim before maturity  the live price       (CurrentRate)
//   claim after maturity   the maturity index   (AtMaturity: yield stops at maturity)
//   PT redeem              the live price       (1 PT = 1 USD at the settle moment)
//   merge                  none: amount / lastIndex
//
// A problem with one request is reported in `skipped`; the run goes on.
export async function settleMarketRequests(ledger: LedgerClient, operator: string): Promise<MarketSettleReport> {
  const matured = await matureDueMarkets(ledger, operator);
  const report: MarketSettleReport = { matured, settled: [], skipped: [] };

  const queue: QueuedRequest[] = [
    ...(await getClaimRequests(ledger, operator)).map((request) => ({ kind: "CLAIM" as const, request })),
    ...(await getPtRedeemRequests(ledger, operator)).map((request) => ({ kind: "PT_REDEEM" as const, request })),
    ...(await getMergeRequests(ledger, operator)).map((request) => ({ kind: "MERGE" as const, request })),
  ].filter((item) => item.request.payload.operator === operator);
  queue.sort((a, b) => Date.parse(a.request.payload.requestedAt) - Date.parse(b.request.payload.requestedAt));

  for (const item of queue) {
    try {
      report.settled.push(await settleOne(ledger, operator, item));
    } catch (error) {
      report.skipped.push({
        kind: item.kind,
        requestId: item.request.contractId,
        owner: item.request.payload.owner,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return report;
}

async function settleOne(ledger: LedgerClient, operator: string, item: QueuedRequest): Promise<SettledMarketRequest> {
  const { terms, owner } = item.request.payload;
  const base = { kind: item.kind, requestId: item.request.contractId, owner, marketId: terms.marketId };

  if (item.kind === "MERGE") {
    const usycPaid = previewMerge(item.request.payload.amount, item.request.payload.lastIndex);
    const vaultCids = await pickVault(ledger, operator, terms, usycPaid);
    await ledger.exercise(operator, MergeRequest.Merge_Settle, item.request.contractId, { vaultCids });
    return { ...base, usycPaid, index: null };
  }

  if (item.kind === "PT_REDEEM") {
    const rate = await requireLiveRate(ledger, operator, terms);
    const usycPaid = previewPtRedeem(item.request.payload.ptAmount, rate.payload.index);
    const vaultCids = await pickVault(ledger, operator, terms, usycPaid);
    await ledger.exercise(operator, PtRedeemRequest.Redeem_Settle, item.request.contractId, {
      rateCid: rate.contractId as ContractId<RateIndex>,
      vaultCids,
    });
    return { ...base, usycPaid, index: rate.payload.index };
  }

  // CLAIM: the live price before maturity, the snapshot after.
  const { amount, lastIndex } = item.request.payload;
  const snapshot = await getMaturitySnapshot(ledger, operator, terms.marketId);
  let indexSource: IndexSource;
  let index: string;
  if (snapshot !== null) {
    // The Operator signs the snapshot, so it needs no disclosure here.
    indexSource = { tag: "AtMaturity", value: snapshot.contractId as ContractId<MaturitySnapshot> };
    index = snapshot.payload.index;
  } else {
    const rate = await requireLiveRate(ledger, operator, terms);
    if (hasReachedMaturity(rate.payload, terms)) {
      // The market is due but not matured yet (Mature failed above, or the
      // price arrived just now). The next run matures it first.
      throw new Error("Waiting for the market to mature");
    }
    indexSource = { tag: "CurrentRate", value: rate.contractId as ContractId<RateIndex> };
    index = rate.payload.index;
  }
  const usycPaid = previewClaim(amount, lastIndex, index);
  const vaultCids = await pickVault(ledger, operator, terms, usycPaid);
  await ledger.exercise(operator, ClaimRequest.Claim_Settle, item.request.contractId, { indexSource, vaultCids });
  return { ...base, usycPaid, index };
}

// The newest valid price for the market, as the Operator, or an error.
async function requireLiveRate(ledger: LedgerClient, operator: string, terms: MarketTerms): Promise<Disclosable<RateIndex>> {
  const rate = await getMarketRate(ledger, operator, terms);
  if (rate === null || !isRateValid(rate.payload)) {
    throw new Error("No valid USYC price right now. Is the oracle bot running?");
  }
  return rate;
}

// The Operator's vault holdings to pay `amount` USYC from. Re-read for every
// request, because the previous payout spent some holdings and made change.
// "0" (a claim with nothing to pay) needs no inputs.
//
// We pick for 0.000001 more than the preview, as a safety net: the previews
// copy Daml's rounding, but a wrong input pick would only fail the settle.
// The contract pays the exact amount and gives the rest back as change.
async function pickVault(
  ledger: LedgerClient,
  operator: string,
  terms: MarketTerms,
  amount: string,
): Promise<ContractId<Holding>[]> {
  if (decimalToUnits(amount) === 0n) {
    return [];
  }
  const owned = await getOwnedHoldings(ledger, operator);
  const vault = owned.filter(
    (holding) => holding.payload.instrumentId.id === terms.instrument && holding.payload.instrumentId.admin === terms.assetIssuer,
  );
  const withMargin = unitsToDecimal(decimalToUnits(amount) + decimalToUnits("0.000001"));
  let inputs;
  try {
    inputs = pickInputs(vault, withMargin, terms.instrument);
  } catch {
    // The margin itself may be what is missing (the very last payout of a vault).
    try {
      inputs = pickInputs(vault, amount, terms.instrument);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`The vault is short: ${detail}`);
    }
  }
  return inputs.map((input) => input.contractId as ContractId<Holding>);
}
