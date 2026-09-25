// Unit tests for pickInputs: choosing which holdings to spend, biggest first.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickInputs } from "./inputs.ts";
import type { Contract } from "./queries.ts";
import type { HoldingView } from "./templates.ts";

// A USDC holding view with just the fields pickInputs reads.
function usdc(contractId: string, amount: string): Contract<HoldingView> {
  return {
    contractId,
    payload: { amount, instrumentId: { admin: "UsdcIssuer::1220", id: "USDC" } } as HoldingView,
  };
}

describe("pickInputs", () => {
  it("takes the biggest holdings first and stops when it has enough", () => {
    // Alice owns 100, 600 and 400 USDC and pays 700: use 600 + 400.
    const inputs = pickInputs([usdc("a", "100"), usdc("b", "600"), usdc("c", "400")], "700", "USDC");
    assert.deepEqual(
      inputs.map((input) => input.contractId),
      ["b", "c"],
    );
  });

  it("explains how much is missing", () => {
    assert.throws(
      () => pickInputs([usdc("a", "60")], "5000", "USDC"),
      /Not enough USDC: you have 60, you need 5,000/,
    );
  });
});
