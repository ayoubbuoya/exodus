// Unit tests for getHoldingActivity: turning ledger transactions into
// "Received / Subscribed / Sent" rows. We feed it hand-made transactions
// through a fake ledger client, so no sandbox is needed.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHoldingActivity } from "./activity.ts";
import type { LedgerClient, Transaction } from "./client.ts";
import { Holding, UsycRedeemRequest } from "./templates.ts";

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
