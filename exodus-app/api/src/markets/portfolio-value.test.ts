// Unit tests for the portfolio's USD value (Pendle: YT price = 1 - PT price).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { positionUsdValue } from "./portfolio-value.ts";

describe("positionUsdValue", () => {
  it("values PT at the mid price, YT at 1 - mid, plus the claimable yield", () => {
    // Bank on Jan 1: 500 PT, 1000 YT, 24.390243 USYC claimable at index 1.025.
    const value = positionUsdValue({
      ptAmount: "500",
      ytAmount: "1000",
      claimableUsyc: "24.390243",
      index: "1.025",
      ptPrice: "0.975",
    });
    assert.deepEqual(value, { ptUsd: 487.5, ytUsd: 25, claimableUsd: 25, totalUsd: 537.5 });
  });

  it("values a PT at 1 USD after maturity, and a YT only by its last claim", () => {
    // Alice on Apr 1: 500 PT; Bank's YT has 23.228803 USYC left to claim at 1.05.
    const alice = positionUsdValue({ ptAmount: "500", ytAmount: "0", claimableUsyc: "0", index: "1.05", ptPrice: "1" });
    assert.equal(alice.totalUsd, 500);
    const bankYt = positionUsdValue({ ptAmount: "0", ytAmount: "1000", claimableUsyc: "23.228803", index: "1.05", ptPrice: "1" });
    assert.deepEqual(bankYt, { ptUsd: 0, ytUsd: 0, claimableUsd: 24.39, totalUsd: 24.39 });
  });
});
