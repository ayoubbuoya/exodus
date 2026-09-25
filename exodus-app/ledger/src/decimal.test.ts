// Unit tests for the exact decimal helpers (run: npm test -w @exodus/ledger).
// These guard the money maths, so every example uses real demo numbers.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decimalToUnits,
  divideDaml,
  divideRoundDown6,
  formatAmount,
  hasAtMost6Decimals,
  multiplyDaml,
  multiplyRoundDown6,
  roundDown6,
  subtractDecimal,
  unitsToDecimal,
} from "./decimal.ts";

describe("decimalToUnits / unitsToDecimal", () => {
  it("turns a decimal into units of 0.0000000001 and back", () => {
    assert.equal(decimalToUnits("487.5"), 4875000000000n);
    assert.equal(unitsToDecimal(4875000000000n), "487.5000000000");
  });

  it("formats negative units with one sign in front", () => {
    // Alice paid 487.5 USDC: the activity feed shows -487.5.
    assert.equal(unitsToDecimal(-4875000000000n), "-487.5000000000");
    assert.equal(unitsToDecimal(-1n), "-0.0000000001");
  });

  it("refuses text that is not a positive decimal", () => {
    assert.throws(() => decimalToUnits("-1"));
    assert.throws(() => decimalToUnits("1e3"));
    assert.throws(() => decimalToUnits(""));
  });
});

describe("divideRoundDown6", () => {
  it("rounds down to 6 decimals like the contract's roundDown6", () => {
    // Spec example: 500 USDC at index 1.025 buys 487.804878... USYC.
    assert.equal(divideRoundDown6("500", "1.025"), "487.8048780000");
  });

  it("never rounds up", () => {
    // 2 / 3 = 0.6666666..., rounded DOWN (not 0.666667).
    assert.equal(divideRoundDown6("2", "3"), "0.6666660000");
  });

  it("refuses to divide by 0", () => {
    assert.throws(() => divideRoundDown6("1", "0"), /Cannot divide by 0/);
  });
});

describe("formatAmount", () => {
  it("drops trailing zeros and groups thousands", () => {
    assert.equal(formatAmount("1000.0000000000"), "1,000");
    assert.equal(formatAmount("24.3902430000"), "24.390243");
  });
});

describe("multiplyRoundDown6", () => {
  it("gives the USDC a redeem pays, like the contract's Settle", () => {
    // Alice redeems 100 USYC at index 1.03: 103 USDC.
    assert.equal(multiplyRoundDown6("100", "1.03"), "103.0000000000");
  });

  it("never rounds up, so the fund never pays too much", () => {
    // 487.804878 * 1.025 = 499.99999995, rounded DOWN (not 500).
    assert.equal(multiplyRoundDown6("487.804878", "1.025"), "499.9999990000");
  });
});

describe("hasAtMost6Decimals", () => {
  it("accepts holding-sized amounts and refuses smaller ones", () => {
    assert.equal(hasAtMost6Decimals("100.5"), true);
    assert.equal(hasAtMost6Decimals("0.000001"), true);
    assert.equal(hasAtMost6Decimals("0.0000001"), false);
  });
});

describe("Daml-exact maths (divideDaml, multiplyDaml, subtractDecimal, roundDown6)", () => {
  it("rounds a quotient to the nearest 10th decimal, like Daml", () => {
    // 1000 / 1.025 = 975.609756097560975... -> the 11th digit is 9, so round up.
    assert.equal(divideDaml("1000", "1.025"), "975.6097560976");
    // 1000 / 1.05 = 952.380952380952... -> the 11th digit is 3, so round down.
    assert.equal(divideDaml("1000", "1.05"), "952.3809523810");
  });

  it("sends an exact half to the even digit (banker's rounding)", () => {
    // 0.5 * 0.0000000001 = 0.00000000005: half way, 0 is even -> 0
    assert.equal(multiplyDaml("0.5", "0.0000000001"), "0.0000000000");
    // 1.5 * 0.0000000001 = 0.00000000015: half way, 2 is even -> 0.0000000002
    assert.equal(multiplyDaml("1.5", "0.0000000001"), "0.0000000002");
  });

  it("multiplies without losing digits when 10 decimals are enough", () => {
    assert.equal(multiplyDaml("333.333333", "1.025"), "341.6666663250");
  });

  it("subtracts and refuses a negative result", () => {
    assert.equal(subtractDecimal("1000", "975.6097560976"), "24.3902439024");
    assert.throws(() => subtractDecimal("1", "2"), /Negative result/);
  });

  it("cuts to 6 decimals like the contract's roundDown6", () => {
    assert.equal(roundDown6("24.3902439024"), "24.3902430000");
    assert.equal(roundDown6("500"), "500.0000000000");
  });

  it("refuses to divide by 0", () => {
    assert.throws(() => divideDaml("1", "0"), /Cannot divide by 0/);
  });
});
