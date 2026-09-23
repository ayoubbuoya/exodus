// One-time demo setup on a fresh ledger. Run it with `npm run bootstrap`.
//
// The sandbox keeps everything in memory, so run this again after every
// sandbox restart. It is safe to run twice: each step first checks whether its
// work is already done.
//
// What it creates (spec sections 5, 8.A and 9):
//   1. Uploads the Exodus DAR.
//   2. Parties: Operator, UsycIssuer, UsdcIssuer, Oracle, Alice, Bank.
//   3. RateFeed (the oracle's private feed): USYC index 1.00 on Oct 1 2026,
//      plus the first RateIndex price snapshot, readable by UsycIssuer (the
//      fund reads the price on its own authority; clients get it disclosed).
//   4. One HoldingTransferFactory per issuer, accepting the Operator's passes.
//   5. The USYC fund (UsycFund), accepting the Operator's passes.
//   6. ClientAccess passes for Alice and Bank (the demo clients are "approved").
//   7. Starting balances: Bank gets 1000 USYC, Alice gets 1000 USDC.
//
// Clients see none of 3-5: the app attaches them to client commands through
// explicit disclosure (see docs/client-app.md).
//
// "USYC" and "USDC" are SIMULATED tokens issued by our demo issuer parties,
// not by Circle.
import { readFile } from "node:fs/promises";
import { createLedgerClient, type LedgerClient } from "./client.ts";
import { DEMO_START } from "./oracle-schedule.ts";
import { DEMO_PARTY_NAMES, partyName, type DemoParties, type DemoPartyName } from "./parties.ts";
import { getClientAccess, getOwnedHoldings, getRateFeed, getTransferFactory, getUsycFund } from "./queries.ts";
import { ClientAccess, Holding, HoldingTransferFactory, RateFeed, UsycFund } from "./templates.ts";

const LEDGER_URL = process.env.LEDGER_URL ?? "http://localhost:7575";
const DAR_URL = new URL("../../../exodus-contract/main/.daml/dist/exodus-contract-main-0.0.1.dar", import.meta.url);

// Right after `npm run ledger` starts, the JSON API can answer before the
// participant is ready to accept writes, so the first call may fail. We retry
// it a few times instead of asking the user to run bootstrap twice.
const STARTUP_ATTEMPTS = 10;
const STARTUP_RETRY_DELAY_MS = 3000;

async function withStartupRetries<T>(what: string, action: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await action();
    } catch (error) {
      if (attempt >= STARTUP_ATTEMPTS) {
        throw error;
      }
      const reason = error instanceof Error ? error.message : String(error);
      console.log(`${what} failed (attempt ${attempt}/${STARTUP_ATTEMPTS}), retrying in ${STARTUP_RETRY_DELAY_MS / 1000} s: ${reason}`);
      await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_DELAY_MS));
    }
  }
}

async function uploadDar(ledger: LedgerClient): Promise<void> {
  const darBytes = await readFile(DAR_URL);
  await withStartupRetries("DAR upload", () => ledger.uploadDar(darBytes));
  console.log(`DAR uploaded: ${DAR_URL.pathname}`);
}

async function allocateParties(ledger: LedgerClient): Promise<DemoParties> {
  const existing = await ledger.listParties();
  const parties: Partial<DemoParties> = {};

  for (const name of DEMO_PARTY_NAMES) {
    const found = existing.find((partyId) => partyName(partyId) === name);
    if (found !== undefined) {
      parties[name] = found;
      console.log(`Party exists:    ${found}`);
    } else {
      parties[name] = await ledger.allocateParty(name);
      console.log(`Party allocated: ${parties[name]}`);
    }
  }
  return parties as DemoParties;
}

// How long each price snapshot stays usable (spec gap 12). Daml RelTime is in microseconds.
const SNAPSHOT_VALID_FOR_MICROSECONDS = String(30 * 1_000_000); // 30 seconds

async function createRateFeed(ledger: LedgerClient, parties: DemoParties): Promise<void> {
  const current = await getRateFeed(ledger, parties.Oracle);
  if (current !== null) {
    console.log(`RateFeed exists: index ${current.payload.index} at ${current.payload.simTime}`);
    return;
  }
  await ledger.create(parties.Oracle, RateFeed, {
    oracle: parties.Oracle,
    operator: parties.Operator,
    // Only the fund's issuer: Subscribe fetches the price on UsycIssuer's
    // authority. Clients are NOT readers; listing them here would show every
    // client the full client list.
    readers: [parties.UsycIssuer],
    instrument: "USYC",
    index: "1.0",
    simTime: DEMO_START,
    validFor: { microseconds: SNAPSHOT_VALID_FOR_MICROSECONDS },
  });

  // Publish the same values once, to create the first price snapshot.
  const feed = await getRateFeed(ledger, parties.Oracle);
  if (feed === null) {
    throw new Error("RateFeed was created but cannot be found");
  }
  await ledger.exercise(parties.Oracle, RateFeed.Publish, feed.contractId, {
    newIndex: "1.0",
    newSimTime: DEMO_START,
  });
  console.log(`RateFeed created: index 1.0 at ${DEMO_START}, first snapshot valid for 30 s`);
  console.log("Keep `npm run oracle` (or `npm run oracle:hold`) running, or the price snapshot expires.");
}

async function createTransferFactory(ledger: LedgerClient, parties: DemoParties, issuer: DemoPartyName): Promise<void> {
  const admin = parties[issuer];
  const current = await getTransferFactory(ledger, admin, admin);
  if (current !== null) {
    console.log(`TransferFactory exists for ${issuer}`);
    return;
  }
  await ledger.create(admin, HoldingTransferFactory, {
    admin,
    operator: parties.Operator,
  });
  console.log(`TransferFactory created for ${issuer} (accepts the Operator's access passes)`);
}

// The USYC fund. Any client with an access pass from the Operator can subscribe.
async function createUsycFund(ledger: LedgerClient, parties: DemoParties): Promise<void> {
  const current = await getUsycFund(ledger, parties.UsycIssuer);
  if (current !== null) {
    console.log("UsycFund exists");
    return;
  }
  await ledger.create(parties.UsycIssuer, UsycFund, {
    usycIssuer: parties.UsycIssuer,
    usdcIssuer: parties.UsdcIssuer,
    oracle: parties.Oracle,
    operator: parties.Operator,
  });
  console.log("UsycFund created (accepts the Operator's access passes)");
}

// Approves a demo client: the Operator creates its access pass (what the
// admin's "Approve" button will do for real users). The issuers observe every
// pass, because their transfer factories check the receiver's pass.
async function grantClientAccess(ledger: LedgerClient, parties: DemoParties, client: DemoPartyName): Promise<void> {
  const current = await getClientAccess(ledger, parties.Operator, parties[client]);
  if (current !== null) {
    console.log(`${client} already has an access pass`);
    return;
  }
  await ledger.create(parties.Operator, ClientAccess, {
    operator: parties.Operator,
    client: parties[client],
    issuers: [parties.UsycIssuer, parties.UsdcIssuer],
  });
  console.log(`Access pass created for ${client}`);
}

// Mints `amount` of `instrument` to `owner`, unless the owner already holds some.
async function mintIfEmpty(
  ledger: LedgerClient,
  parties: DemoParties,
  issuer: DemoPartyName,
  owner: DemoPartyName,
  instrument: string,
  amount: string,
): Promise<void> {
  const holdings = await getOwnedHoldings(ledger, parties[owner]);
  const alreadyHas = holdings.some((holding) => holding.payload.instrumentId.id === instrument);
  if (alreadyHas) {
    console.log(`${owner} already holds ${instrument}`);
    return;
  }
  await ledger.create(parties[issuer], Holding, {
    issuer: parties[issuer],
    owner: parties[owner],
    instrument,
    amount,
  });
  console.log(`Minted ${amount} ${instrument} to ${owner}`);
}

async function main(): Promise<void> {
  console.log(`Bootstrapping Exodus demo on ${LEDGER_URL}`);
  const ledger = createLedgerClient({ baseUrl: LEDGER_URL });

  await uploadDar(ledger);
  const parties = await allocateParties(ledger);
  await createRateFeed(ledger, parties);
  await createTransferFactory(ledger, parties, "UsycIssuer");
  await createTransferFactory(ledger, parties, "UsdcIssuer");
  await createUsycFund(ledger, parties);
  await grantClientAccess(ledger, parties, "Alice");
  await grantClientAccess(ledger, parties, "Bank");
  await mintIfEmpty(ledger, parties, "UsycIssuer", "Bank", "USYC", "1000.0");
  await mintIfEmpty(ledger, parties, "UsdcIssuer", "Alice", "USDC", "1000.0");

  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error("Bootstrap failed:", error);
  process.exitCode = 1;
});
