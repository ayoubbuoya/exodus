# Exodus vs Pendle V2: what is different, and why

This document compares Exodus with **Pendle V2**, the protocol it copies. For every difference it answers three questions:

1. **What does Pendle do?** Taken from Pendle's own code and docs, not from memory.
2. **What does Exodus do, and why?** Either **Canton needs it** (explained in depth), or **we kept it simple** for the hackathon.
3. **How could we make it work like Pendle?** What it would cost, and whether it is worth it.

> **Simulation notice.** "USYC" and "USDC" in Exodus are simulated tokens issued by our `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote.

**Sources checked (2026-09-28):**
- Pendle code: [`pendle-finance/pendle-core-v2-public`](https://github.com/pendle-finance/pendle-core-v2-public), commit `87685c8` (2026-09-22). Main files: `contracts/core/YieldContracts/PendleYieldToken.sol`, `InterestManagerYT.sol`, `PendlePrincipalToken.sol`, `PendleYieldContractFactoryUpg.sol`, `contracts/core/Market/PendleMarketV7.sol`, `MarketMathCore.sol`, `contracts/interfaces/IPLimitRouter.sol`.
- Pendle docs: [SY](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/SY), [PT](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/PT), [YT](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/YieldTokenization/YT), [AMM](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/LiquidityEngines/AMM), [Order book](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/LiquidityEngines/OrderBook), [Fees](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/Mechanisms/Fees), [Negative yield](https://docs.pendle.finance/pendle-v2/ProtocolMechanics/NegativeYield), [Oracles](https://docs.pendle.finance/pendle-v2-dev/Oracles/OracleOverview), [Market factory](https://docs.pendle.finance/pendle-v2-dev/Contracts/PendleMarket/MarketFactory).
- Exodus: `exodus-contract/main/daml/Exodus/*.daml`, [`exodus.md`](exodus.md) sections 9–12, decisions in [`markets-plan.md`](markets-plan.md).

**Labels used below:**

| Label | Meaning |
|---|---|
| 🟢 **Same** | Exodus does what Pendle does |
| 🔵 **Canton** | We differ because Canton works differently from Ethereum |
| 🟡 **Simplicity** | We differ only to keep the hackathon build small; Canton would allow Pendle's way |
| 🟣 **Product** | We differ on purpose, because Exodus serves institutions, not DeFi users |

---

## Table of contents

- [Part 1. Five Canton facts you need first](#part-1-five-canton-facts-you-need-first)
- [Part 2. The big table](#part-2-the-big-table)
- [Part 3. What is the same as Pendle](#part-3-what-is-the-same-as-pendle)
- [Part 4. Every difference, one by one](#part-4-every-difference-one-by-one)
  - [A. Money and tokens](#a-money-and-tokens)
  - [B. Price and time](#b-price-and-time)
  - [C. Yield (YT) accounting](#c-yield-yt-accounting)
  - [D. Payouts](#d-payouts)
  - [E. Trading](#e-trading)
  - [F. Fees and treasury](#f-fees-and-treasury)
  - [G. Access, markets and the rest](#g-access-markets-and-the-rest)
- [Part 5. If we wanted to get closer to Pendle: priority list](#part-5-if-we-wanted-to-get-closer-to-pendle-priority-list)

---

## Part 1. Five Canton facts you need first

Most differences come from five ways Canton is not Ethereum. Read these once and the rest of the document makes sense.

### Fact 1. On Ethereum a contract can own money. On Canton, only a party can.

- **Ethereum:** Pendle's YT contract *itself* holds the SY tokens. Its code is the owner. Nobody has to be online for Alice to redeem: she calls `redeemPY`, and the code sends her the SY.
- **Canton:** a contract is a piece of data **signed by parties** (people or companies with a node). Every USYC holding has an `owner` party. There is no "the code owns it". So the vault of backing USYC must be owned by a real party: our **Operator**.

Consequence: every payout needs the Operator's authority, and its node must be online. That is why we have "request → Operator settles" (section D).

### Fact 2. Canton is a UTXO ledger: contracts are never edited, only archived and re-created.

- **Ethereum:** a token balance is one number in a mapping: `balanceOf[Alice] = 500`. Many people can change different entries of the same contract in the same block.
- **Canton:** a token is a contract like `PrincipalToken(owner = Alice, amount = 500)`. To "change" it you **archive** it and **create** new ones. If two transactions try to archive the *same* contract at the same moment, only one wins; the other fails with "contract not found" / "locked contract". This is called **contention**.

Example: the vault is one holding of 1000 USYC. Alice's redeem and Carol's redeem arrive in the same second. Both try to archive that one holding to cut out their share. One succeeds, one fails.

So on Canton, **any contract that many users must change is a bottleneck**: a shared pool, a global interest ledger, a "current price" contract that is replaced on every update.

### Fact 3. Canton is private by default: you only see contracts you are a stakeholder of.

- **Ethereum:** everyone can read every balance, every trade, every price.
- **Canton:** a contract is visible only to its **signatories and observers**. A transaction can only use a contract that one of its submitters can see (or that was handed over by **explicit disclosure**).

Example: Alice cannot see the Operator's vault holdings, so she cannot pick "which 476 USYC" to pay herself with, even if the rules allowed it.

This is also Exodus's selling point: in a PT trade, the Operator and the USDC issuer never see the price (spec section 10).

### Fact 4. Daml 3.x has no contract keys.

- **Ethereum:** Pendle finds things by address and mapping: `getPT[SY][expiry]`, `userInterest[user]`, `postExpiry.firstPYIndex`. "Look it up; if it does not exist, create it" is one line.
- **Daml 3.x:** you cannot look up a contract by a key such as "the market APR2027" or "Alice's interest record". You need its contract id, which someone must pass in. You also **cannot check "does this contract NOT exist?"** on the ledger.

### Fact 5. Ledger time cannot be sped up, and there is no "block" to hang work on.

- **Ethereum:** `block.timestamp` is the clock, and anything can be done lazily "on the first transaction after X" (Pendle uses this for maturity).
- **Canton:** ledger time is real time. On a real network you cannot jump 6 months ahead for a demo. So Exodus uses the oracle's demo clock `simTime`.

---

## Part 2. The big table

| # | Topic | Pendle V2 | Exodus | Why | Label |
|---|---|---|---|---|---|
| 1 | Who holds the backing asset | The YT contract (code) | The Operator party's vault | A contract cannot own assets | 🔵 |
| 2 | Wrapper for the yield asset | SY (Standardized Yield), any yield token | USYC used directly, one asset | Only one asset in the demo | 🟡 |
| 3 | Token model | ERC-20 balances | UTXO contracts (split/merge pieces) | Canton is UTXO | 🔵 |
| 4 | Where the index comes from | `SY.exchangeRate()` read live on-chain | Oracle party publishes short-lived `RateIndex` snapshots | No shared readable state; replacing one price contract causes contention | 🔵 |
| 5 | Index going down | Takes `max(new, stored)`; PT can lose | Oracle cannot publish a lower index | T-bill fund; simpler | 🟡 |
| 6 | Clock | `block.timestamp` | Oracle `simTime` | Demo must show 6 months in 3 minutes | 🟡 (+🔵) |
| 7 | Maturity trigger | Lazy, first transaction after expiry | Operator calls `Mature`, which creates a `MaturitySnapshot` | No mutable storage, no "if not exists" | 🔵 |
| 8 | YT interest bookkeeping | Per-user `userInterest {index, accrued}` | A `lastIndex` on each YT token | A shared per-user ledger = contention + privacy leak | 🔵 |
| 9 | Unclaimed yield when you sell YT | Stays with the **seller** | Goes to the **buyer** | Consequence of #8 | 🔵 (fixable) |
| 10 | Merging two YT pieces | Always (fungible) | Only with the same `lastIndex` | Consequence of #8 | 🔵 (fixable) |
| 11 | Payouts (claim, redeem, merge) | Instant, in the user's transaction | Request → Operator bot settles → owner can cancel | Private vault + vault contention | 🔵 |
| 12 | Merge payout | Principal now (`amount / index`) + interest claimed separately | One payout `amount / lastIndex` | Same total; no interest ledger | 🟡 |
| 13 | Main trading venue | AMM pool PT/SY (+ YT via flash swap) | Private RFQ with a dealer, atomic DvP | A pool is one hot shared contract, and public | 🔵 + 🟣 |
| 14 | Order book | Public signed limit orders, anyone fills | Private quote, one requester, one dealer | Privacy | 🟣 (+🔵) |
| 15 | Quote price form | `lnImpliedRate` | A plain price (0.975), 60 s expiry | Short-lived quotes; exact cash amounts | 🟡 |
| 16 | Partial fills | Yes | No, full size only | Simpler | 🟡 |
| 17 | Maker's tokens during an order | Not locked (fill fails if gone) | Dealer's PT locked (firm quote) | Institutional RFQs are firm | 🟣 |
| 18 | YT trading | Yes (flash swap through the pool) | No (transfer only; stretch goal) | Time | 🟡 |
| 19 | Cash leg | SY (or any token through the router) | USDC | Cash-for-bond story; privacy split | 🟣 |
| 20 | Liquidity providers (LP) | Anyone, LP tokens, earns fees | One house dealer (Bank) with a bot | No pool (#13) | 🔵 + 🟡 |
| 21 | Protocol fees | 5% of YT yield, swap fee, reward fee | None; dealer earns a spread | Simpler | 🟡 |
| 22 | Post-maturity yield | Swept to treasury | Stays in the vault (gap 5) | Not built yet | 🟡 |
| 23 | Who may use it | Anyone (permissionless) | Only clients with a `ClientAccess` pass | Real USYC is KYC-only | 🟣 |
| 24 | Creating markets | Permissionless factory | One market from bootstrap | Time | 🟡 |
| 25 | Finding a market's data | By address / mapping | `MarketTerms` copied into every token | No contract keys | 🔵 |
| 26 | Visibility | Everything public | Need-to-know; price hidden from the Operator | Privacy is the product | 🔵 + 🟣 |
| 27 | Wallets | Self-custody (user signs) | Custodial (backend submits) | Time | 🟡 |
| 28 | Rewards / points (SY reward tokens) | Yes (`RewardManager`) | No | USYC has no rewards | 🟡 |
| 29 | PT oracle for lending | TWAP of implied rate, linear discount | None | Out of scope | 🟡 |
| 30 | Governance, incentives (sPENDLE, gauges) | Yes | No | Out of scope | 🟡 |

---

## Part 3. What is the same as Pendle

These follow Pendle's code line by line. Keep them this way.

| Rule | Pendle code | Exodus | Example |
|---|---|---|---|
| Split gives equal PT and YT, counted in the **accounting asset** (USD here), not in shares | `_calcPYToMint` = `syToAsset(index, amountSy)` | `Market.Split`: PT = YT = `roundDown6 (usycAmount * index)` | Bank splits 1000 USYC at index 1.00 → 1000 PT + 1000 YT. At index 1.025, 1000 USYC → 1025 PT + 1025 YT |
| No new split after expiry | `mintPY` has `notExpired` | `Split` refused at `simTime >= maturity` or once `matured` | On Apr 2 2027, Carol's split fails |
| YT yield formula | `principal * (cur - prev) / (prev * cur)` in `InterestManagerYT` | `amount / lastIndex - amount / newIndex` | 1000 YT, 1.00 → 1.025: **24.390243 USYC** (worth 25 USD) |
| Maturity freezes the first index on or after expiry | `firstPYIndex` in `_setPostExpiryData` | `Mature` → `MaturitySnapshot` (decision Q1) | Clock jumps from Mar 30 to Apr 3: the Apr 3 price is used, the market never gets stuck |
| YT stops earning at that frozen index | `_getInterestIndex` returns `firstPYIndex` after expiry | `Claim_Settle` with `AtMaturity` | Bank's final claim: 1000 × (1/1.025 − 1/1.05) = **23.228803 USYC** |
| PT pays 1 USD of the asset at **today's** index, even long after maturity | `_calcSyRedeemableFromPY`: `assetToSy(indexCurrent, amountPY)` | `Redeem_Settle`: `ptAmount / index at settle` | Alice redeems 500 PT at index 1.05 → 476.190476 USYC; at 1.06 → 471.698113 USYC. Both are 500 USD |
| Merge lives on the token, needs equal PT + YT, before expiry only | `redeemPY` on the YT contract; after expiry only PT is burned | `PT_RequestMerge` on the PT (decision Q2) | 100 PT + 100 YT → USYC. After maturity: redeem PT + final YT claim instead |
| Index never goes down inside the protocol | `_pyIndexCurrent` = `max(exchangeRate, stored)` | `RateFeed.Publish` only accepts an equal or higher index | (see difference 5 for the one nuance) |
| Payouts round in the protocol's favour | `divDown`, `mulDown` | `roundDown6` | Vault ends with **0.000002 USYC** dust, never negative |
| Price ↔ fixed APY | `exchangeRate = exp(lnImpliedRate × timeToExpiry)` | `price = 1 / (1 + apy)^years` off-ledger | 5.2% with 0.5 years left → price **0.975** |

---

## Part 4. Every difference, one by one

### A. Money and tokens

#### 1. Who holds the backing asset 🔵

**Pendle.** When Bank mints, its SY goes into the **YT contract**. The contract keeps `syReserve` and pays everyone out by itself. No company holds the money.

**Exodus.** The USYC goes into the **Operator's vault** (`payFrom` inside `Market.Split`). PT and YT are signed by the Operator, which promises to pay them.

**Why (Canton, deep).** On Canton, a contract cannot be the owner of another contract. Every `Holding` has a party as `owner` and an issuer as signatory. There is no "address of the code". Someone must own the backing USYC, and it must be a party that is not a client (otherwise the client could spend it). The Operator is that party.

The price we pay: the Operator is **trusted** (spec section 12). It cannot steal: PT and YT are only minted inside `Split`, and every payout choice has fixed formulas. But its node must be online to pay, and it could delay. That is why every request has an owner `*_Cancel`.

**How to make it like Pendle.** Not fully possible on Canton. The closest version:
- Make the vault owner a **multi-party** group (for example Operator + an independent custodian), so no single company can block payouts.
- Or let the vault be owned per market by a dedicated "market party" hosted on several nodes (Canton multi-hosting), so it keeps working if one node is down.

Worth it for production, not for the demo.

#### 2. SY wrapper vs raw USYC 🟡

**Pendle.** Every yield token is first wrapped into **SY** (Standardized Yield). SY gives one API for all assets: `deposit`, `redeem`, `exchangeRate()`, `getRewardTokens()`. The market and YT only talk to SY. That is how Pendle lists stETH, aUSDC, sUSDe and hundreds more with the same code.

**Exodus.** No wrapper. `MarketTerms` names one issuer and one instrument (`assetIssuer = UsycIssuer`, `instrument = "USYC"`), and the price comes from our oracle.

**Why.** Simplicity: the demo has one asset. Nothing in Canton blocks a wrapper.

**How to make it like Pendle.** Add a Daml **interface** `YieldSource` (the Daml version of the SY standard) with `exchangeRate`, `deposit`, `redeem`. USYC would get one instance. `Split` and the payout choices would take a `YieldSource` instead of hard-coded USYC. Real use case: a second market on a tokenized money-market fund from another issuer, with no change to `Market` or `Tokens`. Medium work; do it before listing a second asset.

#### 3. ERC-20 balances vs UTXO pieces 🔵

**Pendle.** PT and YT are ERC-20s. Alice has one number: `balanceOf(Alice) = 500`.

**Exodus.** Alice can have several PT contracts: 300 PT + 200 PT. To pay 500 she merges them (`PT_MergeWith`), to pay 120 she splits one (`PT_SplitOff`). The helper `splitExactPt` does this for her.

**Why (Canton).** Canton's ledger is UTXO (Fact 2). One big "balances" contract would be touched by every trade, so trades would fail against each other. Separate pieces let Alice and Carol trade at the same time.

**How to make it like Pendle.** The ledger stays UTXO, but the **user experience** can look like ERC-20: add the CIP-56 `Holding` interface to PT and YT (spec gap 7). Then any Canton wallet shows "500 PT" as one line and picks the pieces for you, as it already does for USYC. Small work; planned for Phase 8.

### B. Price and time

#### 4. Where the index comes from 🔵

**Pendle.** The YT contract calls `SY.exchangeRate()` in the same transaction. For wstETH, SY asks the Lido contract "how much ETH is 1 share?". The answer is always the live one, and reading it does not change anything, so a million readers never block each other.

**Exodus.** A trusted `Oracle` party writes to its private `RateFeed`. Each `Publish` creates a **`RateIndex` snapshot** that is valid for 30 s and is **not** archived by the next publish. A client's command passes in the snapshot's contract id (received by explicit disclosure) and reads it with `fetchValidRate`.

**Why (Canton, deep).** Two problems:

1. **No shared readable state.** On Ethereum, any contract can read any other contract's storage. On Canton, a transaction can only read a contract that one of its submitters is a stakeholder of, or that was disclosed to it (Fact 3). There is no global "USYC price" variable that Alice's `Split` can just look at. Someone has to hand her a price contract.
2. **Updating a price contract causes contention.** The first version had one `RateIndex` that each publish **archived and replaced**. Alice's app read the price (contract id `#12`), and while her command travelled to the ledger the oracle published again, archiving `#12`. Her command failed with `CONTRACT_NOT_FOUND`. Measured: the UI lost **6 of 6** races against a bot publishing every 0.3 s, and **8 of 10** subscribes needed a retry at 1 s. With snapshots that live 30 s (the Canton Coin `OpenMiningRound` pattern): **10 of 10 with 0 retries** (spec gap 12).

Also, the real USYC price is itself published by an oracle, so an oracle is the honest model.

The trade-off (gap 14): for 30 s two snapshots are valid, so a user may pick the older, lower one. For `Split` this only gives fewer PT/YT, so there is no gain.

**How to make it like Pendle.** Not possible as "read live". The closest version: let the **asset issuer** (UsycIssuer) publish the snapshots as part of the fund, since the fund's own price is what `SY.exchangeRate()` means. That removes the separate oracle party from the trust list. Low value for the demo.

#### 5. When the index goes down 🟡

**Pendle.** `_pyIndexCurrent` stores `max(SY.exchangeRate(), pyIndexStored)`. If the asset loses value, the stored index stays at the old high (the "watermark"). YT earns nothing until the price recovers, and at maturity **PT redeems for less than 1 USD** (Pendle docs, "Negative yield").

Example: index 1.03 → the fund loses money → exchange rate 1.02. Pendle keeps 1.03 as the index. Alice's 500 PT pays `500 / 1.03` = 485.436893 shares, worth only 485.436893 × 1.02 = **495.15 USD**.

**Exodus.** `RateFeed.Publish` refuses a lower index. The loss simply cannot be expressed.

**Why.** Simplicity: USYC is a T-bill fund whose price only goes up. The honest version needs the watermark.

**How to make it like Pendle.** Allow the oracle to publish a lower index, and apply `max(rate.index, lastSeen)` where the index is used: `Split` and `Claim_Settle` already refuse an index below the token's `lastIndex` (`newIndex >= lastIndex`), so YT is already safe. For PT, `Redeem_Settle` would use `max(rate.index, maturityIndex)`, which is Pendle's rule. Small work; do it if we list an asset that can lose value.

#### 6. The clock 🟡 (with a 🔵 reason)

**Pendle.** `expiry` is compared with `block.timestamp`.

**Exodus.** Maturity is compared with the oracle's `simTime`.

**Why.** The demo must show 6 months (Oct 1 → Apr 1) in 3 minutes. On Ethereum you cannot fast-forward mainnet either; on Canton, ledger time is real time on a real network (Fact 5). So a demo clock is needed on both chains; we chose to keep it on-ledger so the tests are exact.

**How to make it like Pendle.** Replace `rate.simTime` with `getTime` (ledger time) in `Split`, `PT_RequestMerge`, `PT_AssertBeforeMaturity` and `Mature`. Keep `simTime` behind a "demo mode" flag. Small work; needed before production (gap 6).

#### 7. Maturity trigger 🔵

**Pendle.** Lazy. Every YT function has the `updateData` modifier: "if expired and `firstPYIndex` is still 0, set it now". The first person who touches the YT contract after expiry (any user, for any reason) freezes the index.

**Exodus.** The Operator bot calls `Market.Mature` with the first price on or after maturity. `Mature` is **consuming**: it re-creates the `Market` with `matured = True` and creates a `MaturitySnapshot`. PT redeems and final YT claims need that snapshot.

**Why (Canton, deep).**
- Pendle's trick needs **one mutable storage slot** (`postExpiry.firstPYIndex`) that every user transaction can check and write. On Canton, "write if empty" means: archive the shared Market and re-create it. If Alice's and Carol's redeems both tried to do it at the same moment, one would fail (Fact 2).
- It also needs **"does it already exist?"**. Without contract keys, a Daml choice cannot ask "is there a `MaturitySnapshot` for APR2027 yet?" (Fact 4). So two users could each create their own snapshot with different indexes. That was spec gap 1.
- Making `Mature` a single consuming choice on the one `Market` contract solves both: it can only happen once, because the old `Market` is gone after the first call.

The result is the same as Pendle: first price on or after the date wins (decision Q1).

**How to make it like Pendle.** Already as close as Canton allows. A small step closer: let **any** client's first PT redeem request trigger `Mature` through the backend (the bot already does it within seconds, so there is little to gain).

### C. Yield (YT) accounting

This is the most important difference for users.

#### 8. Per-user interest ledger vs `lastIndex` on each token 🔵

**Pendle.** `InterestManagerYT` keeps, for each user, `userInterest[user] = {index, accrued}`. Before **every** YT transfer (`_beforeTokenTransfer`), it books the interest earned so far for the sender and the receiver:

```
interestFromYT = balance × (currentIndex − prevIndex) / (prevIndex × currentIndex)
accrued += interestFromYT; index = currentIndex
```

So YT itself is a plain fungible ERC-20: 1 YT is 1 YT, whoever held it before.

**Exodus.** No per-user record. Each YT contract carries its own `lastIndex` ("yield already paid up to here"). A claim pays `amount / lastIndex − amount / newIndex` and gives the YT back with the new `lastIndex`.

**Why (Canton, deep).** Pendle's model needs a record per user that **every transfer must update on both sides**.

- If it is **one shared contract** (like Pendle's mapping), every YT transfer in the whole market archives and re-creates it. Two transfers at the same time: one fails. And everyone who must see it (to use it in their transaction) sees every holder's balance and interest. That destroys the privacy that Exodus is built for.
- If it is **one contract per user** (`InterestAccount(owner = Alice)`), then when Bank sends YT to Alice, Bank's transaction must also archive and re-create **Alice's** account. Bank would need to see Alice's account (privacy leak: Bank learns her other YT), and if Alice is also receiving YT from Carol in the same second, one of the two transfers fails (contention on Alice's account).

Putting `lastIndex` **inside each token** needs no shared record at all. Every YT carries its own history, just as every UTXO coin carries its own amount.

#### 9. Who gets the unclaimed yield when YT is sold 🔵 (fixable)

A direct result of #8. Real use case, with the spec's numbers:

Bank split on Oct 1 at index 1.00 and holds 1000 YT. On **Jan 1** (index 1.025) it has not claimed. It sells the 1000 YT to Alice. On **Apr 1** the index is 1.05.

| | Pendle | Exodus today |
|---|---|---|
| Bank (seller) gets | **24.390243** USYC (booked to Bank at the transfer) | **0** |
| Alice (buyer) gets | **23.228803** USYC (from 1.025 to 1.05) | **47.619047** USYC (one claim from 1.00 to 1.05: 1000 × (1/1.00 − 1/1.05)) |

In Exodus the unclaimed yield **travels with the token** (`YT_Transfer` comment: "The unclaimed yield goes with the token"). Nothing is lost, but the seller must either claim first, or charge the buyer for it in the price.

**How to make it like Pendle.** This one is doable on Canton. In `YT_Transfer`, also take a valid price snapshot (`fetchMarketRate`) and:
1. Create a `ClaimRequest` for the **sender** covering `lastIndex → today`, which the Operator bot settles as usual.
2. Give the receiver the YT with `lastIndex = today's index`.

Cost: a YT transfer needs a fresh price (like `Split` already does), and the transfer happens even if the Operator settles the claim a few seconds later. No shared contract is needed. Medium work. **Recommended** before YT trading (#18), because a YT trade price is much easier to understand when a YT has no hidden unclaimed yield inside.

#### 10. Merging two YT pieces 🔵 (fixable)

**Pendle.** YT is fungible: any two holdings just add up.

**Exodus.** `YT_MergeWith` refuses if the two `lastIndex` differ ("claim the yield of both tokens first").

Example: Alice has 100 YT at `lastIndex` 1.00 (2.439024 USYC unclaimed at index 1.025) and 100 YT at `lastIndex` 1.025 (nothing unclaimed). Merged into 200 YT, neither index would be right: 1.00 overpays, 1.025 loses Alice's 2.439024 USYC.

**How to make it like Pendle.** Same trick as #9: `YT_MergeWith` with a fresh price creates a `ClaimRequest` for the older piece's unclaimed yield, then merges both at today's index. Or, simpler for wallets: the CIP-56 view (#3) shows the total and the app claims before merging.

### D. Payouts

#### 11. Instant payout vs request → settle → cancel 🔵

**Pendle.** `redeemDueInterestAndRewards`, `redeemPY` and PT redemption pay **in the user's own transaction**. The YT contract sends SY from its own balance.

**Exodus.** Every payout is three steps:
1. Owner asks: `YT_RequestClaim`, `PT_RequestRedeem`, `PT_RequestMerge`. The tokens are archived into the request so they cannot be spent twice.
2. The Operator's bot (`OperatorSettlementService`, every `MARKET_SETTLE_SECONDS`) settles: `*_Settle` pays USYC from the vault.
3. Until then, the owner can `*_Cancel` and get the tokens back.

**Why (Canton, deep).** Surprisingly, it is **not** a permission problem: PT and YT are signed by the Operator, so a choice Alice runs on her PT already carries the Operator's authority and could move vault USYC. The problems are:

- **Privacy (Fact 3).** To pay Alice 476.190476 USYC, the transaction must name **which** vault holding to split. Alice cannot see the vault holdings (and should not: they reveal the total size of the market). The Operator's node could disclose them, but then every client would learn the vault's size and pieces.
- **Contention (Fact 2).** Even with disclosure, if the vault is one 1000 USYC holding and Alice, Carol and Dan redeem at 12:00:00, all three transactions try to archive that same holding. One succeeds, two fail and must retry, and it gets worse with more users. The bot settles one request after the other, so nobody ever fails.

This is the same pattern as the fund's USYC redeem (`UsycRedeemRequest`) and is standard on Canton.

In practice Alice sees her USYC a few seconds later. If the Operator never acts, she cancels.

**How to make it like Pendle.** Options, from cheapest:
- **Keep the pattern, make it feel instant** (what we do): the bot settles in seconds, and the UI shows "pending" and then "paid".
- **Many small vault pieces:** at `Split`, keep the USYC as one vault holding **per split** and store its id in the tokens. A payout would take only its own piece, so no two users collide. But the pieces would need re-linking on every token split/merge, and it still needs disclosure to the client. Complex.
- Not recommended: disclose the whole vault to everyone.

#### 12. Merge payout: two parts vs one 🟡

**Pendle.** `redeemPY` before expiry pays only the **principal** at today's index: `amount / indexCurrent`. The interest the YT earned was booked to the user's `userInterest` and is claimed separately (minus the 5% fee, see #21).

**Exodus.** `MergeRequest` pays `amount / lastIndex` in one step. Why that is the same total:

```
principal now:       amount / nowIndex
unclaimed interest:  amount × (1/lastIndex − 1/nowIndex)
sum:                 amount / lastIndex     (nowIndex cancels out)
```

Example: 100 PT + 100 YT with `lastIndex` 1.00, merged when the index is 1.025.

| | Pendle | Exodus |
|---|---|---|
| Principal | 100 / 1.025 = 97.560975 | |
| Interest | 2.439024, minus 5% fee = 2.317073 (claimed separately) | |
| **Total** | **99.878048 USYC** | **100.000000 USYC** |

The only real difference is Pendle's fee.

**Why.** Simplicity, plus #8 (we have no interest record to book the interest into). One payout = one request, and the merge needs no price at all.

**How to make it like Pendle.** Once a fee exists (#21), split the payout in `Merge_Settle`: pay the principal to the user, and pay the interest part minus the fee. It can stay one request.

### E. Trading

#### 13. AMM pool vs private RFQ 🔵 + 🟣

**Pendle.** Each market is one AMM pool of **PT / SY** (`PendleMarketV7`). The curve is built on the **implied rate** (`lastLnImpliedRate`, `scalarRoot`, `initialAnchor`), and it tightens as maturity comes, so PT drifts toward 1.00. Anyone can swap any time; the price comes from the pool's reserves. Liquidity providers deposit PT + SY and get LP tokens.

**Exodus.** No pool. Alice sends a private `RfqRequest` to a dealer (Bank). Bank answers with a `Quote` (price 0.975, valid 60 s). Alice accepts, and `Quote_Accept` moves **487.5 USDC** to Bank and **500 PT** to Alice in one atomic transaction (DvP).

**Why (Canton, deep).**

1. **A pool is the worst case for contention.** Every swap changes the reserves, so every swap must archive and re-create the one pool contract. Five traders at 12:00:00 → one succeeds, four fail with "contract not found" and must retry with a new price, and they fail again against the next trader. On Ethereum this works because the block orders all swaps and each sees the result of the one before. On Canton, transactions on the same contract do not queue: they conflict.
2. **A pool is public by nature.** To swap against it you must see its reserves, so every trader must be an observer of the pool, and every trade changes the reserves they all see. So everyone learns the size and price of every trade. That is exactly what Exodus promises institutions will **not** happen: in `Quote_Accept`, the Operator and UsdcIssuer see **zero** quotes (`RfqTest.rfqPrivacy`).
3. **Product fit (🟣).** Institutions already trade bonds by RFQ with dealers. A private quote is what they expect.

**How to make it like Pendle.** Two realistic ways:
- **Pendle's curve, off-ledger (recommended).** Give the dealer bot (`dealer-pricing.ts`) Pendle's `MarketMathCore` formula: keep a virtual PT/cash inventory and quote along the implied-rate curve. Alice gets AMM-like prices that move with size and time, while trades stay private and never collide. Medium work.
- **An on-ledger pool with batched settlement.** Traders send swap requests; the Operator bot applies them one by one to the pool. That is an AMM without contention, but the Operator sees every trade and the pool's state is shared. It gives up the privacy point, so we do not recommend it.

#### 14. Public limit orders vs private quotes 🟣 (+🔵)

**Pendle.** `PendleLimitRouter`: a maker **signs** an order off-chain (`Order {expiry, orderType, YT, maker, makingAmount, lnImpliedRate, ...}`); order types `SY_FOR_PT`, `PT_FOR_SY`, `SY_FOR_YT`, `YT_FOR_SY`. The order sits in a **public book** and **anyone** can fill it; the router fills the book first, then the AMM. Makers pay no fee; takers pay the same fee as on the AMM.

**Exodus.** A `Quote` is signed by exactly two parties (requester and dealer) and has **no observers**. Nobody else can see or fill it.

**Why.** Privacy is the product (🟣). Canton also makes it natural (🔵): a contract only exists for its stakeholders, so a "public book" would need every client as an observer of every order.

**How to make it like Pendle.** A dealer could publish an **indicative** price for everyone (we already do this off-ledger: "Indicative 0.975 · 5.19% fixed", decision D5), while firm prices stay private. Going further (a public on-ledger book) would give up privacy.

#### 15. Price as a number vs implied rate 🟡

**Pendle.** Orders carry `lnImpliedRate`, because they can stay open for weeks. A fixed PT price would become wrong as time passes (PT must drift toward 1.00); a fixed **rate** stays right.

Example: an order at 5.2% implied APY means price 0.975 with 6 months left, but 0.9874 with 3 months left.

**Exodus.** A `Quote` has a price (0.975) and a `validUntil` about 60 s ahead (decision R1).

**Why.** Simplicity: in 60 s the correct price barely moves, and a plain price keeps cash exact (500 × 0.975 = **487.5 USDC**). Rate → price needs `exp`/`log`, which Daml `Decimal` does not provide, so we would need approximations on-ledger.

**How to make it like Pendle.** Store `impliedApy` in the `Quote` and compute `price = 1 / (1 + apy)^years` in `Quote_Accept` using the snapshot's `simTime`. Needs a careful power function in Daml. Only worth it if quotes live for hours or days (for example, standing dealer offers).

#### 16. Partial fills 🟡

**Pendle.** `FillOrderParams.makingAmount` can be less than the order; `OrderStatus` tracks `filledAmount` / `remaining`.

**Exodus.** Full size only (decision R3). Alice asked for 500 PT, the quote is for 500 PT.

**How to make it like Pendle.** Add `Quote_AcceptPart` with an amount: it delivers part of the locked PT (`PT_SplitOff` on the locked piece) and re-creates the `Quote` for the rest. Small work, but only useful once quotes are shared with more than one taker.

#### 17. Firm quotes (locked PT) 🟣

**Pendle.** The maker's tokens are **not** locked. If Bank spends them, the fill simply fails.

**Exodus.** When Bank quotes 500 PT, those exact 500 PT get a `PtLock` for Alice until `validUntil`. Bank cannot sell, split, redeem or unlock them early. (The sell side cannot lock USDC, so there Pendle's rule applies: the accept fails if Bank spent it.)

**Why.** Product (decision R2): an institutional RFQ quote is **firm**, and the spec forbids selling the same PT twice.

**How to make it like Pendle.** Remove the lock and let `Quote_Accept` fail if the PT is gone. Easy, but not recommended.

#### 18. No YT trading 🟡

**Pendle.** YT is traded through the same PT/SY pool with a **flash swap**: to buy YT, the router borrows SY, mints PT + YT, sells the PT back into the pool, and gives the buyer the YT. This works because `P(PT) + P(YT) = P(underlying)`.

Example: USYC at 1 USD, PT at 0.975 → YT costs about **0.025 USD**. With 25 USD Alice gets exposure to the yield of about 1000 USD of USYC.

**Exodus.** YT can be transferred but not traded (stretch goal in Phase 8, decision D3).

**Why.** Time only.

**How to make it like Pendle.** Reuse the RFQ: add a `BuyYt` / `SellYt` side, where the dealer quotes a YT price (for example 0.025). Fix #9 first, so a YT has no hidden unclaimed yield. The flash-swap trick is not needed: the dealer can split USYC itself and keep the PT.

#### 19. USDC as the cash leg 🟣

**Pendle.** Trades are PT ↔ **SY**. The router can "zap" any token (USDC, ETH, ...) into SY first through an aggregator.

**Exodus.** PT ↔ **USDC** (decision R4).

**Why.** Product: a cash-for-bond DvP is the institutional story, and it keeps the privacy split (UsdcIssuer sees the cash leg, the Operator sees the PT leg, neither sees the price).

**How to make it like Pendle.** Allow USYC as a second cash leg in `RfqRequest` (a `cashInstrument` field). Small work.

#### 20. No liquidity providers 🔵 + 🟡

**Pendle.** Anyone deposits PT + SY into the pool and earns four things: the PT fixed yield, the SY yield, 20% of swap fees, and PENDLE incentives.

**Exodus.** One house dealer, Bank, holds PT and USDC, and a bot quotes from a target APY plus a spread (decisions D2, M2). Admins can override from `/dealer`.

**Why.** There is no pool (#13), so there is nothing to provide liquidity **to**. Allowing more dealers is only a matter of time.

**How to make it like Pendle.** "Be a dealer" is the Canton version of "be an LP": let approved clients register as dealers, and send each RFQ to several dealers (best price wins). The contracts already support any dealer party; the work is in the API and UI.

### F. Fees and treasury

#### 21. Fees 🟡

**Pendle** (code + docs):
- **YT yield fee:** `interestFeeRate` (docs: **5%** of all yield; code allows up to 20%). Taken in `_doTransferOutInterest` when a user claims.
- **Reward fee:** `rewardFeeRate` on reward tokens.
- **Swap fee:** `lnFeeRateRoot`, an annual rate scaled by the time left (`exp(lnFeeRateRoot × timeToExpiry)`), so a trade 1 year before maturity pays much more than one 1 month before. Part of it (`reserveFeePercent`) goes to the treasury; docs: 20% of swap fees go to LPs.
- The rest goes 80% to PENDLE buybacks, 10% treasury, 10% operations (docs).

**Exodus.** No protocol fee. Bank earns its spread instead: with a 5.2% target and a 0.1-point spread, it sells PT to Alice at 0.975503, which gives her 5.1% fixed.

Example of Pendle's YT fee on the spec numbers: Bank claims 24.390243 USYC on Jan 1. With 5%: **1.219512 USYC** to the treasury, **23.170731 USYC** to Bank.

**Why.** Simplicity; the section 9 numbers stay exact.

**How to make it like Pendle.** Add `interestFeeRate` and a `treasury` party to `MarketTerms`. In `Claim_Settle` and `Merge_Settle`, pay `roundDown6 (yield × feeRate)` to the treasury and the rest to the owner. The swap fee already exists in spirit as the dealer's spread, which decision M2 already expresses in APY points like `lnFeeRateRoot`. Small work, but it changes every test number.

#### 22. Post-maturity yield sweep 🟡

**Pendle.** After expiry, PT pays `amount / today's index`, and the difference with `amount / firstPYIndex` is booked to `totalSyInterestForTreasury`. `redeemInterestAndRewardsPostExpiryForTreasury` sends it to the treasury.

Example: Alice redeems 500 PT on Jul 1 instead of Apr 1. Index then 1.07 vs 1.05 at maturity. She gets 500 / 1.07 = **467.289719** USYC; the vault had set aside 500 / 1.05 = 476.190476; the **8.900757** USYC difference goes to the treasury.

**Exodus.** Alice gets the same 467.289719 USYC, but the 8.900757 stays in the vault forever (gap 5).

**Why.** Not built yet.

**How to make it like Pendle.** In `Redeem_Settle`, also pay `roundDown6 (ptAmount / maturityIndex) − usycAmount` to a treasury party (the Operator has both numbers in hand). Small work; planned for Phase 8.

### G. Access, markets and the rest

#### 23. Permissionless vs whitelisted 🟣

**Pendle.** Anyone with a wallet can mint, trade and redeem.

**Exodus.** Every client choice takes a `ClientAccess` pass and calls `checkAccess`; PT/YT transfers need the sender's **and** the receiver's pass (decision P1).

**Why.** Product: the real USYC is only for KYC'd investors, and institutions need to know who they trade with. Canton makes this cheap: a pass is one private contract per client, and revoking is archiving it.

**How to make it like Pendle.** Remove `checkAccess`. Not recommended for this product.

#### 24. Creating markets 🟡

**Pendle.** `createYieldContract(SY, expiry)` is permissionless; the expiry must be a multiple of `expiryDivisor` (so maturities line up on fixed days), and a duplicate is refused through `getPT[SY][expiry]`. Market creation is permissionless too.

**Exodus.** One market, `PT-USYC-APR2027`, from bootstrap (decision D4). An admin "Create market" form is planned for Phase 8.

**Why.** Time; also the demo oracle schedule ends on Apr 1 2027.

**How to make it like Pendle.** An Operator choice `CreateMarket` on a `MarketFactory` contract. Because there are no contract keys (Fact 4), the "no duplicate" check must live either in the backend (a unique index in PostgreSQL) or in a consuming `MarketRegistry` contract that lists existing market ids. The registry is only touched when a market is created, so contention is not a problem.

#### 25. `MarketTerms` copied into every token 🔵

**Pendle.** A PT knows its YT and SY by address, and anyone can look up `getPT[SY][expiry]`.

**Exodus.** `MarketTerms` (market id, issuer, instrument, oracle, maturity) is copied into every PT, YT, request and snapshot.

**Why (Canton).** No contract keys (Fact 4): a token cannot look up "its" market. With the terms inside, a PT knows its own maturity, and `PT_MergeWith` can refuse to merge an APR2027 PT into a JUL2027 PT.

**How to make it like Pendle.** Not possible in Daml 3.x; this copy is the standard Canton answer.

#### 26. Visibility 🔵 + 🟣

**Pendle.** Everything is public: every balance, every trade, every price.

**Exodus.** Need-to-know (spec section 10). Examples: in Alice's PT purchase, the Operator sees the PT move but not the USDC or the price; UsdcIssuer sees the USDC move but not the PT; Carol sees nothing. Clients cannot list other clients.

**Why.** This is why Exodus exists on Canton.

**How to make it like Pendle.** Not wanted.

#### 27. Custodial wallets 🟡

**Pendle.** Users sign with their own wallet.

**Exodus.** The backend allocates a party and ledger user per client and submits for them after login.

**Why.** Time and simple onboarding (email + password).

**How to make it like Pendle.** Canton **external parties**: the key stays in the user's browser and the backend only prepares transactions for the user to sign. Also needs gap 15 fixed (read disclosures with the backend's user, submit with the client's). Large work.

#### 28–30. Rewards, PT oracle, governance 🟡

- **Rewards / points (Pendle `RewardManager`, SY reward tokens):** YT holders also receive the asset's extra rewards (for example, airdrop points). USYC has none, so we skipped it.
- **PT oracle for lending (Pendle TWAP of `lnImpliedRate`, and the linear discount oracle):** lets lending protocols accept PT as collateral. The **linear discount** version is easy on Canton: `price = 1 − discount × yearsLeft` needs only the clock, no market data. Useful later for "borrow USDC against PT".
- **sPENDLE, incentives, gauges:** Pendle's own token economy. Out of scope for Exodus.

---

## Part 5. If we wanted to get closer to Pendle: priority list

Ordered by value for the effort. Each would start with its own plan for approval.

| Priority | Change | Section | Effort | Why now |
|---|---|---|---|---|
| 1 | Unclaimed YT yield stays with the seller (claim on transfer) | #9, #10 | Medium | Required before YT trading makes sense |
| 2 | CIP-56 `Holding` view for PT and YT | #3 | Small | Wallets show one balance, like ERC-20 (gap 7) |
| 3 | Treasury sweep of post-maturity yield | #22 | Small | Funds are stuck today (gap 5) |
| 4 | Pendle's AMM curve in the dealer bot | #13 | Medium | Prices that react to size and time, still private |
| 5 | YT trading by RFQ | #18 | Medium | Pendle's second main product |
| 6 | YT interest fee + treasury party | #21 | Small | Pendle's business model; changes every test number |
| 7 | Ledger time instead of `simTime` (demo flag) | #6 | Small | Needed for any real deployment (gap 6) |
| 8 | Watermark rule for a falling index | #5 | Small | Only when an asset can lose value |
| 9 | `YieldSource` interface (Daml SY) | #2 | Medium | Only when a second asset is listed |
| 10 | Several dealers per RFQ | #20 | Medium | The Canton version of "anyone can be an LP" |

What should **not** change, because it is Canton or the product itself: the Operator vault (#1), UTXO tokens (#3), oracle snapshots (#4), the `Mature` choice (#7), request → settle (#11), no public pool or book (#13, #14), passes (#23), copied `MarketTerms` (#25), privacy (#26).
