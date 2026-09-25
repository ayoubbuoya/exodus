// Unit tests for the market maths. The expected values come from the spec
// section 9 worked example and from DemoTest.daml / LifecycleTest.daml, so the
// previews are checked against what the Daml contracts really pay.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fixedApyFromPrice,
  marketSymbols,
  previewClaim,
  previewMerge,
  previewPtRedeem,
  previewQuoteCash,
  previewSplit,
  priceForApy,
  yearsBetween,
} from "./market-math.ts";

describe("yearsBetween", () => {
  it("uses 365-day years, like Pendle", () => {
    // Oct 1 2026 -> Apr 1 2027 is 182 days.
    assert.equal(yearsBetween("2026-10-01T00:00:00Z", "2027-04-01T00:00:00Z"), 182 / 365);
  });

  it("is 0 after maturity, never negative", () => {
    assert.equal(yearsBetween("2027-04-10T00:00:00Z", "2027-04-01T00:00:00Z"), 0);
  });
});

describe("fixedApyFromPrice / priceForApy", () => {
  it("turns the spec's 0.975 with 0.5 years left into about 5.19%", () => {
    const apy = fixedApyFromPrice(0.975, 0.5);
    assert.equal(apy.toFixed(4), "0.0519");
  });

  it("gives about 0.975 for a 5.2% target with 0.5 years left", () => {
    assert.equal(priceForApy(0.052, 0.5).toFixed(3), "0.975");
  });

  it("are the inverse of each other", () => {
    const price = priceForApy(0.05, 0.4986);
    assert.ok(Math.abs(fixedApyFromPrice(price, 0.4986) - 0.05) < 1e-12);
  });

  it("prices a PT at 1 at maturity", () => {
    assert.equal(priceForApy(0.05, 0), 1);
  });

  it("refuses a matured market and a price of 0", () => {
    assert.throws(() => fixedApyFromPrice(0.975, 0), /matured/);
    assert.throws(() => fixedApyFromPrice(0, 0.5), /price/);
  });
});

describe("previews (exact contract amounts)", () => {
  it("split: PT = YT = usycAmount * index, rounded down", () => {
    assert.equal(previewSplit("1000", "1.0"), "1000.0000000000");
    assert.equal(previewSplit("1000", "1.025"), "1025.0000000000");
    // 341.666666325 -> 341.666666
    assert.equal(previewSplit("333.333333", "1.025"), "341.6666660000");
  });

  it("claim: the spec section 9 yields", () => {
    // Jan 1: 1000 YT from 1.00 to 1.025
    assert.equal(previewClaim("1000", "1.0", "1.025"), "24.3902430000");
    // Apr 1 final claim: 1000 YT from 1.025 to 1.05
    assert.equal(previewClaim("1000", "1.025", "1.05"), "23.2288030000");
  });

  it("claim: 0 when the index did not move up", () => {
    assert.equal(previewClaim("1000", "1.025", "1.025"), "0.0000000000");
    assert.equal(previewClaim("1000", "1.025", "1.02"), "0.0000000000");
  });

  it("merge: amount / lastIndex", () => {
    assert.equal(previewMerge("100", "1.0"), "100.0000000000");
    assert.equal(previewMerge("100", "1.025"), "97.5609750000");
  });

  it("PT redeem: ptAmount / index at settle time", () => {
    assert.equal(previewPtRedeem("500", "1.05"), "476.1904760000");
    assert.equal(previewPtRedeem("500", "1.06"), "471.6981130000");
  });

  it("quote cash: price * ptAmount", () => {
    assert.equal(previewQuoteCash("0.975", "500"), "487.5000000000");
    assert.equal(previewQuoteCash("0.985", "200"), "197.0000000000");
  });
});

describe("marketSymbols", () => {
  it("names PT and YT after the market, Pendle style", () => {
    assert.deepEqual(marketSymbols("PT-USYC-APR2027"), { pt: "PT-USYC-APR2027", yt: "YT-USYC-APR2027" });
    assert.deepEqual(marketSymbols("USYC-JUL2027"), { pt: "PT-USYC-JUL2027", yt: "YT-USYC-JUL2027" });
  });
});
