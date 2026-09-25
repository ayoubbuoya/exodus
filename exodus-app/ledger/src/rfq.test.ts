// Unit tests for the pure RFQ helpers (no ledger needed).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Contract } from "./queries.ts";
import { isQuoteLive, setAsideUsdcIds } from "./rfq.ts";
import type { Quote } from "./templates.ts";

const BANK = "Bank::1220ee";
const OTHER_DEALER = "Dealer2::1220ff";

// A quote with just the fields the helpers read.
function quote(contractId: string, dealer: string, dealerUsdcCid: string | null, validUntil = "2026-09-25T10:01:00Z"): Contract<Quote> {
  return { contractId, payload: { dealer, dealerUsdcCid, validUntil } as Quote };
}

describe("setAsideUsdcIds", () => {
  it("lists the USDC set aside for the dealer's sell quotes only", () => {
    const ids = setAsideUsdcIds(
      [
        quote("q1", BANK, "usdc-197"), // Alice sells 200 PT: Bank set aside 197 USDC
        quote("q2", BANK, null), // Alice buys PT: Bank locked PT, no USDC
        quote("q3", OTHER_DEALER, "usdc-other"), // another dealer's quote
      ],
      BANK,
    );
    assert.deepEqual([...ids], ["usdc-197"]);
  });
});

describe("isQuoteLive", () => {
  it("is true until 2 s before validUntil", () => {
    const validUntilMs = Date.parse("2026-09-25T10:01:00Z");
    const live = quote("q", BANK, null).payload;
    assert.equal(isQuoteLive(live, 2000, validUntilMs - 5000), true);
    assert.equal(isQuoteLive(live, 2000, validUntilMs - 1000), false);
  });
});
