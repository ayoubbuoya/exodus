// Publishing a price as the Oracle party (the demo oracle, not a real feed).
//
// Used by the bootstrap and the markets demo script. (The oracle bot has its
// own loop; these are the same RateFeed.Publish calls.)
//
// Every Publish creates a new RateIndex snapshot that stays usable for 30 s
// (spec gap 12). Publishing the SAME values again is allowed: a "heartbeat"
// that just makes a fresh snapshot.
import type { LedgerClient } from "./client.ts";
import { withOneRetry } from "./markets.ts";
import { getRateFeed, getRateIndex, isRateValid } from "./queries.ts";
import { RateFeed } from "./templates.ts";

// Publishes `newIndex` at demo time `newSimTime`. Both may only go up (or stay).
// Example: publishRate(ledger, oracle, "1.025", "2027-01-01T00:00:00Z") -> Jan 1 at 1.025.
// Retries once if the oracle bot publishes at the same moment (both archive the same RateFeed).
export async function publishRate(ledger: LedgerClient, oracle: string, newIndex: string, newSimTime: string): Promise<void> {
  await withOneRetry(async () => {
    const feed = await getRateFeed(ledger, oracle);
    if (feed === null) {
      throw new Error("No RateFeed found. Run `npm run bootstrap`.");
    }
    await ledger.exercise(oracle, RateFeed.Publish, feed.contractId, { newIndex, newSimTime });
  });
}

// Makes sure the newest snapshot stays valid for at least `minValidMs` more:
// if not, the Oracle publishes its current values again (a heartbeat).
// Example: the bootstrap calls it before Bank's split, so the split works
// even when the oracle bot is not running yet.
export async function ensureFreshRate(ledger: LedgerClient, oracle: string, minValidMs = 10_000): Promise<void> {
  const rate = await getRateIndex(ledger, oracle);
  if (rate !== null && isRateValid(rate.payload, minValidMs)) {
    return;
  }
  const feed = await getRateFeed(ledger, oracle);
  if (feed === null) {
    throw new Error("No RateFeed found. Run `npm run bootstrap`.");
  }
  await publishRate(ledger, oracle, feed.payload.index, feed.payload.simTime);
}
