// Unit tests for getHoldingActivity: turning ledger transactions into
// "Received / Subscribed / Sent" rows. We feed it hand-made transactions
// through a fake ledger client, so no sandbox is needed.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHoldingActivity } from "./activity.ts";
import type { LedgerClient, Transaction } from "./client.ts";
import { ClaimRequest, Holding, MergeRequest, PrincipalToken, PtRedeemRequest, UsycRedeemRequest, YieldToken } from "./templates.ts";

const ALICE = "client-alice::1220aa";
const BOB = "client-bob::1220bb";
const USDC_ISSUER = "UsdcIssuer::1220cc";
const USYC_ISSUER = "UsycIssuer::1220dd";

type HoldingEvent =
  | { created: string; owner: string; instrument: string; amount: string }
  | { archived: string }
  // A UsycRedeemRequest created or archived in the same transaction.
  | { redeemRequestCreated: string }
  | { redeemRequestArchived: string };

// Builds a transaction from a short list of created / archived holdings.
function transaction(updateId: string, events: HoldingEvent[]): Transaction {
  return {
    updateId,
    effectiveAt: `2026-09-23T10:00:0${updateId}Z`,
    offset: Number(updateId),
    synchronizerId: "sync",
    events: events.map((event) => {
      if ("redeemRequestCreated" in event) {
        // getHoldingActivity only reads the template id of request events.
        return { CreatedEvent: { contractId: event.redeemRequestCreated, templateId: UsycRedeemRequest.templateId } };
      }
      if ("redeemRequestArchived" in event) {
        return { ArchivedEvent: { contractId: event.redeemRequestArchived, templateId: UsycRedeemRequest.templateId } };
      }
      if ("created" in event) {
        const issuer = event.instrument === "USDC" ? USDC_ISSUER : USYC_ISSUER;
        return {
          CreatedEvent: {
            contractId: event.created,
            templateId: Holding.templateId,
            createArgument: { issuer, owner: event.owner, instrument: event.instrument, amount: event.amount },
          },
        };
      }
      return { ArchivedEvent: { contractId: event.archived, templateId: Holding.templateId } };
    }),
  } as unknown as Transaction;
}

// A LedgerClient stand-in: getHoldingActivity only calls getTransactions.
function fakeLedger(transactions: Transaction[]): LedgerClient {
  return { getTransactions: async () => transactions } as unknown as LedgerClient;
}

// Alice's history, oldest first.
const HISTORY = [
  // 1. Faucet: 100 USDC minted to Alice.
  transaction("1", [{ created: "usdc-100", owner: ALICE, instrument: "USDC", amount: "100.0" }]),
  // 2. Subscribe 40 USDC at 1.002: her 100 USDC is spent, 60 comes back as change, she gets USYC.
  transaction("2", [
    { archived: "usdc-100" },
    { created: "usdc-60", owner: ALICE, instrument: "USDC", amount: "60.0" },
    { created: "usdc-40-fund", owner: USYC_ISSUER, instrument: "USDC", amount: "40.0" },
    { created: "usyc-39", owner: ALICE, instrument: "USYC", amount: "39.920159" },
  ]),
  // 3. Send 10 USYC to Bob: Alice keeps 29.920159 as change. (Bob's new holding
  //    is not visible to Alice on the real ledger; here it tests the owner filter.)
  transaction("3", [
    { archived: "usyc-39" },
    { created: "usyc-29", owner: ALICE, instrument: "USYC", amount: "29.920159" },
    { created: "usyc-10-bob", owner: BOB, instrument: "USYC", amount: "10.0" },
  ]),
  // 4. Bob sends Alice 5 USDC (she only sees her new holding).
  transaction("4", [
    { created: "usdc-5", owner: ALICE, instrument: "USDC", amount: "5.0" },
  ]),
  // 5. Merge: her 60 + 5 USDC become one 65 USDC holding -> same total, no row.
  transaction("5", [
    { archived: "usdc-60" },
    { archived: "usdc-5" },
    { created: "usdc-65", owner: ALICE, instrument: "USDC", amount: "65.0" },
  ]),
];

describe("getHoldingActivity", () => {
  it("builds one row per transaction that changed Alice's balances, newest first", async () => {
    const rows = await getHoldingActivity(fakeLedger(HISTORY), ALICE);
    assert.deepEqual(
      rows.map((row) => ({ updateId: row.updateId, kind: row.kind, changes: row.changes })),
      [
        { updateId: "4", kind: "RECEIVED", changes: { USDC: "5.0000000000" } },
        { updateId: "3", kind: "SENT", changes: { USYC: "-10.0000000000" } },
        { updateId: "2", kind: "SUBSCRIBED", changes: { USDC: "-40.0000000000", USYC: "39.9201590000" } },
        { updateId: "1", kind: "RECEIVED", changes: { USDC: "100.0000000000" } },
      ],
    );
  });

  it("leaves out transactions with no net change (the merge)", async () => {
    const rows = await getHoldingActivity(fakeLedger(HISTORY), ALICE);
    assert.equal(
      rows.some((row) => row.updateId === "5"),
      false,
    );
  });

  it("keeps only the newest `limit` rows", async () => {
    const rows = await getHoldingActivity(fakeLedger(HISTORY), ALICE, 2);
    assert.deepEqual(
      rows.map((row) => row.updateId),
      ["4", "3"],
    );
  });

  it("returns nothing for a party with no history", async () => {
    assert.deepEqual(await getHoldingActivity(fakeLedger([]), ALICE), []);
  });

  it("names the redeem steps from the request events", async () => {
    const redeemHistory = [
      transaction("1", [{ created: "usyc-150", owner: ALICE, instrument: "USYC", amount: "150.0" }]),
      // Alice redeems 100 of her 150 USYC: burned, 50 change, request created.
      transaction("2", [
        { archived: "usyc-150" },
        { created: "usyc-50", owner: ALICE, instrument: "USYC", amount: "50.0" },
        { redeemRequestCreated: "request-100" },
      ]),
      // The fund settles at 1.03: the request is archived, Alice gets 103 USDC.
      transaction("3", [
        { redeemRequestArchived: "request-100" },
        { created: "usdc-103", owner: ALICE, instrument: "USDC", amount: "103.0" },
      ]),
      // A second request for 50 USYC, then Alice cancels it and gets the 50 back.
      transaction("4", [{ archived: "usyc-50" }, { redeemRequestCreated: "request-50" }]),
      transaction("5", [
        { redeemRequestArchived: "request-50" },
        { created: "usyc-50-back", owner: ALICE, instrument: "USYC", amount: "50.0" },
      ]),
    ];
    const rows = await getHoldingActivity(fakeLedger(redeemHistory), ALICE);
    assert.deepEqual(
      rows.map((row) => ({ updateId: row.updateId, kind: row.kind, changes: row.changes })),
      [
        { updateId: "5", kind: "REDEEM_CANCELLED", changes: { USYC: "50.0000000000" } },
        { updateId: "4", kind: "REDEEM_REQUESTED", changes: { USYC: "-50.0000000000" } },
        { updateId: "3", kind: "REDEEMED", changes: { USDC: "103.0000000000" } },
        { updateId: "2", kind: "REDEEM_REQUESTED", changes: { USYC: "-100.0000000000" } },
        { updateId: "1", kind: "RECEIVED", changes: { USYC: "150.0000000000" } },
      ],
    );
  });
});

// ---------------------------------------------------------------------------
// Market tokens (PT and YT)
// ---------------------------------------------------------------------------

const BANK = "Bank::1220ee";
const OPERATOR = "Operator::1220ff";
const PT = "PT-USYC-APR2027";
const YT = "YT-USYC-APR2027";
const TERMS = {
  marketId: PT,
  assetIssuer: USYC_ISSUER,
  instrument: "USYC",
  oracle: "Oracle::1220aa",
  maturity: "2027-04-01T00:00:00Z",
};
const AT = "2026-09-25T10:00:00Z";

// Market events: tokens and requests created or archived.
type MarketEvent =
  | { holding: string; owner: string; instrument: string; amount: string }
  | { pt: string; owner: string; amount: string; lockedFor?: string }
  | { yt: string; owner: string; amount: string; lastIndex: string }
  | { claimRequest: string; owner: string; amount: string }
  | { ptRedeemRequest: string; owner: string; ptAmount: string }
  | { mergeRequest: string; owner: string; amount: string }
  | { archived: string; templateId: string };

function created(contractId: string, templateId: string, createArgument: unknown) {
  return { CreatedEvent: { contractId, templateId, createArgument } };
}

function marketTransaction(updateId: string, events: MarketEvent[]): Transaction {
  return {
    updateId,
    effectiveAt: `2026-09-25T10:00:0${updateId}Z`,
    offset: Number(updateId),
    synchronizerId: "sync",
    events: events.map((event) => {
      if ("archived" in event) {
        return { ArchivedEvent: { contractId: event.archived, templateId: event.templateId } };
      }
      if ("holding" in event) {
        const issuer = event.instrument === "USDC" ? USDC_ISSUER : USYC_ISSUER;
        return created(event.holding, Holding.templateId, { issuer, owner: event.owner, instrument: event.instrument, amount: event.amount });
      }
      if ("pt" in event) {
        const lock = event.lockedFor === undefined ? null : { holder: event.lockedFor, lockedUntil: AT };
        return created(event.pt, PrincipalToken.templateId, { operator: OPERATOR, owner: event.owner, terms: TERMS, amount: event.amount, lock });
      }
      if ("yt" in event) {
        return created(event.yt, YieldToken.templateId, {
          operator: OPERATOR, owner: event.owner, terms: TERMS, amount: event.amount, lastIndex: event.lastIndex,
        });
      }
      if ("claimRequest" in event) {
        return created(event.claimRequest, ClaimRequest.templateId, {
          operator: OPERATOR, owner: event.owner, terms: TERMS, amount: event.amount, lastIndex: "1.0", requestedAt: AT,
        });
      }
      if ("ptRedeemRequest" in event) {
        return created(event.ptRedeemRequest, PtRedeemRequest.templateId, {
          operator: OPERATOR, owner: event.owner, terms: TERMS, ptAmount: event.ptAmount, maturityIndex: "1.05", requestedAt: AT,
        });
      }
      return created(event.mergeRequest, MergeRequest.templateId, {
        operator: OPERATOR, owner: event.owner, terms: TERMS, amount: event.amount, lastIndex: "1.025", requestedAt: AT,
      });
    }),
  } as unknown as Transaction;
}

const archivedPt = (contractId: string) => ({ archived: contractId, templateId: PrincipalToken.templateId });
const archivedYt = (contractId: string) => ({ archived: contractId, templateId: YieldToken.templateId });
const archivedHolding = (contractId: string) => ({ archived: contractId, templateId: Holding.templateId });

// Bank's side of the spec section 9 demo, oldest first.
const BANK_HISTORY = [
  marketTransaction("1", [{ holding: "usyc-1000", owner: BANK, instrument: "USYC", amount: "1000.0" }]),
  // Split 1000 USYC at 1.00: the USYC goes to the Operator's vault.
  marketTransaction("2", [
    archivedHolding("usyc-1000"),
    { holding: "vault-1000", owner: OPERATOR, instrument: "USYC", amount: "1000.0" },
    { pt: "pt-1000", owner: BANK, amount: "1000.0" },
    { yt: "yt-1000", owner: BANK, amount: "1000.0", lastIndex: "1.0" },
  ]),
  // Quote to Alice: 500 PT split off and locked for her. Still Bank's: no row.
  marketTransaction("3", [
    archivedPt("pt-1000"),
    { pt: "pt-500", owner: BANK, amount: "500.0" },
    { pt: "pt-500-locked", owner: BANK, amount: "500.0", lockedFor: ALICE },
  ]),
  // Alice accepts: the locked PT goes to her, 487.5 USDC to Bank.
  marketTransaction("4", [
    archivedPt("pt-500-locked"),
    { pt: "pt-500-alice", owner: ALICE, amount: "500.0" },
    { holding: "usdc-487", owner: BANK, instrument: "USDC", amount: "487.5" },
  ]),
  // Claim request: the YT moves into the request. Still Bank's: no row.
  marketTransaction("5", [archivedYt("yt-1000"), { claimRequest: "claim-1", owner: BANK, amount: "1000.0" }]),
  // Settled at 1.025: the YT comes back with the new lastIndex, plus the yield.
  marketTransaction("6", [
    { archived: "claim-1", templateId: ClaimRequest.templateId },
    { yt: "yt-1000-b", owner: BANK, amount: "1000.0", lastIndex: "1.025" },
    { holding: "usyc-24", owner: BANK, instrument: "USYC", amount: "24.390243" },
  ]),
  // Merge 100 PT + 100 YT: both go into the request, the rest is change. No row.
  marketTransaction("7", [
    archivedPt("pt-500"),
    archivedYt("yt-1000-b"),
    { mergeRequest: "merge-1", owner: BANK, amount: "100.0" },
    { pt: "pt-400", owner: BANK, amount: "400.0" },
    { yt: "yt-900", owner: BANK, amount: "900.0", lastIndex: "1.025" },
  ]),
  // Settled: 100 / 1.025 = 97.560975 USYC.
  marketTransaction("8", [
    { archived: "merge-1", templateId: MergeRequest.templateId },
    { holding: "usyc-97", owner: BANK, instrument: "USYC", amount: "97.560975" },
  ]),
  // A second claim, then Bank cancels it: nothing changed, so no rows.
  marketTransaction("9", [archivedYt("yt-900"), { claimRequest: "claim-2", owner: BANK, amount: "900.0" }]),
];
BANK_HISTORY.push(
  marketTransaction("10", [
    { archived: "claim-2", templateId: ClaimRequest.templateId },
    { yt: "yt-900-back", owner: BANK, amount: "900.0", lastIndex: "1.025" },
  ]),
);

describe("getHoldingActivity with market tokens", () => {
  it("shows Bank's split, sale, claim and merge; requests and cancels add no rows", async () => {
    const rows = await getHoldingActivity(fakeLedger(BANK_HISTORY), BANK);
    assert.deepEqual(
      rows.map((row) => ({ updateId: row.updateId, kind: row.kind, changes: row.changes })),
      [
        { updateId: "8", kind: "MERGED", changes: { [PT]: "-100.0000000000", [YT]: "-100.0000000000", USYC: "97.5609750000" } },
        { updateId: "6", kind: "CLAIMED", changes: { USYC: "24.3902430000" } },
        { updateId: "4", kind: "SOLD_PT", changes: { [PT]: "-500.0000000000", USDC: "487.5000000000" } },
        { updateId: "2", kind: "SPLIT", changes: { USYC: "-1000.0000000000", [PT]: "1000.0000000000", [YT]: "1000.0000000000" } },
        { updateId: "1", kind: "RECEIVED", changes: { USYC: "1000.0000000000" } },
      ],
    );
  });

  it("shows Alice's purchase and PT redeem, and ignores Bank's PT locked for her", async () => {
    const aliceHistory = [
      marketTransaction("1", [{ holding: "usdc-1000", owner: ALICE, instrument: "USDC", amount: "1000.0" }]),
      // Alice sees the PT Bank locked for her, but it is Bank's: no row.
      marketTransaction("2", [{ pt: "pt-500-locked", owner: BANK, amount: "500.0", lockedFor: ALICE }]),
      // She accepts: pays 487.5 of her 1000 USDC and gets the 500 PT.
      marketTransaction("3", [
        archivedHolding("usdc-1000"),
        { holding: "usdc-512", owner: ALICE, instrument: "USDC", amount: "512.5" },
        { holding: "usdc-487-bank", owner: BANK, instrument: "USDC", amount: "487.5" },
        archivedPt("pt-500-locked"),
        { pt: "pt-500", owner: ALICE, amount: "500.0" },
      ]),
      // After maturity she redeems: the PT moves into the request (no row) ...
      marketTransaction("4", [archivedPt("pt-500"), { ptRedeemRequest: "redeem-1", owner: ALICE, ptAmount: "500.0" }]),
      // ... and the settlement at 1.05 pays 476.190476 USYC.
      marketTransaction("5", [
        { archived: "redeem-1", templateId: PtRedeemRequest.templateId },
        { holding: "usyc-476", owner: ALICE, instrument: "USYC", amount: "476.190476" },
      ]),
    ];
    const rows = await getHoldingActivity(fakeLedger(aliceHistory), ALICE);
    assert.deepEqual(
      rows.map((row) => ({ updateId: row.updateId, kind: row.kind, changes: row.changes })),
      [
        { updateId: "5", kind: "REDEEMED_PT", changes: { [PT]: "-500.0000000000", USYC: "476.1904760000" } },
        { updateId: "3", kind: "BOUGHT_PT", changes: { USDC: "-487.5000000000", [PT]: "500.0000000000" } },
        { updateId: "1", kind: "RECEIVED", changes: { USDC: "1000.0000000000" } },
      ],
    );
  });
});
