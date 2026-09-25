# Exodus Markets: the Pendle-lite plan

This file tracks the work from "simulated USYC works" (subscribe, redeem, send; done 2026-09-25) to a full **Pendle-lite** platform: split USYC into PT + YT, trade PT privately, claim yield, mature, redeem and merge. It records **what we decided and why**, the phases with their tasks, and a session log, so any new session can continue without re-asking.

Read first: the contract design in [`exodus.md`](exodus.md) (sections 7–12) and the client app decisions in [`client-app.md`](client-app.md).

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by our `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote. PT and YT are Exodus tokens on top of that simulation.

**Guiding rule: we build our version of Pendle on Canton.** For every design question, first check what Pendle V2 actually does (read its contracts, for example [`PendleYieldToken.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldToken.sol)), explain it with real numbers, and follow it. Differ only where Canton needs it (privacy, UTXO contention, no contract keys), and write each difference and its reason in the decisions table below and in spec section 11.

**How to use this file:** before starting work, read the status table and the session log. When a task is done, tick its box. When a phase is done, fill in its row in the status table (date + commit). At the end of each session, add one line to the session log.

## The goal

What a user can do when we are finished (the spec section 9 example):

1. **Bank** (dealer) splits 1000 USYC and gets **1000 PT + 1000 YT** for the market `PT-USYC-APR2027`.
2. **Alice** opens **Markets** and sees: *USYC · matures Apr 1 2027 · underlying APY · fixed APY from the house dealer* (on Oct 1, before there is price history: 5.2 % target → buy at 0.975503, 5.1 % fixed; from Oct 8 the target follows the demo's underlying APY of ~10.3 %, see M2). The spec's own quote of **0.975 → ~5.19 %** stays the math proof in `DemoTest` and `demo:markets`.
3. Alice clicks **Buy PT** for 500 PT and gets a private quote of **0.975**. She accepts, and in one transaction **487.5 USDC** goes to Bank and **500 PT** to Alice. The Operator never sees the price.
4. On Jan 1 Bank claims **24.390243 USYC** of YT yield.
5. On Apr 1 the market **matures** by itself. Alice redeems and gets **476.190476 USYC** (worth 500 USD).
6. Before maturity, anyone can **merge** PT + YT back into USYC, or **sell PT** back to the dealer.

### Pendle feature → Exodus version

| Pendle | Exodus |
|---|---|
| Markets list | Markets page: maturity, underlying APY, fixed APY, days left |
| Mint PT + YT | **Split** (`Market.Split`) |
| Redeem PT + YT before maturity | **Merge** (request, then the operator settles) |
| Swap on the AMM | **Private RFQ + atomic DvP** (no pool, no public price) |
| Claim YT yield | `YT_RequestClaim`, then the operator bot settles |
| Redeem PT at maturity | `PT_RequestRedeem`, then the operator bot settles |
| Provide liquidity (LP) | **Dealer desk**: a dealer holds PT and quotes |
| Portfolio | Portfolio page: PT, YT, claimable yield, USD value |

## Decisions (agreed 2026-09-25)

| # | Topic | Choice | Why (short) | Option not taken |
|---|---|---|---|---|
| D1 | Market access | **`ClientAccess` pass + explicit disclosure.** `Market` has no client observers; `Split`, RFQ and every request take the client's pass and call `checkAccess`; the backend discloses the `Market` (and `MaturitySnapshot`) to the client's command, like `UsycFund` | Approving Carol never re-creates a market (no contention), clients cannot see each other, same proven pattern as the fund | B: `members` observer list on `Market` (the old spec). It leaks the client list and needs the market re-created on each approval |
| D2 | Who quotes | **House dealer bot + manual quoting.** Bank is the house dealer. A bot in the API auto-quotes from a target fixed APY and a spread; a `/dealer` page lets a human override | Alice gets a quote in ~2 s (Pendle-like), and the demo never waits for a person | B: humans only (two browsers, Alice waits). C: fully peer-to-peer (every client is a dealer; much more UI) |
| D3 | Trades | **Buy and sell PT now** (`RfqRequest` has a `side`). YT trading is a stretch goal (Phase 8) | Alice can exit before maturity without holding YT | B: buy PT only (the old spec) |
| D4 | Creating markets | **One demo market `APR2027` from bootstrap now**; an admin "Create market" form later (Phase 8) | The oracle's demo schedule ends at Apr 1 2027, so more markets need a longer clock anyway | B: admin form from the start |
| D5 | Public price on the Markets page | **Indicative price from the house dealer's settings**, served off-ledger by the API ("Indicative 0.975 · 5.19% fixed"). Real quotes stay private on the ledger | A useful product page without leaking any real trade | B: no price until you ask for a quote (most private, weak page) |
| P1 | Pass check on PT/YT transfers (Phase 1, 2026-09-25) | **Both passes**: `PT_Transfer` / `YT_Transfer` take the sender's and the receiver's `ClientAccess` pass, like the USYC/USDC factory. The app discloses the receiver's pass (read as the Operator) | PT/YT only move between approved clients; we do not repeat spec gap 11 | B: no check, like `Holding.Transfer` |
| P2 | When to build the PT lock (Phase 1, 2026-09-25) | **In Phase 3, with the RFQ** | The lock only exists for quotes, so its rules (who unlocks, what happens on quote expiry) are designed together with `Quote` | B: build it in Phase 1 and guess its rules |
| Q1 | Maturity rule (Phase 2, 2026-09-25) | **Like Pendle.** `Mature` takes the first price on or after maturity (Pendle's `firstPYIndex` = first transaction after expiry); YT final claims stop at that snapshot; a PT redeem pays `ptAmount / index at settle time`, so 1 PT always pays 1 USD of value; post-maturity yield stays in the vault for the treasury (gap 5) | A market can never get stuck if the clock jumps past the date; PT holders never lose; same trade-off as Pendle (a late snapshot gives YT holders a little extra) | A: strict `simTime == maturity` and PT pays `ptAmount / maturityIndex` (the old spec): exact, but stuck forever if the clock overshoots |
| Q2 | Where merge lives (Phase 2, 2026-09-25) | **On the token**: `PT_RequestMerge` (YT of the same market, `mergeAmount`, pass, live price), before maturity only, like Pendle's `redeemPY` on the yield token | No Market disclosure; not affected by `Mature` re-creating the Market; after maturity merge = PT redeem + YT final claim, as in Pendle | B: `Market.RequestMerge` (the old spec) |
| R1 | RFQ price form (Phase 3, 2026-09-25) | **A number (0.975) with a short expiry (~60 s)**. Pendle's formula `price = (1 + APY)^(−years)` is used off-ledger (dealer bot, UI) | Pendle's limit orders carry `lnImpliedRate` because they live for weeks; ours live seconds, and a price keeps cash amounts exact (487.5 USDC) | B: implied APY on-ledger like Pendle (approximate `exp`/`log` on Decimal) |
| R2 | Firm quotes (Phase 3) | **Dealer's PT locked for the buyer** until `validUntil`; the dealer cannot withdraw or unlock before. Sell side: exact USDC set aside but not lockable, so an accept fails if the dealer spent it (Pendle's rule) | Institutional RFQ quotes are firm; the spec forbids selling the same PT twice | B: no lock, like Pendle (a fill fails if the maker's tokens are gone) |
| R3 | Fills (Phase 3) | **Full size only** | A quote is for exactly what was asked; simpler | B: partial fills like Pendle |
| R4 | Cash leg (Phase 3) | **USDC** (cash-for-bond DvP) | Institutional story; keeps the privacy split (UsdcIssuer sees cash, Operator sees PT) | B: USYC, like Pendle's SY |
| L1 | Dealer stock from bootstrap (Phase 5, 2026-09-25) | **Bank splits its 1000 USYC** into 1000 PT + 1000 YT (spec step 1) and gets **10,000 USDC** of dealer cash to buy PT back | The spec section 9 numbers stay exact; the sell side works from day one | B: Bank starts with 10,000 USYC (changes the profit table). C: no dealer cash (sell side only in Phase 6) |
| L2 | Activity rows for payouts (Phase 5) | **PT/YT inside the owner's open request still count as the owner's**: only the settled result shows (CLAIMED +24.390243 USYC); asking and cancelling add no row; open requests are listed apart | The feed shows what really changed. The fund's USYC redeem keeps its two rows, because there the USYC is really burned | A: two rows per payout, like the USYC redeem ("YT −1000", then "+24.39 USYC, +1000 YT") |
| M1 | Who runs the dealer desk (Phase 6, 2026-09-25) | **Admins** (`AdminGuard` on `/api/dealer/*`), acting as Bank | No new role or seed; "the platform runs the house dealer" (D2) | B: a new `DEALER` role linked to Bank |
| M2 | Where the dealer's target APY comes from (Phase 6) | **Follow the underlying, like Pendle's implied rate**: target = underlying 30-day APY + offset (default 0), fallback 5.2 % until 7 demo days of history; spread in APY points like Pendle's fee (`lnFeeRateRoot`); rounding in the dealer's favour | A consistent Markets page ("underlying 10.29 % · fixed 10.19 %") instead of a fixed rate far below the floating one. Note: the demo's index path (1.00 → 1.025 in 92 days) is ~10.3 % a year; the old "underlying 5.1 %" was the 6-month return | A: a fixed 5.2 % target (reproduces 0.975 but shows "underlying 10.3 % · fixed 5.2 %") |
| W1 | Bank's own claim / PT redeem in the browser demo (Phase 7, 2026-09-25) | **Dealer desk buttons** ("Claim Bank's yield", "Redeem Bank's PT") backed by `POST /dealer/markets/:id/claims` and `/pt-redemptions` (admins) | The whole spec section 13 demo stays inside the product | B: buttons in `/lab` acting as Bank. C: no Bank buttons |
| W2 | Wording (Phase 7) | **Pendle's words first, the ledger's words in the help text**: tabs "Fixed Yield (PT)", "Mint / Redeem", "Yield (YT)", "At maturity"; "Mint PT + YT (split on the ledger)" | Anyone who knows Pendle recognises the screens | B: only contract words (Split / Merge) |
| W3 | Wallet activity (Phase 7) | **The Wallet shows every row** that touched USDC/USYC, market rows tagged "Markets"; the Portfolio shows only market rows | The USYC balance is always explained, and the two products stay on their own pages | B: market rows only on the Portfolio |
| L3 | Demo script and the clock (Phase 5) | **`npm run demo:markets` publishes the Jan 1 and Apr 1 prices itself** on a fresh sandbox and stops with a clear message otherwise | The whole section 9 story in ~15 s, checked to 6 decimals | B: only the steps before maturity, never moving the clock |

Settled by the spec (no choice needed): the vault is USYC owned by the Operator; `MarketTerms` is copied into every PT and YT (no contract keys in Daml 3.x); `Market` choices are nonconsuming except `Mature`; every payout uses `roundDown6`; maturity uses the oracle's `simTime`; settlement follows the request → operator settle → owner cancel pattern (same as `UsycRedeemRequest`).

## Formulas (spec section 9)

| Action | Formula | Example |
|---|---|---|
| Split | PT = YT = `roundDown6 (usycAmount * index)` | 1000 USYC at 1.00 → 1000 PT + 1000 YT |
| YT yield | `notional * (1/lastIndex - 1/newIndex)` USYC | 1000 YT, 1.00 → 1.025: 24.390243 USYC |
| PT redeem | `ptAmount / index at settle time` USYC (never below the maturity index; Q1) | 500 PT at 1.05: 476.190476 USYC; at 1.06: 471.698113 USYC (still 500 USD) |
| Merge | `amount / yt.lastIndex` USYC | 100 PT + 100 YT with lastIndex 1.025: 97.560975 USYC |
| Fixed APY | `(1/price)^(1/years) - 1` | 0.975 with 0.5 years left: ~5.19% |
| Dealer price for a target APY | `1 / (1 + apy)^years` | 5.2% with 0.5 years: ~0.975 |

## Status

| Phase | What | Status | Date | Commit |
|---|---|---|---|---|
| 1 | PT/YT tokens and Split | Done | 2026-09-25 | (fill in after commit) |
| 2 | Life cycle: claim, mature, redeem, merge | Done | 2026-09-25 | (fill in after commit) |
| 3 | Private RFQ and atomic DvP | Done | 2026-09-25 | (fill in after commit) |
| 4 | Full demo test (`DemoTest.daml`) | Done | 2026-09-25 | (fill in after commit) |
| 5 | Ledger client and bootstrap | Done | 2026-09-25 | `1bd0dff` |
| 6 | Backend: markets API, operator bot, dealer bot | Done | 2026-09-25 | `d9b00f0` |
| 7 | Web app screens | Done | 2026-09-25 | (fill in after commit) |
| 8 | Hardening and token standard (stretch) | To do | | |
| 9 | Ship: docs, deploy, video, pitch | To do | | |

Phases 1–7 are the must-have product. Phase 8 is done if time allows. Phase 9 is always done. Each phase starts with its own detailed implementation plan for approval (CLAUDE.md working rules) and ends with passing tests and a commit.

## Phases

### Phase 1: PT/YT tokens and Split

Files: `main/daml/Exodus/Tokens.daml`, `main/daml/Exodus/Market.daml`, `test/daml/Exodus/MarketTest.daml`.

- [x] `MarketTerms` (marketId, assetIssuer, instrument, oracle, maturity). `IndexSource` moved to Phase 2 (it needs `MaturitySnapshot`)
- [x] `PrincipalToken` (Operator signs; owner observes): `PT_Transfer` (both passes, P1), `PT_SplitOff`, `PT_MergeWith` (same market). `PT_Lock` / `PT_Unlock` moved to Phase 3 (P2)
- [x] `YieldToken` (Operator signs; owner observes; keeps `lastIndex`): `YT_Transfer` (both passes), `YT_SplitOff`, `YT_MergeWith` (same market and same `lastIndex`)
- [x] `Market` (Operator signs, `matured` flag, no client observers, D1), nonconsuming `Split`: `checkAccess`, `fetchValidRate`, USYC to the Operator vault via `payFrom`, mint `roundDown6 (usycAmount * index)` PT and YT
- [x] `Split` fails when: no, wrong or revoked pass, fake or foreign USYC, USDC, expired price, fake oracle, other asset, market matured, `simTime >= maturity`, amount 0 or 7 decimals, not enough USYC
- [x] Tests in `MarketTest.daml`: `marketSplit`, `marketSplitAtIndex`, `marketSplitFailures`, `marketSplitNeedsAccessPass`, `marketSplitTimeRules`, `tokenTransfers`, `marketPrivacy` (each failure checked once with a plain `submit` to confirm it fails for the intended reason)
- [x] Update spec section 7 tables (`Market` observers, pass on `Split`, PT/YT choices), 8.1 rules, file tree

**Done when:** `dpm test` passes with the new tests, and the spec tables match the code.

### Phase 2: Life cycle: claim, mature, redeem, merge

Files: `Tokens.daml`, `Market.daml`, `test/daml/Exodus/LifecycleTest.daml`.

- [x] `IndexSource` (`CurrentRate` / `AtMaturity`), `MaturitySnapshot` (no observers, disclosed), helpers `fetchMarketRate` (also used by `Split` now), `fetchMaturitySnapshot`, `yieldIndex`
- [x] `ClaimRequest` / `YT_RequestClaim` (pass): `Claim_Settle` (operator, pays `roundDown6 (amount/lastIndex - amount/newIndex)`; YT back with the new `lastIndex`, unchanged if nothing was paid, used up after the `AtMaturity` final claim; refuses an index below `lastIndex` and a live price after maturity), `Claim_Cancel` (owner, no pass)
- [x] `Mature` is **consuming**: re-creates the `Market` with `matured = True` (gap 1); takes the first price on or after maturity (Q1, Pendle-style; gap 2 fixed differently); creates `MaturitySnapshot`
- [x] `RedeemRequest` / `PT_RequestRedeem` (pass + disclosed snapshot, so never before `Mature`, gap 4; copies `maturityIndex`): `Redeem_Settle` pays `ptAmount / index at settle` (price must be ≥ `maturityIndex`), `Redeem_Cancel`
- [x] `MergeRequest` / `PT_RequestMerge` on the token (Q2; `mergeAmount` with PT/YT change; before maturity only): `Merge_Settle` pays `amount / lastIndex`, `Merge_Cancel` gives both back
- [x] Tests in `LifecycleTest.daml`: `claimBeforeMaturity`, `claimFailures`, `matureMarket`, `redeemAndFinalClaim` (section 9 steps 5–7, vault dust 0.000001), `matureLateLikePendle` (clock jumps to Apr 10), `mergeTokens`, `requestsNeedAccessPass`, `lifecyclePrivacy`. 15 failure cases checked once with a plain `submit` to confirm the intended reason
- [x] Spec: tables, sections 8.3–8.6, formula, section 11 (guiding rule + Pendle differences), gaps 1, 2, 4 fixed, gap 5 updated

**Done when:** all formulas are checked to 6 decimals, and gaps 1, 2 and 4 are marked fixed in the spec.

### Phase 3: Private RFQ and atomic DvP

Files: `main/daml/Exodus/Rfq.daml`, `test/daml/Exodus/RfqTest.daml`.

- [x] `RfqRequest` (requester signs, dealer observes; `side = BuyPt | SellPt`, `ptAmount`, `terms`, requester's pass): `Rfq_Quote` (dealer; checks both passes, price in (0, 1], future `validUntil`; BuyPt locks exactly `ptAmount` PT, SellPt sets aside exactly the cash), `Rfq_Cancel` (requester), `Rfq_Decline` (dealer)
- [x] PT lock on `PrincipalToken`: field `lock : Optional PtLock (holder, lockedUntil)` (holder observes; like CIP-56's `lock`). `PT_Lock`, `PT_Unlock` (owner, only after `lockedUntil`), `PT_ReleaseLock` (holder), `PT_DeliverLocked` (owner AND holder, both passes), `PT_AssertBeforeMaturity` (nonconsuming price check on the Operator's authority). Every other PT choice refuses a locked PT. Moved here from Phase 1 (P2)
- [x] Helpers: `splitExact` in `Holding.daml` (`payFrom` now uses it) and `splitExactPt` in `Tokens.daml`
- [x] `Quote` (requester + dealer sign, no observers): price, `usdcAmount = roundDown6 (price * ptAmount)`, `validUntil` (gap 8)
- [x] `Quote_Accept`: cash + PT in **one** transaction; both passes checked again; fails after `validUntil` and at or after maturity (like Pendle)
- [x] `Quote_Reject` (releases the lock before expiry) / `Quote_Withdraw` (dealer, only after expiry; then `PT_Unlock`)
- [x] Tests in `RfqTest.daml`: `rfqBuyPt` (487.5 USDC for 500 PT), `rfqSellPt` (197 USDC for 200 PT), `quoteExpiry`, `lockedPtRules`, `rfqFailures`, `rfqPrivacy` (**Operator, UsdcIssuer, UsycIssuer, Oracle, Carol see zero `Quote`/`RfqRequest`**). 17 failure cases checked once with a plain `submit`
- [x] Spec: tables, 8.2 (both sides, expiry, lock), section 10, section 11 (RFQ vs Pendle limit orders), gap 8 fixed

**Done when:** the privacy assertions pass, and a double sale of locked PT is impossible.

### Phase 4: Full demo test

File: `test/daml/Exodus/DemoTest.daml`.

- [x] Spec section 9 steps 0–7 in one script (`demoWorkedExample`) with exact values: 1000 PT/YT, 487.5 USDC, fixed APY ~5.19%, 24.390243, 476.190476, 23.228803, 476.190476, vault dust **0.000002 USYC**, no PT/YT left; Operator and UsdcIssuer see no quote
- [x] Assert the profit table: Alice +12.5 USD, Bank +37.5 USD (523.809522 USYC + 487.5 USDC), total 50 USD = the fund's yield (USD values within 0.00001: rounding dust)

**Done when:** `dpm test -p demo` passes. This is the "math proof" for the judges.

### Phase 5: Ledger client and bootstrap (`@exodus/ledger`)

- [x] `markets.ts`: read markets and maturity snapshots (as Operator, for disclosure), the market's price, `splitUsyc`, `requestMerge` (joins PT/YT pieces first; retries once on a stale contract)
- [x] `tokens.ts`: PT/YT positions (free vs locked PT, claimable yield preview), `mergePtPieces`, `mergeYtPieces`
- [x] `rfq.ts`: `requestQuote`, `getRfqRequests`, `getQuotes`, `acceptQuote` (discloses the dealer's pass, the price and, when selling, the dealer's USDC read as UsdcIssuer), `rejectQuote`, `cancelRfq`; dealer side: `quoteRfq`, `declineRfq`, `withdrawExpiredQuotes` (`Quote_Withdraw` + `PT_Unlock` in one transaction, plus stray expired locks)
- [x] `lifecycle.ts`: `requestClaim`, `requestPtRedeem` (join pieces first: rounding is per request), list and cancel requests; `matureDueMarkets` and `settleMarketRequests` (oldest first across claim/redeem/merge) for the operator bot
- [x] Pure helpers with `*.test.ts`: `market-math.ts` (fixed APY, price for a target APY with Pendle's 365-day year, exact split/claim/merge/redeem/quote previews), Daml-exact `divideDaml`/`multiplyDaml` (round half to even) in `decimal.ts`
- [x] Client: `exerciseCommand` + `submitCommands` (several choices in one transaction); `pickInputs` works for PT; `oracle.ts` (`publishRate`, `ensureFreshRate`)
- [x] Bootstrap: market `PT-USYC-APR2027` (maturity = `DEMO_MATURITY`), 10,000 USDC dealer cash for Bank, Bank splits 1000 USYC (L1; idempotent, heartbeat before the split)
- [x] `getHoldingActivity` learns PT/YT rows: SPLIT, BOUGHT_PT, SOLD_PT, CLAIMED, REDEEMED_PT, MERGED (L2). Fixed `unitsToDecimal` for negative amounts with a fraction ("-487.5", was "-487.-5")
- [x] `npm run codegen:daml`, typecheck, `npm test` (46 ledger + 15 api + 12 web)
- [x] `npm run demo:markets` (L3): 47/47 checks on a fresh sandbox

**Done when:** a Node script can run the full demo against the sandbox through `@exodus/ledger`.

### Phase 6: Backend: markets API, operator bot, dealer bot (`exodus-app/api`)

- [x] `markets` module (`api/src/markets/`, apart from the fund's `wallets`): `GET /markets`, `GET /markets/:id` (terms, days left, matured + maturity index, underlying APY, indicative ask/bid/mid + fixed APY (D5))
- [x] `GET /portfolio` (PT free/locked, YT, claimable yield, USD value with YT = 1 − PT like Pendle, open requests with an estimate), `DELETE /portfolio/requests/:id`
- [x] Endpoints: splits, merges, claims, pt-redemptions; `quote-requests` (create / list / cancel), `quotes` (list / acceptance / rejection)
- [x] `OperatorSettlementService` (every `MARKET_SETTLE_SECONDS`): `settleMarketRequests` = mature due markets (gap 3) + pay claims (`CurrentRate` / `AtMaturity`), PT redeems (newest price) and merges, oldest first
- [x] `DealerBotService` (every `DEALER_POLL_SECONDS`, D2): withdraws expired quotes (`Quote_Withdraw` + `PT_Unlock` in one submission), answers RFQs with `(1 + target ∓ spread)^−years` (M2), declines over-size / at-maturity / unfillable requests (our own error messages; ledger hiccups are retried), leaves RFQs to the desk when auto-quote is off. Fixed in `@exodus/ledger`: `quoteRfq` never spends USDC set aside for another live sell quote (`setAsideUsdcIds`, tested)
- [x] `DealerSettings` table (Prisma migration `add_dealer_settings`): auto-quote, APY offset, fallback APY, spread, max PT per quote, quote lifetime
- [x] Dealer desk for admins (M1): `GET /dealer/quote-requests` (with suggested price), manual quote, decline, `GET /dealer/position`, `GET`/`PUT /dealer/settings`
- [x] Errors: the existing `toHttpError` already maps our messages (422) and stale contracts (409); new tests for the market messages and `isUserMessageError` (now shared with the dealer bot)
- [x] Unit tests: `dealer-pricing.test.ts`, `portfolio-value.test.ts`, error mapping (27 api tests); Swagger on every endpoint; endpoint table in `client-app.md`
- [x] Live run over HTTP on a throwaway sandbox + database: sign-up → approve → faucet → subscribe → RFQ quoted in 1.7 s → accept → split → merge (settled in < 3 s) → sell (USDC set aside) → 5000 PT declined → manual desk quote → reject → Jan 1 claim 0.487804 USYC (target 10.29 %) → Apr 1 matured by the bot → PT redeem 23.809523 + final claim 0.464576 USYC

**Done when:** the full demo runs through the HTTP API with curl, and the bots settle and quote by themselves.

### Phase 7: Web app screens (`exodus-app/web`)

- [x] `/markets`: market cards (maturity + demo days left, underlying APY, fixed APY, PT buy/sell price, Open/Matured, "Simulated" badge)
- [x] `/markets/:id` tabs (W2): **Fixed Yield (PT)** (buy or sell: indicative price → Get firm quote → waiting / quote with countdown, cash and fixed APY → Accept / Reject; expired and declined states), **Mint / Redeem** (split with "30 USYC → 30 PT + 30 YT" preview; merge with the exact `amount / lastIndex` preview), **Yield (YT)** (claimable, Claim; final claim after maturity), **At maturity** (redeem PT); "Your position" card; non-clients see a note instead of the actions
- [x] `/portfolio`: total USD (Pendle: YT = 1 − PT), one row per market, open requests with Cancel, market activity
- [x] `/dealer` (admins, M1): open RFQs with the bot's price and manual Quote / Decline, Bank's position (USDC set aside, PT locked) with Bank's Claim / Redeem (W1), live quotes, bot settings form
- [x] Navigation: Wallet · Markets · Portfolio for clients; Markets · Dealer · Admin for admins; Lab for everyone
- [x] `/lab`: a "Markets: n Market, n PrincipalToken, n YieldToken, n RfqRequest, n Quote" line per party, and `terms` shown as the market id
- [x] Activity labels (Minted PT + YT, Bought PT, Sold PT, Claimed yield, Redeemed PT, Redeemed PT + YT) with short PT/YT symbols; Wallet tags market rows (W3)
- [x] API: `ytPieces` (with `lastIndex`) on each portfolio position; dealer claim / PT redeem endpoints (W1)
- [x] Pure helpers with tests (`lib/markets.ts`: quote flow status, answering quote, countdown, merge lastIndex, market rows; `formatPercent`); Vite proxy targets overridable with `LEDGER_URL` / `API_URL`
- [x] Checked in headless Chromium on a throwaway stack (dark, light, 390 px, no console errors, no sideways scroll at 390 px): quote in 2.3 s at 0.975503 (5.10 %) → Accept; lab: Operator 0 Quote while Bank 1; mint 30, merge 10; 5000 PT declined; Jan 1: Bank's claim from the desk **24.390243 USYC**, Carol 0.487804; Apr 1: matured by the bot, Carol's 40 PT → 38.095238 USYC, final claims 0.464576 and Bank **23.228803**, Bank's 980 PT → 933.333333. Found and fixed: the "At maturity" tab showed "Your PT 0" while loading

**Done when:** the spec section 13 demo runs end to end in the browser.

### Phase 8: Hardening and token standard (stretch)

- [ ] CIP-56 `Holding` interface instance for PT and YT, locked PT uses `lock` (gap 7)
- [ ] Treasury sweep of what stays in the vault after maturity: YT yield past the snapshot, yield on principal redeemed at a later price, and rounding dust (gap 5; Pendle: `redeemInterestAndRewardsPostExpiryForTreasury`)
- [ ] Read disclosures with the backend's ledger user, submit with the client's (gap 15)
- [ ] Registry API `/registry/...` in the backend (gap 10)
- [ ] YT trading through RFQ (D3 stretch)
- [ ] Admin "Create market" form (D4 later part)

### Phase 9: Ship

- [ ] Spec (`exodus.md`): sections 6, 7, 8, 10, 12, 13 match the code
- [ ] `client-app.md`, `run-locally.md`, `exodus-app/README.md`, root `README.md` (screenshots), CLAUDE.md
- [ ] Deploy on LocalNet / DevNet
- [ ] Record the 3-minute demo video, pitch deck (spec section 14)

## Session log

- 2026-09-25: plan agreed with all recommended decisions (D1–D5 = A). Next: Phase 1 detailed plan.
- 2026-09-25: Phase 1 done (P1 = A, P2 = A). `Tokens.daml`, `Market.daml`, `MarketTest.daml`; 39 Daml scripts pass. No app changes yet (screens are Phase 7). Next: Phase 2 detailed plan.
- 2026-09-25: Phase 2 done after reading Pendle V2's `PendleYieldToken.sol`: Q1 = Pendle-style maturity, Q2 = merge on the token. Added the guiding rule "our version of Pendle on Canton". 47 Daml scripts pass. Next: Phase 3 detailed plan (RFQ + PT lock).
- 2026-09-25: Phase 3 done after reading Pendle V2's limit-order contracts (`IPLimitRouter`, `LimitRouterBase`, `LimitMathCore`, `MarketMathCore`): R1–R4 = A. `Rfq.daml`, PT lock, `splitExact`/`splitExactPt`, `RfqTest.daml`; 54 Daml scripts pass. Next: Phase 4 (`DemoTest.daml`).
- 2026-09-25: Phase 4 done: `DemoTest.demoWorkedExample` proves spec section 9 end to end (profit table, vault dust 0.000002); 55 Daml scripts pass. The Daml contracts are complete. Next: Phase 5 detailed plan (ledger client and bootstrap).
- 2026-09-25: Phase 5 done (L1–L3 = recommended). `markets.ts`, `tokens.ts`, `rfq.ts`, `lifecycle.ts`, `market-math.ts`, `oracle.ts`, bootstrap market + Bank split, PT/YT activity rows, `npm run demo:markets` (47/47 checks on a throwaway sandbox). Agreed with the user: the USYC fund (subscribe/redeem) is only the simulated on-ramp; the markets are the product, on their own pages and flows (Phase 7). Next: Phase 6 detailed plan (markets API, operator bot, dealer bot).
- 2026-09-25: Phase 6 done (M1 = admins run the dealer desk, M2 = target follows the underlying APY). New `api/src/markets/` module: markets, portfolio, trading and dealer endpoints, `OperatorSettlementService`, `DealerBotService`, `DealerSettings` table; fixed `quoteRfq` spending set-aside USDC. 27 api + 48 ledger tests; full live run over HTTP on a throwaway sandbox and database. Found: the demo's underlying APY is ~10.3 %, not 5.1 % (goal text corrected). Next: Phase 7 detailed plan (web screens, on their own pages apart from the fund wallet).
- 2026-09-25: Phase 7 done (W1 = Bank's claim/redeem on the dealer desk, W2 = Pendle's words first, W3 = Wallet shows all rows with a "Markets" tag). `/markets`, `/markets/:id` (4 tabs), `/portfolio`, `/dealer`, nav, activity labels, `/lab` markets line; small API additions (`ytPieces`, dealer payouts). The spec section 13 story ran in headless Chromium on a throwaway stack with the spec numbers (24.390243, 23.228803). Phases 1–7 (the must-have product) are complete. Next: Phase 9 (ship), Phase 8 if time allows.
