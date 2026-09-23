// Unit tests for the startup check of the environment variables.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateEnvironment } from "./environment.ts";

const MINIMAL = { DATABASE_URL: "postgresql://exodus:exodus@localhost:5432/exodus" };

describe("validateEnvironment", () => {
  it("fills in the defaults", () => {
    const environment = validateEnvironment(MINIMAL);
    assert.equal(environment.PORT, 3000);
    assert.equal(environment.LEDGER_URL, "http://localhost:7575");
    assert.equal(environment.FAUCET_AMOUNT, "100.0");
    assert.equal(environment.COOKIE_SECURE, false);
  });

  it("turns text into numbers and booleans", () => {
    const environment = validateEnvironment({ ...MINIMAL, PORT: "4000", COOKIE_SECURE: "true" });
    assert.equal(environment.PORT, 4000);
    assert.equal(environment.COOKIE_SECURE, true);
  });

  it('reads COOKIE_SECURE="false" as false (Boolean("false") would be true)', () => {
    assert.equal(validateEnvironment({ ...MINIMAL, COOKIE_SECURE: "false" }).COOKIE_SECURE, false);
  });

  it("stops with a clear message on a bad value", () => {
    assert.throws(() => validateEnvironment({ ...MINIMAL, LEDGER_URL: "localhost:7575" }), /Invalid environment variables/);
    assert.throws(() => validateEnvironment({}), /DATABASE_URL must start with postgresql/);
    assert.throws(() => validateEnvironment({ ...MINIMAL, FAUCET_AMOUNT: "-5" }), /FAUCET_AMOUNT/);
  });
});
