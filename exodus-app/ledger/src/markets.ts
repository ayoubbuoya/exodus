// Exodus markets (the Pendle part): read markets, split USYC into PT + YT,
// and merge PT + YT back into USYC.
//
// This is the PRODUCT. The USYC fund (subscribe.ts / redeem.ts) is only the
// simulated on-ramp that gives a client USYC, the yield-bearing token that
// markets split.
//
// Example (spec section 9, step 1): Bank splits 1000 USYC at index 1.00 in
// PT-USYC-APR2027 and gets 1000 PT + 1000 YT. The USYC goes to the
// Operator's vault.
//
// WHO READS WHAT (decision D1 in docs/markets-plan.md): clients cannot see the
// Market, the MaturitySnapshot or the price. The Operator signs the first two
// and observes every price snapshot, so we read all three AS THE OPERATOR and
// attach them to the client's command through explicit disclosure, like the
// UsycFund.
import type { ContractId } from "@daml/types";
import { isStaleContractError, type LedgerClient } from "./client.ts";
import { decimalToUnits, hasAtMost6Decimals } from "./decimal.ts";
import { pickInputs } from "./inputs.ts";
import {
  getClientAccess,
  getDisclosable,
  getOwnedHoldings,
  getRateSnapshots,
  isRateValid,
  pickNewestRate,
  type Disclosable,
} from "./queries.ts";
import { getPrincipalTokens, getYieldTokens, isFreePt, mergePtPieces, mergeYtPieces } from "./tokens.ts";
import {
  Market,
  MaturitySnapshot,
  PrincipalToken,
  type ClientAccess,
  type Holding,
  type MarketTerms,
  type RateIndex,
  type YieldToken,
} from "./templates.ts";

// The one demo market bootstrap creates (decision D4). It matures on
// DEMO_MATURITY (Apr 1 2027), the end of the oracle's demo schedule.
export const DEMO_MARKET_ID = "PT-USYC-APR2027";

// Every market, read as the Operator (the only party that sees them), sorted by id.
export async function getMarkets(ledger: LedgerClient, operator: string): Promise<Disclosable<Market>[]> {
  const markets = await getDisclosable(ledger, operator, Market);
  const own = markets.filter((market) => market.payload.operator === operator);
  own.sort((a, b) => a.payload.terms.marketId.localeCompare(b.payload.terms.marketId));
  return own;
}

// One market by id, or null. There is only ever one active contract per id:
// 'Mature' archives the market and re-creates it with matured = True.
export async function getMarket(ledger: LedgerClient, operator: string, marketId: string): Promise<Disclosable<Market> | null> {
  const markets = await getMarkets(ledger, operator);
  return markets.find((market) => market.payload.terms.marketId === marketId) ?? null;
}

// Reads a market or fails with a message a user understands.
export async function requireMarket(ledger: LedgerClient, operator: string, marketId: string): Promise<Disclosable<Market>> {
  const market = await getMarket(ledger, operator, marketId);
  if (market === null) {
    throw new Error(`No market "${marketId}". Run \`npm run bootstrap\`.`);
  }
  return market;
}

// The frozen index of a matured market, read as the Operator, or null before
// maturity. Example after Mature on Apr 1 2027: { payload: { index: "1.0500000000", ... } }.
export async function getMaturitySnapshot(
  ledger: LedgerClient,
  operator: string,
  marketId: string,
): Promise<Disclosable<MaturitySnapshot> | null> {
  const snapshots = await getDisclosable(ledger, operator, MaturitySnapshot);
  return (
    snapshots.find((snapshot) => snapshot.payload.operator === operator && snapshot.payload.terms.marketId === marketId) ??
    null
  );
}

// The newest price snapshot that THIS market accepts (its oracle and asset),
// read as `reader` (the Operator, which observes every snapshot), or null.
// It may be expired: check with isRateValid.
export async function getMarketRate(
  ledger: LedgerClient,
  reader: string,
  terms: MarketTerms,
): Promise<Disclosable<RateIndex> | null> {
  const snapshots = await getRateSnapshots(ledger, reader);
  const forMarket = snapshots.filter(
    (snapshot) => snapshot.payload.oracle === terms.oracle && snapshot.payload.instrument === terms.instrument,
  );
  return pickNewestRate(forMarket);
}

// Like getMarketRate, but fails with a clear message when there is no valid price.
export async function requireMarketRate(
  ledger: LedgerClient,
  reader: string,
  terms: MarketTerms,
): Promise<Disclosable<RateIndex>> {
  const rate = await getMarketRate(ledger, reader, terms);
  if (rate === null || !isRateValid(rate.payload)) {
    throw new Error("No valid USYC price right now. Start the oracle bot: `npm run oracle` or `npm run oracle:hold`.");
  }
  return rate;
}

// True once the oracle's demo clock has reached the market's maturity date.
export function hasReachedMaturity(rate: RateIndex, terms: MarketTerms): boolean {
  return Date.parse(rate.simTime) >= Date.parse(terms.maturity);
}

// The client's own access pass from `operator`, or a clear error.
export async function requireOwnPass(
  ledger: LedgerClient,
  client: string,
  operator: string,
  action: string,
): Promise<Disclosable<ClientAccess>> {
  const access = await getClientAccess(ledger, client, client);
  if (access === null || access.payload.operator !== operator) {
    throw new Error(`This party is not an approved Exodus client (no access pass), so it cannot ${action}.`);
  }
  return access;
}

// Checks an amount typed by a user: > 0 and at most 6 decimals, like every token.
export function checkTokenAmount(amount: string, what: string): void {
  if (decimalToUnits(amount) === 0n) {
    throw new Error(`${what} must be greater than 0`);
  }
  if (!hasAtMost6Decimals(amount)) {
    throw new Error(`${what} can have at most 6 decimals`);
  }
}

// Runs `action` and, if a contract it used was archived meanwhile, reads
// again and retries ONCE (same safety net as subscribeUsyc). Returns true
// when the retry was needed. Example: a split at the very moment the Operator
// calls Mature (which re-creates the Market) retries and then gets the clear
// "market has matured" error.
export async function withOneRetry(action: () => Promise<void>): Promise<{ retried: boolean }> {
  try {
    await action();
    return { retried: false };
  } catch (error) {
    if (!isStaleContractError(error)) {
      throw error;
    }
    await action();
    return { retried: true };
  }
}

// ---------------------------------------------------------------------------
// Split: USYC in, PT + YT out.
// ---------------------------------------------------------------------------

export type SplitRequest = {
  splitter: string; // full party id, for example "Bank::1220ab..."
  operator: string; // the market's operator; we read the market and the price as this party
  marketId: string; // for example "PT-USYC-APR2027"
  usycAmount: string; // decimal string with at most 6 decimals, for example "1000"
};

// Splits USYC into PT + YT. At index 1.025, 1000 USYC -> 1025 PT + 1025 YT
// (preview it with previewSplit).
export async function splitUsyc(ledger: LedgerClient, request: SplitRequest): Promise<{ retried: boolean }> {
  checkTokenAmount(request.usycAmount, "USYC amount");
  return withOneRetry(() => splitOnce(ledger, request));
}

async function splitOnce(ledger: LedgerClient, request: SplitRequest): Promise<void> {
  // 1. The market, read by the Operator (clients cannot see it).
  const market = await requireMarket(ledger, request.operator, request.marketId);
  const terms = market.payload.terms;
  if (market.payload.matured) {
    throw new Error("This market has matured: no new PT or YT can be made.");
  }

  // 2. The splitter's own pass.
  const access = await requireOwnPass(ledger, request.splitter, request.operator, "split");

  // 3. USYC to pay with. Only USYC from the market's issuer counts.
  const owned = await getOwnedHoldings(ledger, request.splitter);
  const usycHoldings = owned.filter(
    (holding) => holding.payload.instrumentId.id === terms.instrument && holding.payload.instrumentId.admin === terms.assetIssuer,
  );
  const inputs = pickInputs(usycHoldings, request.usycAmount, terms.instrument);

  // 4. The price, read last (it expires after 30 s). The contract refuses a
  //    split once the demo clock reaches maturity; we say it first.
  const rate = await requireMarketRate(ledger, request.operator, terms);
  if (hasReachedMaturity(rate.payload, terms)) {
    throw new Error("This market has reached its maturity date: no new PT or YT can be made.");
  }

  // 5. Split as the client, with the market and the price disclosed.
  await ledger.exercise(
    request.splitter,
    Market.Split,
    market.contractId,
    {
      splitter: request.splitter,
      accessCid: access.contractId as ContractId<ClientAccess>,
      rateCid: rate.contractId as ContractId<RateIndex>,
      usycCids: inputs.map((input) => input.contractId as ContractId<Holding>),
      usycAmount: request.usycAmount,
    },
    { disclosedContracts: [market.disclosure, rate.disclosure] },
  );
}

// ---------------------------------------------------------------------------
// Merge: PT + YT back into USYC, before maturity only (decision Q1).
// ---------------------------------------------------------------------------

export type MergeInput = {
  owner: string; // full party id
  operator: string; // the market's operator
  marketId: string;
  amount: string; // how much PT AND YT to merge, for example "100"
};

// Asks the vault to turn `amount` PT + `amount` YT back into USYC. The
// tokens go into a MergeRequest at once; the Operator's settlement loop pays
// roundDown6 (amount / lastIndex) USYC a few seconds later (previewMerge).
// Example: 100 PT + 100 YT with lastIndex 1.025 -> 97.560975 USYC.
//
// If the PT or the YT is spread over several pieces, they are joined first
// (mergePtPieces / mergeYtPieces). YT pieces with different lastIndex cannot
// be joined: then the owner must claim first, which gives them all the newest
// lastIndex.
export async function requestMerge(ledger: LedgerClient, input: MergeInput): Promise<{ retried: boolean }> {
  checkTokenAmount(input.amount, "Merge amount");
  return withOneRetry(() => requestMergeOnce(ledger, input));
}

async function requestMergeOnce(ledger: LedgerClient, input: MergeInput): Promise<void> {
  const market = await requireMarket(ledger, input.operator, input.marketId);
  const terms = market.payload.terms;
  const access = await requireOwnPass(ledger, input.owner, input.operator, "merge");
  const wanted = decimalToUnits(input.amount);

  // 1. One free PT big enough (join the pieces if needed).
  let pt = await findPtCovering(ledger, input.owner, input.marketId, wanted);
  if (pt === null) {
    await mergePtPieces(ledger, input.owner, input.marketId);
    pt = await findPtCovering(ledger, input.owner, input.marketId, wanted);
  }
  if (pt === null) {
    throw new Error("Not enough free PT to merge (PT locked in a quote does not count).");
  }

  // 2. One YT big enough (join pieces with the same lastIndex if needed).
  let yt = await findYtCovering(ledger, input.owner, input.marketId, wanted);
  if (yt === null) {
    await mergeYtPieces(ledger, input.owner, input.marketId);
    yt = await findYtCovering(ledger, input.owner, input.marketId, wanted);
  }
  if (yt === null) {
    throw new Error("Not enough YT in one piece to merge. If your YT pieces have different lastIndex, claim your yield first.");
  }

  // 3. The price, only to prove we are still before maturity.
  const rate = await requireMarketRate(ledger, input.operator, terms);
  if (hasReachedMaturity(rate.payload, terms)) {
    throw new Error("This market has reached its maturity date: redeem the PT and claim the YT instead of merging.");
  }

  await ledger.exercise(
    input.owner,
    PrincipalToken.PT_RequestMerge,
    pt.contractId,
    {
      ytCid: yt.contractId as ContractId<YieldToken>,
      mergeAmount: input.amount,
      accessCid: access.contractId as ContractId<ClientAccess>,
      rateCid: rate.contractId as ContractId<RateIndex>,
    },
    { disclosedContracts: [rate.disclosure] },
  );
}

// The biggest free PT piece if it covers `units`, else null.
async function findPtCovering(ledger: LedgerClient, owner: string, marketId: string, units: bigint) {
  const pieces = (await getPrincipalTokens(ledger, owner, marketId)).filter(isFreePt);
  return biggestCovering(pieces, units);
}

// The biggest YT piece if it covers `units`, else null.
async function findYtCovering(ledger: LedgerClient, owner: string, marketId: string, units: bigint) {
  return biggestCovering(await getYieldTokens(ledger, owner, marketId), units);
}

function biggestCovering<T extends { contractId: string; payload: { amount: string } }>(pieces: T[], units: bigint): T | null {
  let biggest: T | null = null;
  for (const piece of pieces) {
    if (biggest === null || decimalToUnits(piece.payload.amount) > decimalToUnits(biggest.payload.amount)) {
      biggest = piece;
    }
  }
  if (biggest === null || decimalToUnits(biggest.payload.amount) < units) {
    return null;
  }
  return biggest;
}
