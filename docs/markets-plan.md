# Exodus Markets: the Pendle-lite plan

This file tracks the work from "simulated USYC works" (subscribe, redeem, send; done 2026-09-25) to a full **Pendle-lite** platform: split USYC into PT + YT, trade PT privately, claim yield, mature, redeem and merge. It records **what we decided and why**, the phases with their tasks, and a session log, so any new session can continue without re-asking.

Read first: the contract design in [`exodus.md`](exodus.md) (sections 7–12) and the client app decisions in [`client-app.md`](client-app.md).

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by our `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote. PT and YT are Exodus tokens on top of that simulation.

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

Settled by the spec (no choice needed): the vault is USYC owned by the Operator; `MarketTerms` is copied into every PT and YT (no contract keys in Daml 3.x); `Market` choices are nonconsuming except `Mature`; every payout uses `roundDown6`; maturity uses the oracle's `simTime`; settlement follows the request → operator settle → owner cancel pattern (same as `UsycRedeemRequest`).

## Formulas (spec section 9)

| Action | Formula | Example |
|---|---|---|
| Split | PT = YT = `roundDown6 (usycAmount * index)` | 1000 USYC at 1.00 → 1000 PT + 1000 YT |
| YT yield | `notional * (1/lastIndex - 1/newIndex)` USYC | 1000 YT, 1.00 → 1.025: 24.390243 USYC |
| PT redeem | `ptAmount / maturityIndex` USYC | 500 PT at 1.05: 476.190476 USYC |
| Merge | `amount / yt.lastIndex` USYC | 100 PT + 100 YT with lastIndex 1.025: 97.560975 USYC |
| Fixed APY | `(1/price)^(1/years) - 1` | 0.975 with 0.5 years left: ~5.19% |
| Dealer price for a target APY | `1 / (1 + apy)^years` | 5.2% with 0.5 years: ~0.975 |

## Status

| Phase | What | Status | Date | Commit |
|---|---|---|---|---|
| 1 | PT/YT tokens and Split | Done | 2026-09-25 | (fill in after commit) |
| 2 | Life cycle: claim, mature, redeem, merge | To do | | |
| 3 | Private RFQ and atomic DvP | To do | | |
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

- [ ] `IndexSource` (`CurrentRate` / `AtMaturity`) and `MaturitySnapshot`
- [ ] `ClaimRequest` / `YT_RequestClaim`: `Claim_Settle` (operator, pays `notional * (1/lastIndex - 1/newIndex)` from the vault, re-creates the YT with the new `lastIndex`), `Claim_Cancel` (owner)
- [ ] `Mature` is **consuming**: archives the `Market`, re-creates it with `matured = True` (gap 1); requires `simTime == maturity` (gap 2); creates `MaturitySnapshot`
- [ ] `RedeemRequest` / `PT_RequestRedeem` (rejected before maturity, gap 4): `Redeem_Settle` pays `ptAmount / maturityIndex`, `Redeem_Cancel`
- [ ] `MergeRequest` / `Market.RequestMerge` (PT and YT of the same size): `Merge_Settle` pays `amount / yt.lastIndex`, `Merge_Cancel`
- [ ] After maturity, claims use `AtMaturity` (the snapshot), never a newer price
- [ ] Tests: every formula with the section 9 numbers, a second `Mature` fails, early redeem fails, cancel returns the tokens, only owner + Operator see requests
- [ ] Update spec gaps 1, 2, 4 as fixed

**Done when:** all formulas are checked to 6 decimals, and gaps 1, 2 and 4 are marked fixed in the spec.

### Phase 3: Private RFQ and atomic DvP

Files: `main/daml/Exodus/Rfq.daml`, `test/daml/Exodus/RfqTest.daml`.

- [ ] `RfqRequest` (requester signs, dealer observes; `side = BuyPt | SellPt`, amount, market, requester's pass): `Rfq_Quote` (dealer), `Rfq_Cancel` (requester)
- [ ] `PT_Lock` / `PT_Unlock` on `PrincipalToken` (`lockedFor` observes; a locked PT cannot be transferred, split or merged). Moved here from Phase 1 (P2)
- [ ] `Quote` (requester + dealer sign): price in (0, 1], `validUntil` (gap 8); for a buy the dealer's PT is locked for the buyer
- [ ] `Quote_Accept`: cash via `payFrom` + PT delivered in **one** transaction; both passes checked; fails after `validUntil`
- [ ] `Quote_Reject` / `Quote_Withdraw` unlock the PT
- [ ] Tests: Alice buys 500 PT at 0.975 (pays 487.5 USDC); Alice sells 200 PT at 0.985; expired quote fails; locked PT cannot be sold twice; **Operator and UsdcIssuer see zero `Quote`s**
- [ ] Update spec sections 8.2 and 10 (sell side, expiry)

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
- [ ] `OperatorSettlementService`: settles claim/redeem/merge requests oldest first (like `RedeemSettlementService`), merges vault pieces, calls `Mature` when `simTime` reaches maturity (gap 3)
- [ ] `DealerBotService` (D2): answers RFQs to Bank with `price = 1 / (1 + targetApy ± spread)^years`; settings (target APY, spread, max size, on/off) in PostgreSQL via Prisma
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
- [ ] Treasury sweep of post-maturity vault dust (gap 5)
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
