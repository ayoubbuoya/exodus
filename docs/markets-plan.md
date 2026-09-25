# Exodus Markets: the Pendle-lite plan

This file tracks the work from "simulated USYC works" (subscribe, redeem, send; done 2026-09-25) to a full **Pendle-lite** platform: split USYC into PT + YT, trade PT privately, claim yield, mature, redeem and merge. It records **what we decided and why**, the phases with their tasks, and a session log, so any new session can continue without re-asking.

Read first: the contract design in [`exodus.md`](exodus.md) (sections 7–12) and the client app decisions in [`client-app.md`](client-app.md).

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by our `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote. PT and YT are Exodus tokens on top of that simulation.

**Guiding rule: we build our version of Pendle on Canton.** For every design question, first check what Pendle V2 actually does (read its contracts, for example [`PendleYieldToken.sol`](https://github.com/pendle-finance/pendle-core-v2-public/blob/main/contracts/core/YieldContracts/PendleYieldToken.sol)), explain it with real numbers, and follow it. Differ only where Canton needs it (privacy, UTXO contention, no contract keys), and write each difference and its reason in the decisions table below and in spec section 11.

**How to use this file:** before starting work, read the status table and the session log. When a task is done, tick its box. When a phase is done, fill in its row in the status table (date + commit). At the end of each session, add one line to the session log.

## The goal

What a user can do when we are finished (the spec section 9 example):

1. **Bank** (dealer) splits 1000 USYC and gets **1000 PT + 1000 YT** for the market `PT-USYC-APR2027`.
2. **Alice** opens **Markets** and sees: *USYC · matures Apr 1 2027 · underlying APY 5.1% · fixed APY ~5.19%*.
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
| 4 | Full demo test (`DemoTest.daml`) | To do | | |
| 5 | Ledger client and bootstrap | To do | | |
| 6 | Backend: markets API, operator bot, dealer bot | To do | | |
| 7 | Web app screens | To do | | |
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

- [ ] Spec section 9 steps 1–7 in one script with exact values: 1000 PT/YT, 487.5 USDC, 24.390243, 476.190476, 23.228803, 476.190476, vault dust **0.000002 USYC**
- [ ] Assert the profit table: Alice +12.5 USD, Bank +37.5 USD, total 50 USD

**Done when:** `dpm test -p demo` passes. This is the "math proof" for the judges.

### Phase 5: Ledger client and bootstrap (`@exodus/ledger`)

- [ ] `markets.ts`: read markets (as Operator, for disclosure), `splitUsyc`, `requestMerge`
- [ ] `tokens.ts`: PT/YT positions, claimable yield preview
- [ ] `rfq.ts`: create RFQ, list quotes, accept, reject; dealer side: list RFQs, quote, withdraw
- [ ] `lifecycle.ts`: request claim/redeem, cancel; settle calls and `mature` for the operator bot
- [ ] Pure helpers with `*.test.ts`: fixed APY, price for a target APY, claim preview, merge preview
- [ ] Bootstrap: create market `APR2027` (maturity = `DEMO_MATURITY`), Bank splits USYC so it holds PT to sell (idempotent)
- [ ] `getHoldingActivity` learns PT/YT rows: SPLIT, BOUGHT_PT, SOLD_PT, CLAIMED, REDEEMED_PT, MERGED
- [ ] `npm run codegen:daml`, typecheck, `npm test`

**Done when:** a Node script can run the full demo against the sandbox through `@exodus/ledger`.

### Phase 6: Backend: markets API, operator bot, dealer bot (`exodus-app/api`)

- [ ] `markets` module: `GET /markets`, `GET /markets/:id` (terms, underlying APY, indicative price + fixed APY (D5), days left, matured)
- [ ] `GET /portfolio` (PT, YT, claimable yield, open requests, USD value)
- [ ] Endpoints: split, merge, claim, redeem PT, cancel request; RFQ create / list quotes / accept / reject
- [ ] `OperatorSettlementService`: settles claim/redeem/merge requests oldest first (like `RedeemSettlementService`): claims with `CurrentRate` before maturity and `AtMaturity` after, redeems with the newest price; merges vault pieces; calls `Mature` with the first price on or after maturity (gap 3)
- [ ] `DealerBotService` (D2): answers RFQs to Bank with `price = 1 / (1 + targetApy ± spread)^years` (Pendle's formula), declines what it cannot fill, never touches cash it set aside for a sell quote, and after expiry sends `Quote_Withdraw` + `PT_Unlock` in one submission; settings (target APY, spread, max size, on/off) in PostgreSQL via Prisma
- [ ] Dealer endpoints for `/dealer` (dealer role only): open RFQs, manual quote, settings
- [ ] Ledger errors mapped in `toHttpError` (expired quote, market matured, not enough PT)
- [ ] Unit tests (pricing, preview maths, error mapping); Swagger docs; endpoint table in `client-app.md`

**Done when:** the full demo runs through the HTTP API with curl, and the bots settle and quote by themselves.

### Phase 7: Web app screens (`exodus-app/web`)

- [ ] `/markets`: market cards (maturity countdown, underlying APY, fixed APY, "Simulated" badge)
- [ ] `/markets/:id` tabs: **Trade** (buy or sell PT: get quote, expiry countdown, fixed APY of this quote, Accept), **Mint / Unmint** (split and merge with a live preview, "1000 USYC → 1025 PT + 1025 YT"), **Yield** (claimable yield, Claim), **Redeem** (after maturity)
- [ ] `/portfolio`: PT, YT, pending requests with Cancel, USD value
- [ ] `/dealer`: open RFQs, auto-quote settings, manual quote
- [ ] Navigation between Wallet (`/app`), Markets, Portfolio (and Dealer for dealers)
- [ ] `/lab`: add Market, PT, YT, Quote rows to the "what can this party see?" table
- [ ] Activity labels for the new rows
- [ ] Checked in headless Chromium (dark, light, 390 px): the 7-step demo script from spec section 13

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
