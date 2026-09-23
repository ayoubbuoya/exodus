// Unit tests for getHoldingActivity: turning ledger transactions into
// "Received / Subscribed / Sent" rows. We feed it hand-made transactions
// through a fake ledger client, so no sandbox is needed.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getHoldingActivity } from "./activity.ts";
import type { LedgerClient, Transaction } from "./client.ts";
import { Holding } from "./templates.ts";

const ALICE = "client-alice::1220aa";
const BOB = "client-bob::1220bb";
const USDC_ISSUER = "UsdcIssuer::1220cc";
const USYC_ISSUER = "UsycIssuer::1220dd";

type HoldingEvent =
  | { created: string; owner: string; instrument: string; amount: string }
  | { archived: string };

// Builds a transaction from a short list of created / archived holdings.
function transaction(updateId: string, events: HoldingEvent[]): Transaction {
  return {
    updateId,
    effectiveAt: `2026-09-23T10:00:0${updateId}Z`,
    offset: Number(updateId),
    synchronizerId: "sync",
    events: events.map((event) => {
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
});
