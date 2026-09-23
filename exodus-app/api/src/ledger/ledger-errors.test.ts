// Unit tests for toHttpError: which HTTP status and message a client gets
// when a ledger action fails.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException, HttpException, type Logger } from "@nestjs/common";
import { LedgerError } from "@exodus/ledger";
import { toHttpError } from "./ledger-errors.ts";

// A logger that stays quiet during tests (toHttpError logs unexpected errors).
const silentLogger = { error: () => undefined } as unknown as Logger;

function statusAndMessage(error: unknown): { status: number; message: string } {
  const http = toHttpError(error, "Test action", silentLogger);
  return { status: http.getStatus(), message: http.message };
}

describe("toHttpError", () => {
  it("shows our Daml assertion message as a 422", () => {
    // The exact text Canton 3.5 returns for `assertMsg "No valid USYC price" ...`.
    const cause =
      "Interpretation error: Error: User failure: UNHANDLED_EXCEPTION/DA.Exception.AssertionFailed:AssertionFailed " +
      "(error category 9): No valid USYC price";
    const result = statusAndMessage(new LedgerError("DAML_FAILURE", cause, 400));
    assert.deepEqual(result, { status: 422, message: "No valid USYC price" });
  });

  it("asks to try again (409) when a contract was archived meanwhile", () => {
    const result = statusAndMessage(new LedgerError("CONTRACT_NOT_FOUND", "Contract could not be found", 404));
    assert.equal(result.status, 409);
  });

  it("hides other ledger errors behind a 502", () => {
    const result = statusAndMessage(new LedgerError("PERMISSION_DENIED", "internal details", 403));
    assert.deepEqual(result, { status: 502, message: "The ledger rejected the request. Please try again." });
  });

  it("reports an unreachable ledger (fetch failed) as 503", () => {
    assert.equal(statusAndMessage(new TypeError("fetch failed")).status, 503);
  });

  it("passes on the @exodus/ledger helpers' user messages as 422", () => {
    const result = statusAndMessage(new Error("Not enough USDC: you have 60, you need 5,000"));
    assert.deepEqual(result, { status: 422, message: "Not enough USDC: you have 60, you need 5,000" });
  });

  it("keeps HTTP errors that are already set", () => {
    const original = new ConflictException("Already approved");
    assert.equal(toHttpError(original, "Test action", silentLogger), original);
  });

  it("turns anything else into a generic 500", () => {
    const http = toHttpError("something odd", "Test action", silentLogger);
    assert.ok(http instanceof HttpException);
    assert.equal(http.getStatus(), 500);
  });
});
