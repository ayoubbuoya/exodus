// One-time demo setup on a fresh ledger. Run it with `npm run bootstrap`.
//
// The sandbox keeps everything in memory, so run this again after every
// sandbox restart. It is safe to run twice: each step first checks whether its
// work is already done.
//
// What it creates (spec sections 5 and 9):
//   1. Uploads the Exodus DAR.
//   2. Parties: Operator, UsycIssuer, UsdcIssuer, Oracle, Alice, Bank.
//   3. RateFeed (the oracle's private feed): USYC index 1.00 on Oct 1 2026,
//      plus the first RateIndex price snapshot, readable by Alice and Bank.
//   4. One HoldingTransferFactory per issuer, usable by Alice and Bank.
//   5. The USYC fund (UsycFund): Alice and Bank can pay USDC to get USYC.
//   6. Starting balances: Bank gets 1000 USYC, Alice gets 1000 USDC.
//
// "USYC" and "USDC" are SIMULATED tokens issued by our demo issuer parties,
// not by Circle.
import { readFile } from "node:fs/promises";
import { createLedgerClient, type LedgerClient } from "./client.ts";
import { DEMO_START } from "./oracle-schedule.ts";
import { DEMO_PARTY_NAMES, partyName, type DemoParties, type DemoPartyName } from "./parties.ts";
import { getOwnedHoldings, getRateFeed, getTransferFactory, getUsycFund } from "./queries.ts";
import { Holding, HoldingTransferFactory, RateFeed, UsycFund } from "./templates.ts";

const LEDGER_URL = process.env.LEDGER_URL ?? "http://localhost:7575";
const DAR_URL = new URL("../../../exodus-contract/main/.daml/dist/exodus-contract-main-0.0.1.dar", import.meta.url);

async function uploadDar(ledger: LedgerClient): Promise<void> {
  const darBytes = await readFile(DAR_URL);
  await ledger.uploadDar(darBytes);
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
    readers: [parties.Alice, parties.Bank],
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
    users: [parties.Alice, parties.Bank],
  });
  console.log(`TransferFactory created for ${issuer}`);
}

// The USYC fund. Its users must also be RateIndex readers, because Subscribe
// reads the index as the subscriber.
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
    users: [parties.Alice, parties.Bank],
  });
  console.log("UsycFund created (users: Alice, Bank)");
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
  await mintIfEmpty(ledger, parties, "UsycIssuer", "Bank", "USYC", "1000.0");
  await mintIfEmpty(ledger, parties, "UsdcIssuer", "Alice", "USDC", "1000.0");

  console.log("Done.");
}

main().catch((error: unknown) => {
  console.error("Bootstrap failed:", error);
  process.exitCode = 1;
});
