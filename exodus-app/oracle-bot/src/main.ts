// Demo oracle bot: moves the simulated USYC index and the demo clock forward.
//
// Every tick it:
//   1. reads the CURRENT RateIndex (fresh, because every Publish archives the old one),
//   2. asks the demo schedule for the next step (for example Dec 31 -> Jan 1, index 1.025),
//   3. exercises Publish as the Oracle party.
// It stops when the demo clock reaches maturity (Apr 1 2027).
//
// Run:  npm run oracle            (loop)
//       npm run oracle:once       (one step, then exit)
// Settings (environment variables):
//   LEDGER_URL           default http://localhost:7575
//   ORACLE_TICK_SECONDS  seconds between publishes, default 5
//   ORACLE_STEP_DAYS     demo days per publish, default 7
import { setTimeout as sleep } from "node:timers/promises";
import {
  createLedgerClient,
  findDemoParties,
  getRateIndex,
  isStaleContractError,
  nextOracleStep,
  RateIndex,
  type LedgerClient,
} from "@exodus/ledger";

const LEDGER_URL = process.env.LEDGER_URL ?? "http://localhost:7575";
const TICK_SECONDS = Number(process.env.ORACLE_TICK_SECONDS ?? "5");
const STEP_DAYS = Number(process.env.ORACLE_STEP_DAYS ?? "7");
const RUN_ONCE = process.argv.includes("--once");

// What happened in one tick.
type TickResult = "published" | "at-maturity";

// Reads the current RateIndex and publishes the next step.
async function publishNextStep(ledger: LedgerClient, oracle: string): Promise<TickResult> {
  const current = await getRateIndex(ledger, oracle);
  if (current === null) {
    throw new Error("No RateIndex found. Run `npm run bootstrap` first.");
  }

  const step = nextOracleStep(current.payload.index, current.payload.simTime, STEP_DAYS);
  if (step === null) {
    return "at-maturity";
  }

  await ledger.exercise(oracle, RateIndex.Publish, current.contractId, step);
  console.log(
    `${new Date().toISOString()}  published index ${step.newIndex}  simTime ${step.newSimTime.slice(0, 10)}` +
      `  (was ${current.payload.index} at ${current.payload.simTime.slice(0, 10)})`,
  );
  return "published";
}

// Like publishNextStep, but if someone else published between our read and our
// write (so our RateIndex contract id is stale), log it and try once more with
// a fresh read. This is the "stale rateCid" race from the skeleton plan.
async function tick(ledger: LedgerClient, oracle: string): Promise<TickResult> {
  try {
    return await publishNextStep(ledger, oracle);
  } catch (error) {
    if (!isStaleContractError(error)) {
      throw error;
    }
    console.warn(`${new Date().toISOString()}  STALE RateIndex, retrying with a fresh read: ${String(error)}`);
    return await publishNextStep(ledger, oracle);
  }
}

async function main(): Promise<void> {
  const ledger = createLedgerClient({ baseUrl: LEDGER_URL });
  const parties = await findDemoParties(ledger);
  if (parties === null) {
    throw new Error("Demo parties not found. Run `npm run bootstrap` first.");
  }
  console.log(`Oracle bot on ${LEDGER_URL} as ${parties.Oracle}`);
  console.log(`Tick every ${TICK_SECONDS}s, ${STEP_DAYS} demo days per tick${RUN_ONCE ? " (once)" : ""}`);

  while (true) {
    const result = await tick(ledger, parties.Oracle);
    if (result === "at-maturity") {
      console.log("Demo clock is at maturity (Apr 1 2027). Nothing more to publish.");
      return;
    }
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
