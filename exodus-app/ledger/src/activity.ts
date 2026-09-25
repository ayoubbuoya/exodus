// A party's token activity ("Received 100 USDC", "Subscribed ...", "Sent 10 USYC"),
// rebuilt from the ledger's transaction history.
//
// How: we read every transaction that created or archived one of the party's
// Holding contracts, and add up, per transaction, how much of each token the
// party gained or lost. Example transactions for Alice:
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
import type { CreatedEvent, LedgerClient, Transaction } from "./client.ts";
import { decimalToUnits, unitsToDecimal } from "./decimal.ts";
import { Holding, sameTemplateId, UsycRedeemRequest } from "./templates.ts";

export type ActivityKind =
  | "RECEIVED"
  | "SENT"
  | "SUBSCRIBED"
  | "REDEEM_REQUESTED"
  | "REDEEMED"
  | "REDEEM_CANCELLED"
  | "OTHER";

export type ActivityRow = {
  updateId: string; // the ledger's transaction id
  kind: ActivityKind;
  // Ledger time of the transaction (real time, not the demo clock).
  at: string;
  // Net change per token, for example { USDC: "-40", USYC: "39.920159" }.
  changes: Record<string, string>;
};

type KnownHolding = { instrument: string; units: bigint };

// Newest first, at most `limit` rows.
export async function getHoldingActivity(ledger: LedgerClient, party: string, limit = 50): Promise<ActivityRow[]> {
  const transactions = await ledger.getTransactions(party, [
    { TemplateFilter: { value: { templateId: Holding.templateId, includeCreatedEventBlob: false } } },
    { TemplateFilter: { value: { templateId: UsycRedeemRequest.templateId, includeCreatedEventBlob: false } } },
  ]);

  const known = new Map<string, KnownHolding>();
  const rows: ActivityRow[] = [];
  for (const transaction of transactions) {
    const changes = netChanges(transaction, party, known);
    if (changes.size > 0) {
      rows.push(toRow(transaction, changes, redeemStepOf(transaction)));
    }
  }
  return rows.reverse().slice(0, limit);
}

// How much of each token `party` gained (+) or lost (-) in one transaction, in
// Daml units (1 unit = 0.0000000001). Tokens with no net change are left out.
function netChanges(transaction: Transaction, party: string, known: Map<string, KnownHolding>): Map<string, bigint> {
  const totals = new Map<string, bigint>();
  const add = (instrument: string, units: bigint) => totals.set(instrument, (totals.get(instrument) ?? 0n) + units);

  for (const event of transaction.events) {
    if ("CreatedEvent" in event) {
      // Redeem request events are only used to name the row (redeemStepOf).
      if (!isHolding(event.CreatedEvent)) {
        continue;
      }
      const holding = Holding.decoder.runWithException(event.CreatedEvent.createArgument);
      if (holding.owner !== party) {
        continue;
      }
      const units = decimalToUnits(holding.amount);
      known.set(event.CreatedEvent.contractId, { instrument: holding.instrument, units });
      add(holding.instrument, units);
    } else if ("ArchivedEvent" in event) {
      const holding = known.get(event.ArchivedEvent.contractId);
      if (holding !== undefined) {
        add(holding.instrument, -holding.units);
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

function isHolding(event: CreatedEvent): boolean {
  return sameTemplateId(event.templateId, Holding.templateId);
}

// Which redeem step a transaction is, if any:
//   "REQUESTED" - it created a UsycRedeemRequest
//   "CLOSED"    - it archived one (the fund paid it, or the owner cancelled it)
//   null        - not a redeem
type RedeemStep = "REQUESTED" | "CLOSED" | null;

function redeemStepOf(transaction: Transaction): RedeemStep {
  for (const event of transaction.events) {
    if ("CreatedEvent" in event && sameTemplateId(event.CreatedEvent.templateId, UsycRedeemRequest.templateId)) {
      return "REQUESTED";
    }
    if ("ArchivedEvent" in event && sameTemplateId(event.ArchivedEvent.templateId, UsycRedeemRequest.templateId)) {
      return "CLOSED";
    }
  }
  return null;
}

function toRow(transaction: Transaction, changes: Map<string, bigint>, redeemStep: RedeemStep): ActivityRow {
  const changesAsText: Record<string, string> = {};
  for (const [instrument, units] of changes) {
    changesAsText[instrument] = unitsToDecimal(units);
  }
  return {
    updateId: transaction.updateId,
    kind: classify(changes, redeemStep),
    at: transaction.effectiveAt,
    changes: changesAsText,
  };
}

// Paid USDC and got USYC in the same transaction -> a fund subscription.
// Redeem steps are named from the request events (see redeemStepOf).
// Otherwise: only gains -> received; only losses -> sent.
function classify(changes: Map<string, bigint>, redeemStep: RedeemStep): ActivityKind {
  const usdc = changes.get("USDC") ?? 0n;
  const usyc = changes.get("USYC") ?? 0n;
  if (usdc < 0n && usyc > 0n) {
    return "SUBSCRIBED";
  }
  if (redeemStep === "REQUESTED" && usyc < 0n) {
    return "REDEEM_REQUESTED";
  }
  if (redeemStep === "CLOSED" && usdc > 0n) {
    return "REDEEMED";
  }
  if (redeemStep === "CLOSED" && usyc > 0n) {
    return "REDEEM_CANCELLED";
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
