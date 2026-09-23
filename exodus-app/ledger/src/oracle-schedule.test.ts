// Unit tests for the demo price path (spec section 9): 1.00 on Oct 1 2026,
// 1.025 on Jan 1 2027, 1.05 on Apr 1 2027, a straight line in between.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEMO_MATURITY, DEMO_START, daysToMaturity, indexAt, nextOracleStep } from "./oracle-schedule.ts";

describe("indexAt", () => {
  it("hits the spec keyframes exactly", () => {
    assert.equal(indexAt(DEMO_START), 1.0);
    assert.equal(indexAt("2027-01-01T00:00:00Z"), 1.025);
    assert.equal(indexAt(DEMO_MATURITY), 1.05);
  });

  it("stays flat before the start and after maturity", () => {
    assert.equal(indexAt("2026-01-01T00:00:00Z"), 1.0);
    assert.equal(indexAt("2028-01-01T00:00:00Z"), 1.05);
  });
});

describe("nextOracleStep", () => {
  it("moves the clock by the step size", () => {
    const step = nextOracleStep("1.0", DEMO_START, 7);
    assert.equal(step?.newSimTime, "2026-10-08T00:00:00.000Z");
  });

  it("never jumps over a keyframe, so Jan 1 gets exactly 1.025", () => {
    // Dec 31 + 7 days would be Jan 7: stop at Jan 1 instead.
    const step = nextOracleStep("1.0247282609", "2026-12-31T00:00:00Z", 7);
    assert.equal(step?.newSimTime, "2027-01-01T00:00:00.000Z");
    assert.equal(step?.newIndex, "1.0250000000");
  });

  it("never publishes a lower index than the current one", () => {
    // Someone published 1.2 by hand: keep 1.2 (Publish refuses a lower index).
    const step = nextOracleStep("1.2", DEMO_START, 7);
    assert.equal(step?.newIndex, "1.2000000000");
  });

  it("stops at maturity", () => {
    assert.equal(nextOracleStep("1.05", DEMO_MATURITY, 7), null);
  });
});

describe("daysToMaturity", () => {
  it("counts whole days to Apr 1 2027", () => {
    assert.equal(daysToMaturity("2027-01-01T00:00:00Z"), 90);
    assert.equal(daysToMaturity(DEMO_MATURITY), 0);
  });
});
