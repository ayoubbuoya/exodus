// Demo oracle bot: moves the simulated USYC index and the demo clock forward,
// and keeps a usable price snapshot on the ledger.
//
// Every tick it:
//   1. reads the oracle's private RateFeed,
//   2. ADVANCE: asks the demo schedule for the next step (for example Dec 31 -> Jan 1,
//      index 1.025) and publishes it. That creates a new RateIndex snapshot.
//      HEARTBEAT: if there is no next step (at maturity, or in --hold mode) and
//      the newest snapshot is half-way through its window, publishes the SAME
//      values again. Snapshots expire after 30 s, so without heartbeats nobody
//      could Subscribe (or later Split) while the demo clock stands still.
//   3. archives snapshots that have expired, so they do not pile up.
//
// Run:  npm run oracle            advance the clock + heartbeat
//       npm run oracle:hold       heartbeat only (move the clock by hand in the UI)
//       npm run oracle:once       one tick, then exit
// Settings (environment variables):
//   LEDGER_URL           default http://localhost:7575
//   ORACLE_TICK_SECONDS  seconds between ticks, default 5
//   ORACLE_STEP_DAYS     demo days per step, default 7
import { setTimeout as sleep } from "node:timers/promises";
import {
  createLedgerClient,
  findDemoParties,
  getRateFeed,
  getRateIndex,
  getRateSnapshots,
  isStaleContractError,
  nextOracleStep,
  RateFeed,
  RateIndex,
  type LedgerClient,
} from "@exodus/ledger";

const LEDGER_URL = process.env.LEDGER_URL ?? "http://localhost:7575";
const TICK_SECONDS = Number(process.env.ORACLE_TICK_SECONDS ?? "5");
const STEP_DAYS = Number(process.env.ORACLE_STEP_DAYS ?? "7");
const RUN_ONCE = process.argv.includes("--once");
const HOLD = process.argv.includes("--hold");

// Only archive a snapshot this long AFTER its validUntil, so our clock and the
// ledger clock do not have to match exactly.
const EXPIRE_MARGIN_MS = 5000;

function log(message: string): void {
  console.log(`${new Date().toISOString()}  ${message}`);
}

// Step 2: publish the next schedule step, or a heartbeat, or nothing.
async function publishIfNeeded(ledger: LedgerClient, oracle: string): Promise<void> {
  const feed = await getRateFeed(ledger, oracle);
  if (feed === null) {
    throw new Error("No RateFeed found. Run `npm run bootstrap` first.");
  }
  const current = feed.payload;

  const step = HOLD ? null : nextOracleStep(current.index, current.simTime, STEP_DAYS);
  if (step !== null) {
    await ledger.exercise(oracle, RateFeed.Publish, feed.contractId, step);
    log(
      `published index ${step.newIndex}  simTime ${step.newSimTime.slice(0, 10)}` +
        `  (was ${current.index} at ${current.simTime.slice(0, 10)})`,
    );
    return;
  }

  // No new step: send a heartbeat when the newest snapshot is half-way through its window.
  const windowMs = Number(current.validFor.microseconds) / 1000;
  const newest = await getRateIndex(ledger, oracle);
  const msLeft = newest === null ? 0 : Date.parse(newest.payload.validUntil) - Date.now();
  if (msLeft > windowMs / 2) {
    return;
  }
  await ledger.exercise(oracle, RateFeed.Publish, feed.contractId, {
    newIndex: current.index,
    newSimTime: current.simTime,
  });
  log(`heartbeat: index ${current.index}  simTime ${current.simTime.slice(0, 10)}`);
}

// Step 3: archive snapshots whose window has passed.
async function expireOldSnapshots(ledger: LedgerClient, oracle: string): Promise<void> {
  const snapshots = await getRateSnapshots(ledger, oracle);
  for (const snapshot of snapshots) {
    const expiredForMs = Date.now() - Date.parse(snapshot.payload.validUntil);
    if (expiredForMs < EXPIRE_MARGIN_MS) {
      continue;
    }
    try {
      await ledger.exercise(oracle, RateIndex.Expire, snapshot.contractId, {});
    } catch (error) {
      // Another oracle process may have archived it first. That is fine.
      if (!isStaleContractError(error)) {
        throw error;
      }
    }
  }
}

// One tick. If someone else changed the feed between our read and our write
// (for example a Publish from the UI's oracle controls), read again and retry once.
async function tick(ledger: LedgerClient, oracle: string): Promise<void> {
  try {
    await publishIfNeeded(ledger, oracle);
  } catch (error) {
    if (!isStaleContractError(error)) {
      throw error;
    }
    log(`STALE RateFeed, retrying with a fresh read: ${String(error)}`);
    await publishIfNeeded(ledger, oracle);
  }
  await expireOldSnapshots(ledger, oracle);
}

async function main(): Promise<void> {
  const ledger = createLedgerClient({ baseUrl: LEDGER_URL });
  const parties = await findDemoParties(ledger);
  if (parties === null) {
    throw new Error("Demo parties not found. Run `npm run bootstrap` first.");
  }
  const mode = HOLD ? "heartbeat only (--hold)" : `${STEP_DAYS} demo days per step`;
  console.log(`Oracle bot on ${LEDGER_URL} as ${parties.Oracle}`);
  console.log(`Tick every ${TICK_SECONDS}s, ${mode}${RUN_ONCE ? ", once" : ""}`);

  while (true) {
    await tick(ledger, parties.Oracle);
    if (RUN_ONCE) {
      return;
    }
    await sleep(TICK_SECONDS * 1000);
  }
}

main().catch((error: unknown) => {
  console.error("Oracle bot stopped:", error);
  process.exitCode = 1;
});
