// A party's token activity ("Received 100 USDC", "Subscribed ...", "Sent 10 USYC"),
// rebuilt from the ledger's transaction history.
//
// How: we read every transaction that created or archived one of the party's
// Holding, PT or YT contracts (or a request holding them), and add up, per
// transaction, how much of each token the party gained or lost. Example
// transactions for Alice:
//
//   faucet mint          created USDC 100                       -> USDC +100
//   subscribe 40 USDC    archived USDC 100, created USDC 60,
//                        created USYC 39.920159                 -> USDC -40, USYC +39.920159
//   send 10 USYC         archived USYC 39.920159, created 29.920159 -> USYC -10
//   merge two holdings   archived 10 + 5, created 15            -> nothing changed, not shown
//
// An archive event does not repeat the contract's payload, so we remember every
// holding we saw created (the history starts at the beginning of the ledger,
// so the party's holdings are always created before they are archived).
//
// We cannot tell a faucet mint from a transfer by another client: the receiver
// only sees the new holding in both cases, so both show as "Received".
//
// Redeems (USYC back to USDC) take two transactions. We also read the
// UsycRedeemRequest events, so we can name them instead of showing
// "Sent 100 USYC" and later "Received 103 USDC":
//
//   request 100 USYC     archived USYC, created a request     -> USYC -100      REDEEM_REQUESTED
//   fund settles         archived the request, created USDC   -> USDC +103      REDEEMED
//   Alice cancels        archived the request, created USYC   -> USYC +100      REDEEM_CANCELLED
//
// MARKET TOKENS (PT and YT, the Pendle part) are counted too, under their
// symbols, for example "PT-USYC-APR2027" and "YT-USYC-APR2027":
//
//   Bank splits 1000 USYC     USYC -1000, PT +1000, YT +1000            SPLIT
//   Alice buys 500 PT         USDC -487.5, PT +500                      BOUGHT_PT
//   Alice sells 200 PT        PT -200, USDC +197                        SOLD_PT
//   Bank's claim is settled   USYC +24.390243                           CLAIMED
//   Alice's PT redeem settled PT -500, USYC +476.190476                 REDEEMED_PT
//   Bank's merge is settled   PT -100, YT -100, USYC +100               MERGED
//
// Unlike the fund's USYC redeem (where the USYC is really burned), PT and YT
// inside the owner's OPEN claim / redeem / merge request still count as the
// owner's (decision in docs/markets-plan.md, Phase 5). So asking and
// cancelling change nothing and show no row; only the settled result shows.
// Open requests are listed separately (getClaimRequests & co. in lifecycle.ts).
// Example: Bank's claim request moves 1000 YT into a ClaimRequest (net 0, no
// row); the settlement archives the request and gives back 1000 YT plus
// 24.390243 USYC (net USYC +24.390243: CLAIMED).
import type { CreatedEvent, LedgerClient, Transaction } from "./client.ts";
import { decimalToUnits, unitsToDecimal } from "./decimal.ts";
import { marketSymbols } from "./market-math.ts";
import {
  ClaimRequest,
  Holding,
  MergeRequest,
  PrincipalToken,
  PtRedeemRequest,
  sameTemplateId,
  UsycRedeemRequest,
  YieldToken,
} from "./templates.ts";

export type ActivityKind =
  | "RECEIVED"
  | "SENT"
  // The USYC fund (the simulated on-ramp).
  | "SUBSCRIBED"
  | "REDEEM_REQUESTED"
  | "REDEEMED"
  | "REDEEM_CANCELLED"
  // The markets (PT and YT).
  | "SPLIT"
  | "BOUGHT_PT"
  | "SOLD_PT"
  | "CLAIMED"
  | "REDEEMED_PT"
  | "MERGED"
  | "OTHER";

export type ActivityRow = {
  updateId: string; // the ledger's transaction id
  kind: ActivityKind;
  // Ledger time of the transaction (real time, not the demo clock).
  at: string;
  // Net change per token, for example { USDC: "-40", USYC: "39.920159" }
  // or { USYC: "-1000", "PT-USYC-APR2027": "1000", "YT-USYC-APR2027": "1000" }.
  changes: Record<string, string>;
};

// What one contract adds to the party's balance: a token symbol and an amount
// in units. A MergeRequest holds two tokens (PT and YT), so it is a list.
type KnownPosition = { symbol: string; units: bigint };

// The templates whose events we read. Every one of them either holds tokens
// of the party or names a step (the fund's redeem request).
const ACTIVITY_TEMPLATES = [
  Holding,
  UsycRedeemRequest,
  PrincipalToken,
  YieldToken,
  ClaimRequest,
  PtRedeemRequest,
  MergeRequest,
];

// Newest first, at most `limit` rows.
export async function getHoldingActivity(ledger: LedgerClient, party: string, limit = 50): Promise<ActivityRow[]> {
  const transactions = await ledger.getTransactions(
    party,
    ACTIVITY_TEMPLATES.map((template) => ({
      TemplateFilter: { value: { templateId: template.templateId, includeCreatedEventBlob: false } },
    })),
  );

  const known = new Map<string, KnownPosition[]>();
  const rows: ActivityRow[] = [];
  for (const transaction of transactions) {
    const changes = netChanges(transaction, party, known);
    if (changes.size > 0) {
      rows.push(toRow(transaction, changes, stepOf(transaction)));
    }
  }
  return rows.reverse().slice(0, limit);
}

// How much of each token `party` gained (+) or lost (-) in one transaction, in
// Daml units (1 unit = 0.0000000001). Tokens with no net change are left out.
function netChanges(transaction: Transaction, party: string, known: Map<string, KnownPosition[]>): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  const add = (symbol: string, units: bigint) => totals.set(symbol, (totals.get(symbol) ?? 0n) + units);

  for (const event of transaction.events) {
    if ("CreatedEvent" in event) {
      const positions = positionsOf(event.CreatedEvent, party);
      if (positions.length === 0) {
        continue;
      }
      known.set(event.CreatedEvent.contractId, positions);
      for (const position of positions) {
        add(position.symbol, position.units);
      }
    } else if ("ArchivedEvent" in event) {
      for (const position of known.get(event.ArchivedEvent.contractId) ?? []) {
        add(position.symbol, -position.units);
      }
    }
  }

  for (const [instrument, units] of totals) {
    if (units === 0n) {
      totals.delete(instrument);
    }
  }
  return totals;
}

// What a created contract adds to `party`'s balance (empty if nothing):
//   Holding of the party              -> its instrument, for example USDC 100
//   PrincipalToken / YieldToken       -> PT-... / YT-... amount
//   ClaimRequest / PT RedeemRequest   -> the YT / PT inside (still the owner's, see the top)
//   MergeRequest                      -> the PT AND the YT inside
//   UsycRedeemRequest                 -> nothing: that USYC is burned
// Only contracts OWNED by the party count. Alice also sees the PT Bank locked
// for her in a quote, but it is Bank's until she accepts.
function positionsOf(event: CreatedEvent, party: string): KnownPosition[] {
  const templateId = event.templateId;
  if (sameTemplateId(templateId, Holding.templateId)) {
    const holding = Holding.decoder.runWithException(event.createArgument);
    return holding.owner === party ? [{ symbol: holding.instrument, units: decimalToUnits(holding.amount) }] : [];
  }
  if (sameTemplateId(templateId, PrincipalToken.templateId)) {
    const pt = PrincipalToken.decoder.runWithException(event.createArgument);
    return pt.owner === party ? [{ symbol: marketSymbols(pt.terms.marketId).pt, units: decimalToUnits(pt.amount) }] : [];
  }
  if (sameTemplateId(templateId, YieldToken.templateId)) {
    const yt = YieldToken.decoder.runWithException(event.createArgument);
    return yt.owner === party ? [{ symbol: marketSymbols(yt.terms.marketId).yt, units: decimalToUnits(yt.amount) }] : [];
  }
  if (sameTemplateId(templateId, ClaimRequest.templateId)) {
    const request = ClaimRequest.decoder.runWithException(event.createArgument);
    return request.owner === party
      ? [{ symbol: marketSymbols(request.terms.marketId).yt, units: decimalToUnits(request.amount) }]
      : [];
  }
  if (sameTemplateId(templateId, PtRedeemRequest.templateId)) {
    const request = PtRedeemRequest.decoder.runWithException(event.createArgument);
    return request.owner === party
      ? [{ symbol: marketSymbols(request.terms.marketId).pt, units: decimalToUnits(request.ptAmount) }]
      : [];
  }
  if (sameTemplateId(templateId, MergeRequest.templateId)) {
    const request = MergeRequest.decoder.runWithException(event.createArgument);
    if (request.owner !== party) {
      return [];
    }
    const symbols = marketSymbols(request.terms.marketId);
    const units = decimalToUnits(request.amount);
    return [
      { symbol: symbols.pt, units },
      { symbol: symbols.yt, units },
    ];
  }
  return [];
}

// Which request step a transaction is, if any. Used to name the row.
//   USYC_REDEEM_REQUESTED  it created a UsycRedeemRequest
//   USYC_REDEEM_CLOSED     it archived one (the fund paid it, or the owner cancelled it)
//   CLAIM_CLOSED           it archived a ClaimRequest     (settled; a cancel shows no row)
//   PT_REDEEM_CLOSED       it archived a PT RedeemRequest (settled)
//   MERGE_CLOSED           it archived a MergeRequest     (settled)
//   null                   none of these
type Step =
  | "USYC_REDEEM_REQUESTED"
  | "USYC_REDEEM_CLOSED"
  | "CLAIM_CLOSED"
  | "PT_REDEEM_CLOSED"
  | "MERGE_CLOSED"
  | null;

function stepOf(transaction: Transaction): Step {
  for (const event of transaction.events) {
    if ("CreatedEvent" in event && sameTemplateId(event.CreatedEvent.templateId, UsycRedeemRequest.templateId)) {
      return "USYC_REDEEM_REQUESTED";
    }
    if ("ArchivedEvent" in event) {
      const templateId = event.ArchivedEvent.templateId;
      if (sameTemplateId(templateId, UsycRedeemRequest.templateId)) {
        return "USYC_REDEEM_CLOSED";
      }
      if (sameTemplateId(templateId, ClaimRequest.templateId)) {
        return "CLAIM_CLOSED";
      }
      if (sameTemplateId(templateId, PtRedeemRequest.templateId)) {
        return "PT_REDEEM_CLOSED";
      }
      if (sameTemplateId(templateId, MergeRequest.templateId)) {
        return "MERGE_CLOSED";
      }
    }
  }
  return null;
}

function toRow(transaction: Transaction, changes: Map<string, bigint>, step: Step): ActivityRow {
  const changesAsText: Record<string, string> = {};
  for (const [symbol, units] of changes) {
    changesAsText[symbol] = unitsToDecimal(units);
  }
  return {
    updateId: transaction.updateId,
    kind: classify(changes, step),
    at: transaction.effectiveAt,
    changes: changesAsText,
  };
}

// The net change of all PT (or all YT) symbols in a row, for example the sum
// of "PT-USYC-APR2027" and "PT-USYC-JUL2027".
function sumWithPrefix(changes: Map<string, bigint>, prefix: string): bigint {
  let total = 0n;
  for (const [symbol, units] of changes) {
    if (symbol.startsWith(prefix)) {
      total += units;
    }
  }
  return total;
}

// Names a row from its step (settled requests) and its net changes:
//   paid USDC, got USYC                  -> a fund subscription
//   paid USYC, got PT and YT             -> a split
//   paid USDC, got PT / gave PT, got USDC -> an RFQ trade
//   otherwise only gains -> received; only losses -> sent.
function classify(changes: Map<string, bigint>, step: Step): ActivityKind {
  const usdc = changes.get("USDC") ?? 0n;
  const usyc = changes.get("USYC") ?? 0n;
  const pt = sumWithPrefix(changes, "PT-");
  const yt = sumWithPrefix(changes, "YT-");

  // Market payouts, named from the request the Operator settled.
  if (step === "CLAIM_CLOSED") {
    return "CLAIMED";
  }
  if (step === "PT_REDEEM_CLOSED") {
    return "REDEEMED_PT";
  }
  if (step === "MERGE_CLOSED") {
    return "MERGED";
  }

  // The USYC fund.
  if (usdc < 0n && usyc > 0n) {
    return "SUBSCRIBED";
  }
  if (step === "USYC_REDEEM_REQUESTED" && usyc < 0n) {
    return "REDEEM_REQUESTED";
  }
  if (step === "USYC_REDEEM_CLOSED" && usdc > 0n) {
    return "REDEEMED";
  }
  if (step === "USYC_REDEEM_CLOSED" && usyc > 0n) {
    return "REDEEM_CANCELLED";
  }

  // The markets.
  if (usyc < 0n && pt > 0n && yt > 0n) {
    return "SPLIT";
  }
  if (usdc < 0n && pt > 0n) {
    return "BOUGHT_PT";
  }
  if (usdc > 0n && pt < 0n) {
    return "SOLD_PT";
  }

  const values = [...changes.values()];
  if (values.every((units) => units > 0n)) {
    return "RECEIVED";
  }
  if (values.every((units) => units < 0n)) {
    return "SENT";
  }
  return "OTHER";
}
