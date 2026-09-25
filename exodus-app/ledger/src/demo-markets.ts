// The markets demo (spec section 9) end to end on the sandbox, through
// @exodus/ledger only. Run it with `npm run demo:markets`.
//
// It is the Phase 5 "done when" check (docs/markets-plan.md): the same story
// as DemoTest.daml, but through the real JSON Ledger API and our TypeScript
// client, checking every amount to 6 decimals:
//
//   1. (bootstrap) Bank split 1000 USYC -> 1000 PT + 1000 YT
//   2. Oct 1:  Alice buys 500 PT from Bank at 0.975 (487.5 USDC), privately
//   3. Jan 1:  Bank claims the yield of 1000 YT at 1.025 -> 24.390243 USYC
//   4. Apr 1:  the Operator matures the market at 1.05
//   5.         Alice redeems 500 PT -> 476.190476 USYC (worth 500 USD)
//   6.         Bank's final claim -> 23.228803 USYC, and its 500 PT -> 476.190476 USYC
//   7.         the vault keeps only rounding dust: 0.000002 USYC
//
// Between steps 2 and 3 it also runs the other flows. Each one nets to zero,
// so the spec numbers above do not change: split + merge back, sell PT + buy
// it back, a rejected quote and an expired quote.
//
// IT MOVES THE DEMO CLOCK TO MATURITY, which cannot be undone. So it needs a
// FRESH sandbox (clock still at Oct 1 2026) and stops otherwise:
//   npm run ledger        (restart it for a fresh, in-memory ledger)
//   npm run bootstrap
//   npm run demo:markets  (`npm run oracle` must be stopped; `oracle:hold` is fine)
// Restart the sandbox again before a UI demo: the market is matured afterwards.
//
// The script plays every role (Alice, Bank, the Operator, the Oracle)
// because the sandbox has no auth. In the app, each role has its own ledger user.
//
// "USYC" and "USDC" are SIMULATED tokens issued by our demo issuer parties,
// not by Circle.
import { setTimeout as sleep } from "node:timers/promises";
import { getHoldingActivity } from "./activity.ts";
import { createLedgerClient } from "./client.ts";
import { decimalToUnits, formatAmount, unitsToDecimal } from "./decimal.ts";
import { requestClaim, requestPtRedeem, settleMarketRequests, type MarketSettleReport } from "./lifecycle.ts";
import { fixedApyFromPrice, yearsBetween } from "./market-math.ts";
import { DEMO_MARKET_ID, getMarket, getMaturitySnapshot, requestMerge, splitUsyc } from "./markets.ts";
import { ensureFreshRate, publishRate } from "./oracle.ts";
import { DEMO_MATURITY, DEMO_START } from "./oracle-schedule.ts";
import { findDemoParties, type DemoParties } from "./parties.ts";
import { getOwnedHoldings, getRateFeed } from "./queries.ts";
import { acceptQuote, getQuotes, getRfqRequests, quoteRfq, rejectQuote, requestQuote, withdrawExpiredQuotes } from "./rfq.ts";
import { subscribeUsyc } from "./subscribe.ts";
import type { RfqSide } from "./templates.ts";
import { getMarketPositions } from "./tokens.ts";

const LEDGER_URL = process.env.LEDGER_URL ?? "http://localhost:7575";
const ledger = createLedgerClient({ baseUrl: LEDGER_URL, userId: "exodus-demo" });

const JAN_1 = "2027-01-01T00:00:00Z";

// ---------------------------------------------------------------------------
// Printing and checking
// ---------------------------------------------------------------------------

let checks = 0;
let failures = 0;

function title(text: string): void {
  console.log(`\n=== ${text}`);
}

// Compares two decimals exactly (as units), for example "487.5" and "487.5000000000".
function check(label: string, actual: string, expected: string): void {
  checks += 1;
  const ok = decimalOrNegativeToUnits(actual) === decimalOrNegativeToUnits(expected);
  if (!ok) {
    failures += 1;
  }
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}: ${formatSigned(actual)}${ok ? "" : ` (expected ${formatSigned(expected)})`}`);
}

// A yes/no check, for example "the Operator sees no quote".
function checkTrue(label: string, ok: boolean): void {
  checks += 1;
  if (!ok) {
    failures += 1;
  }
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}`);
}

// Runs `action` and checks that it FAILS with a message containing `expected`.
async function checkRefused(label: string, action: () => Promise<unknown>, expected: string): Promise<void> {
  try {
    await action();
    checkTrue(`${label} (it should have been refused)`, false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checkTrue(`${label}: refused ("${expected}")`, message.includes(expected));
    if (!message.includes(expected)) {
      console.log(`       got: ${message}`);
    }
  }
}

// decimalToUnits only reads positive numbers; deltas can be negative.
function decimalOrNegativeToUnits(value: string): bigint {
  return value.startsWith("-") ? -decimalToUnits(value.slice(1)) : decimalToUnits(value);
}

function formatSigned(value: string): string {
  return value.startsWith("-") ? `-${formatAmount(value.slice(1))}` : formatAmount(value);
}

// ---------------------------------------------------------------------------
// Balances
// ---------------------------------------------------------------------------

// Everything one party owns, as totals: { USYC, USDC, PT, YT }.
type Balances = { USYC: bigint; USDC: bigint; PT: bigint; YT: bigint };

async function balancesOf(party: string): Promise<Balances> {
  const balances: Balances = { USYC: 0n, USDC: 0n, PT: 0n, YT: 0n };
  for (const holding of await getOwnedHoldings(ledger, party)) {
    const id = holding.payload.instrumentId.id;
    if (id === "USYC" || id === "USDC") {
      balances[id] += decimalToUnits(holding.payload.amount);
    }
  }
  for (const position of await getMarketPositions(ledger, party)) {
    if (position.terms.marketId === DEMO_MARKET_ID) {
      balances.PT += decimalToUnits(position.ptTotal);
      balances.YT += decimalToUnits(position.ytTotal);
    }
  }
  return balances;
}

// after - before, as a decimal string, for example "-487.5000000000".
function delta(after: Balances, before: Balances, token: keyof Balances): string {
  return unitsToDecimal(after[token] - before[token]);
}

// ---------------------------------------------------------------------------
// Small steps used several times
// ---------------------------------------------------------------------------

// Alice asks Bank for a quote and Bank answers at `price`. Returns the quote id.
async function askAndQuote(parties: DemoParties, side: RfqSide, ptAmount: string, price: string, validForSeconds = 60): Promise<string> {
  await requestQuote(ledger, {
    requester: parties.Alice,
    dealer: parties.Bank,
    operator: parties.Operator,
    usdcIssuer: parties.UsdcIssuer,
    marketId: DEMO_MARKET_ID,
    side,
    ptAmount,
  });
  const requests = await getRfqRequests(ledger, parties.Bank);
  const rfq = requests[requests.length - 1];
  await quoteRfq(ledger, { dealer: parties.Bank, rfqId: rfq.contractId, price, validForSeconds });
  const quotes = await getQuotes(ledger, parties.Alice);
  if (quotes.length !== 1) {
    throw new Error(`Expected exactly one live quote for Alice, found ${quotes.length}`);
  }
  return quotes[0].contractId;
}

// The Operator's settlement run, printed.
async function settle(parties: DemoParties): Promise<MarketSettleReport> {
  const report = await settleMarketRequests(ledger, parties.Operator);
  for (const matured of report.matured) {
    console.log(`  Operator matured ${matured.marketId} at index ${matured.index}`);
  }
  for (const item of report.settled) {
    console.log(`  Operator settled ${item.kind} of ${item.owner.split("::")[0]}: ${formatAmount(item.usycPaid)} USYC`);
  }
  for (const item of report.skipped) {
    console.log(`  Operator skipped ${item.kind} of ${item.owner.split("::")[0]}: ${item.reason}`);
  }
  checkTrue("nothing left unsettled", report.skipped.length === 0);
  return report;
}

// ---------------------------------------------------------------------------
// The demo
// ---------------------------------------------------------------------------

// Stops unless the sandbox is fresh: clock at Oct 1 2026, Bank holding the
// 1000 PT + 1000 YT from bootstrap, and 1000 USYC in the vault.
async function checkFreshSandbox(parties: DemoParties): Promise<void> {
  const feed = await getRateFeed(ledger, parties.Oracle);
  if (feed === null || Date.parse(feed.payload.simTime) !== Date.parse(DEMO_START)) {
    throw new Error(
      `The demo clock is at ${feed?.payload.simTime ?? "?"}, not ${DEMO_START}. This script needs a fresh sandbox: ` +
        "restart `npm run ledger`, run `npm run bootstrap`, and keep `npm run oracle` stopped.",
    );
  }
  const market = await getMarket(ledger, parties.Operator, DEMO_MARKET_ID);
  if (market === null || market.payload.matured) {
    throw new Error(`Market ${DEMO_MARKET_ID} is missing or matured. Restart the sandbox and run \`npm run bootstrap\`.`);
  }
  const bank = await balancesOf(parties.Bank);
  const alice = await balancesOf(parties.Alice);
  const vault = await balancesOf(parties.Operator);
  if (bank.PT !== decimalToUnits("1000") || bank.YT !== decimalToUnits("1000") || alice.PT !== 0n || vault.USYC !== decimalToUnits("1000")) {
    throw new Error("The sandbox is not fresh (someone already traded). Restart `npm run ledger` and run `npm run bootstrap`.");
  }
}

async function main(): Promise<void> {
  console.log(`Exodus markets demo (spec section 9) on ${LEDGER_URL}`);
  const parties = await findDemoParties(ledger);
  if (parties === null) {
    throw new Error("Demo parties not found. Run `npm run bootstrap`.");
  }
  await checkFreshSandbox(parties);
  // Price snapshots expire after 30 s, and this script may run without the
  // oracle bot, so it publishes a heartbeat before each block that needs a price.
  await ensureFreshRate(ledger, parties.Oracle, 20_000);

  // -------------------------------------------------------------------------
  title("Step 1 (bootstrap): Bank split 1000 USYC at 1.00");
  const vaultStart = await balancesOf(parties.Operator);
  const bankStart = await balancesOf(parties.Bank);
  const aliceStart = await balancesOf(parties.Alice);
  check("Bank PT", unitsToDecimal(bankStart.PT), "1000");
  check("Bank YT", unitsToDecimal(bankStart.YT), "1000");
  check("Operator vault USYC", unitsToDecimal(vaultStart.USYC), "1000");

  // -------------------------------------------------------------------------
  title("Step 2 (Oct 1): Alice buys 500 PT from Bank at 0.975, privately");
  const quoteId = await askAndQuote(parties, "BuyPt", "500", "0.975");
  const [quote] = await getQuotes(ledger, parties.Alice);
  check("quote cash (USDC)", quote.payload.usdcAmount, "487.5");
  const years = yearsBetween(DEMO_START, DEMO_MATURITY);
  console.log(`  fixed APY of this quote: ${(fixedApyFromPrice(0.975, years) * 100).toFixed(2)}% (${Math.round(years * 365)} days to maturity)`);
  // Privacy (spec section 10): nobody but Alice and Bank sees the request or the price.
  for (const name of ["Operator", "UsdcIssuer", "UsycIssuer", "Oracle"] as const) {
    const seen = (await getQuotes(ledger, parties[name])).length + (await getRfqRequests(ledger, parties[name])).length;
    checkTrue(`${name} sees no quote and no request`, seen === 0);
  }
  await acceptQuote(ledger, { requester: parties.Alice, quoteId });
  const aliceAfterBuy = await balancesOf(parties.Alice);
  const bankAfterSale = await balancesOf(parties.Bank);
  check("Alice USDC change", delta(aliceAfterBuy, aliceStart, "USDC"), "-487.5");
  check("Alice PT", unitsToDecimal(aliceAfterBuy.PT), "500");
  check("Bank USDC change", delta(bankAfterSale, bankStart, "USDC"), "487.5");
  check("Bank PT", unitsToDecimal(bankAfterSale.PT), "500");

  // -------------------------------------------------------------------------
  title("Extra (Oct 1): split + merge back, sell + buy back, reject, expiry (all net to zero)");
  await ensureFreshRate(ledger, parties.Oracle, 20_000);

  // a. Alice gets 100 USYC from the fund (index 1.00), splits it, merges it back.
  await subscribeUsyc(ledger, { subscriber: parties.Alice, usycIssuer: parties.UsycIssuer, usdcAmount: "100" });
  const aliceBeforeSplit = await balancesOf(parties.Alice);
  check("Alice subscribed (USYC)", delta(aliceBeforeSplit, aliceAfterBuy, "USYC"), "100");
  await splitUsyc(ledger, { splitter: parties.Alice, operator: parties.Operator, marketId: DEMO_MARKET_ID, usycAmount: "100" });
  const aliceAfterSplit = await balancesOf(parties.Alice);
  check("Alice split: PT change", delta(aliceAfterSplit, aliceBeforeSplit, "PT"), "100");
  check("Alice split: YT change", delta(aliceAfterSplit, aliceBeforeSplit, "YT"), "100");
  await requestMerge(ledger, { owner: parties.Alice, operator: parties.Operator, marketId: DEMO_MARKET_ID, amount: "100" });
  await settle(parties);
  const aliceAfterMerge = await balancesOf(parties.Alice);
  check("Alice merge: USYC back (100 / 1.00)", delta(aliceAfterMerge, aliceAfterSplit, "USYC"), "100");
  check("Alice PT after merge", unitsToDecimal(aliceAfterMerge.PT), "500");
  check("Alice YT after merge", unitsToDecimal(aliceAfterMerge.YT), "0");

  // b. Alice sells 100 PT to Bank at 0.985, then buys them back at 0.985.
  await ensureFreshRate(ledger, parties.Oracle, 20_000);
  const sellQuoteId = await askAndQuote(parties, "SellPt", "100", "0.985");
  await acceptQuote(ledger, { requester: parties.Alice, quoteId: sellQuoteId });
  const aliceAfterSell = await balancesOf(parties.Alice);
  check("Alice sold 100 PT: USDC change", delta(aliceAfterSell, aliceAfterMerge, "USDC"), "98.5");
  const buyBackQuoteId = await askAndQuote(parties, "BuyPt", "100", "0.985");
  await acceptQuote(ledger, { requester: parties.Alice, quoteId: buyBackQuoteId });
  const aliceAfterBuyBack = await balancesOf(parties.Alice);
  check("Alice bought them back: USDC change", delta(aliceAfterBuyBack, aliceAfterSell, "USDC"), "-98.5");
  check("Alice PT", unitsToDecimal(aliceAfterBuyBack.PT), "500");

  // c. A rejected quote: Bank's locked PT is free again at once.
  const rejectedQuoteId = await askAndQuote(parties, "BuyPt", "50", "0.975");
  await rejectQuote(ledger, parties.Alice, rejectedQuoteId);
  const [bankAfterReject] = await getMarketPositions(ledger, parties.Bank);
  check("Bank free PT after the reject", bankAfterReject.ptFree, "500");

  // d. An expired quote: Alice can no longer accept; Bank withdraws it and unlocks its PT.
  await ensureFreshRate(ledger, parties.Oracle, 20_000);
  const expiringQuoteId = await askAndQuote(parties, "BuyPt", "50", "0.975", 2);
  await sleep(4000);
  await checkRefused("accepting an expired quote", () => acceptQuote(ledger, { requester: parties.Alice, quoteId: expiringQuoteId }), "expired");
  const withdrawn = await withdrawExpiredQuotes(ledger, parties.Bank);
  checkTrue("Bank withdrew 1 quote and unlocked 1 PT", withdrawn.withdrawnQuotes === 1 && withdrawn.unlockedPts === 1);
  const [bankAfterExpiry] = await getMarketPositions(ledger, parties.Bank);
  check("Bank free PT after the expiry", bankAfterExpiry.ptFree, "500");
  check("Operator vault USYC (unchanged by the extras)", unitsToDecimal((await balancesOf(parties.Operator)).USYC), "1000");

  // -------------------------------------------------------------------------
  title("Step 3 (Jan 1 2027, index 1.025): Bank claims the yield of 1000 YT");
  await publishRate(ledger, parties.Oracle, "1.025", JAN_1);
  const bankBeforeClaim = await balancesOf(parties.Bank);
  await requestClaim(ledger, { owner: parties.Bank, operator: parties.Operator, marketId: DEMO_MARKET_ID });
  await settle(parties);
  const bankAfterClaim = await balancesOf(parties.Bank);
  check("Bank claimed (USYC)", delta(bankAfterClaim, bankBeforeClaim, "USYC"), "24.390243");
  check("Bank YT (given back)", unitsToDecimal(bankAfterClaim.YT), "1000");

  // -------------------------------------------------------------------------
  title("Step 4 (Apr 1 2027, index 1.05): the market matures");
  await publishRate(ledger, parties.Oracle, "1.05", DEMO_MATURITY);
  await settle(parties);
  const snapshot = await getMaturitySnapshot(ledger, parties.Operator, DEMO_MARKET_ID);
  check("maturity index", snapshot?.payload.index ?? "0", "1.05");
  await checkRefused(
    "a split after maturity",
    () => splitUsyc(ledger, { splitter: parties.Alice, operator: parties.Operator, marketId: DEMO_MARKET_ID, usycAmount: "1" }),
    "matured",
  );
  await checkRefused("a quote request after maturity", () => askAndQuote(parties, "BuyPt", "10", "0.99"), "matured");

  // -------------------------------------------------------------------------
  title("Step 5: Alice redeems her 500 PT");
  await ensureFreshRate(ledger, parties.Oracle, 20_000);
  const aliceBeforeRedeem = await balancesOf(parties.Alice);
  await requestPtRedeem(ledger, { owner: parties.Alice, operator: parties.Operator, marketId: DEMO_MARKET_ID });
  await settle(parties);
  const aliceEnd = await balancesOf(parties.Alice);
  check("Alice redeemed (USYC, = 500 USD at 1.05)", delta(aliceEnd, aliceBeforeRedeem, "USYC"), "476.190476");
  check("Alice PT left", unitsToDecimal(aliceEnd.PT), "0");

  // -------------------------------------------------------------------------
  title("Step 6: Bank's final claim and its own 500 PT");
  await ensureFreshRate(ledger, parties.Oracle, 20_000);
  const bankBeforeFinal = await balancesOf(parties.Bank);
  await requestClaim(ledger, { owner: parties.Bank, operator: parties.Operator, marketId: DEMO_MARKET_ID });
  const claimReport = await settle(parties);
  check("Bank final claim (USYC, 1.025 -> 1.05)", claimReport.settled[0]?.usycPaid ?? "0", "23.228803");
  await requestPtRedeem(ledger, { owner: parties.Bank, operator: parties.Operator, marketId: DEMO_MARKET_ID });
  const redeemReport = await settle(parties);
  check("Bank redeemed 500 PT (USYC)", redeemReport.settled[0]?.usycPaid ?? "0", "476.190476");
  const bankEnd = await balancesOf(parties.Bank);
  check("Bank USYC change in step 6", delta(bankEnd, bankBeforeFinal, "USYC"), "499.419279");
  check("Bank PT left", unitsToDecimal(bankEnd.PT), "0");
  check("Bank YT left", unitsToDecimal(bankEnd.YT), "0");

  // -------------------------------------------------------------------------
  title("Step 7: the vault keeps only rounding dust");
  check("Operator vault USYC", unitsToDecimal((await balancesOf(parties.Operator)).USYC), "0.000002");

  // -------------------------------------------------------------------------
  title("Activity feeds (market rows)");
  const aliceKinds = (await getHoldingActivity(ledger, parties.Alice)).map((row) => row.kind).reverse();
  const bankKinds = (await getHoldingActivity(ledger, parties.Bank)).map((row) => row.kind).reverse();
  console.log(`  Alice: ${aliceKinds.join(", ")}`);
  console.log(`  Bank:  ${bankKinds.join(", ")}`);
  checkTrue(
    "Alice's feed has BOUGHT_PT, SPLIT, MERGED, SOLD_PT and REDEEMED_PT",
    (["BOUGHT_PT", "SPLIT", "MERGED", "SOLD_PT", "REDEEMED_PT"] as const).every((kind) => aliceKinds.includes(kind)),
  );
  checkTrue(
    "Bank's feed has SPLIT, SOLD_PT, BOUGHT_PT, CLAIMED (twice) and REDEEMED_PT",
    (["SPLIT", "SOLD_PT", "BOUGHT_PT", "REDEEMED_PT"] as const).every((kind) => bankKinds.includes(kind)) &&
      bankKinds.filter((kind) => kind === "CLAIMED").length === 2,
  );

  console.log(`\n${checks - failures}/${checks} checks passed.`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("\nDemo failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
