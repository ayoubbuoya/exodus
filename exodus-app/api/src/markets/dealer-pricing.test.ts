// Unit tests for the house dealer's prices (Pendle's formula, spread in APY points).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dealerPrices, fixedApyPercent, priceForSide, targetApyPercent } from "./dealer-pricing.ts";

const SETTINGS = { apyOffsetPercent: -0.5, fallbackApyPercent: 5.2, spreadPercent: 0.1 };
const YEARS_OCT_1 = 182 / 365; // Oct 1 2026 -> Apr 1 2027

describe("targetApyPercent", () => {
  it("follows the underlying APY plus the offset", () => {
    assert.equal(targetApyPercent(10.29, SETTINGS), 9.79);
  });

  it("uses the fallback while there is not enough price history", () => {
    assert.equal(targetApyPercent(null, SETTINGS), 5.2);
  });
});

describe("dealerPrices", () => {
  it("quotes around the target with the spread in APY points, rounded in the dealer's favour", () => {
    const prices = dealerPrices(5.2, 0.1, YEARS_OCT_1);
    assert.equal(prices.askPrice, "0.975503"); // Alice buys at 5.1 %
    assert.equal(prices.midPrice, "0.975039");
    assert.equal(prices.bidPrice, "0.974577"); // Alice sells at 5.3 %
    assert.equal(prices.askFixedApyPercent, 5.1);
    assert.equal(prices.bidFixedApyPercent, 5.3);
  });

  it("never quotes a PT above 1 USD, even when the buyer's rate would go below 0", () => {
    const prices = dealerPrices(0.05, 0.1, YEARS_OCT_1);
    assert.equal(prices.askPrice, "1.000000");
  });

  it("prices a PT at exactly 1 at maturity", () => {
    const prices = dealerPrices(5.2, 0.1, 0);
    assert.deepEqual([prices.askPrice, prices.midPrice, prices.bidPrice], ["1.000000", "1.000000", "1.000000"]);
    assert.equal(prices.askFixedApyPercent, null);
  });
});

describe("priceForSide", () => {
  it("gives the ask to a buyer and the bid to a seller", () => {
    const prices = dealerPrices(5.2, 0.1, YEARS_OCT_1);
    assert.equal(priceForSide(prices, "BuyPt"), "0.975503");
    assert.equal(priceForSide(prices, "SellPt"), "0.974577");
  });
});

describe("fixedApyPercent", () => {
  it("matches the spec: 0.975 with 0.5 years left is about 5.19 %", () => {
    assert.equal(fixedApyPercent("0.975", 0.5), 5.19);
  });
});
