// Unit tests for the APY formula (run: npm test -w @exodus/api).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { annualizedGrowthPercent } from "./apy.ts";

describe("annualizedGrowthPercent", () => {
  it("annualises 30 days of growth with compounding", () => {
    // 1.0043 -> 1.0125 in 30 demo days is about 10.40 % a year.
    assert.equal(annualizedGrowthPercent(1.0125, 1.0043, 30), 10.4);
  });

  it("matches the demo path: 1.00 on Oct 1 -> 1.025 on Jan 1 (92 days)", () => {
    assert.equal(annualizedGrowthPercent(1.025, 1.0, 92), 10.29);
  });

  it("gives 0 when the price did not move", () => {
    assert.equal(annualizedGrowthPercent(1.01, 1.01, 30), 0);
  });

  it("returns null for less than 7 days of history (too noisy)", () => {
    assert.equal(annualizedGrowthPercent(1.002, 1.0, 6), null);
  });
});
