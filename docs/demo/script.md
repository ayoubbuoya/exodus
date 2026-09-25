# Exodus: 3-minute demo script

The story of spec section 9, shown in the app. Record it on a **fresh** stack so the numbers match:

```bash
docker compose down && docker compose up --build     # then open http://localhost:8080
```

(or the four terminals of [`run-locally.md`](../run-locally.md), with `npm run oracle:hold` and `FAUCET_AMOUNT=1000.0` in `api/.env`).

- **Window A** is the admin (`admin@exodus.local` / `exodus-demo-admin` in the Docker demo).
- **Window B** is a client, "Alice": sign up, send the access form, approve her in window A, then on the **Wallet** page claim the faucet (1000 test USDC) and keep it.
- The demo clock stays on Oct 1 2026 until you move it on `/lab` (act as **Oracle**): the **Publish** form jumps straight to a date (index `1.025`, date `2027-01-01`), and **Next step** moves one week.

`recordings/` next to this file holds a silent screen recording of every scene (made with [`record-demo.mjs`](record-demo.mjs)). Put your voice over it, or follow the script live.

"USYC" and "USDC" are simulated tokens issued by demo parties, not by Circle or Hashnote. Say it once at the start.

| Time | Screen | Do | Say | On screen |
|---|---|---|---|---|
| 0:00 | Landing page | Nothing | "Institutions want a fixed rate on tokenized T-bills. On public DeFi, every trade and every price is visible to everyone. Exodus fixes that on Canton. The USYC and USDC here are simulated test tokens." | Landing page, "Simulated tokens" badge |
| 0:15 | B: **Markets** | Open the market card | "We split a yield-bearing fund token, USYC, into two tokens, like Pendle. PT pays one dollar at maturity, so buying it below one locks a fixed rate. YT gets all the floating yield." | PT-USYC-APR2027, Apr 1 2027, 182 days, fixed APY **5.10 %**, PT price **0.975503** |
| 0:35 | A: **Dealer** | Point at Bank's position | "Our house dealer, Bank, already split 1000 USYC into 1000 PT and 1000 YT." | PT free **1,000**, YT **1,000** |
| 0:45 | B: **Fixed Yield (PT)** | Type `500`, click **Get firm quote** | "Alice asks for a private price for 500 PT. There is no public pool: only Alice and the dealer see this request." | Indicative: pay about **487.7515 USDC** |
| 0:55 | B | Wait about 2 s | "The dealer's bot answers in two seconds with a firm quote, valid for one minute. The dealer's 500 PT are locked for Alice, so they cannot be sold twice." | Quote **0.975503**, **487.7515 USDC**, **5.10 %** fixed, countdown |
| 1:10 | A: **Lab**, act as **Operator** | Point at the "Markets" line | "Privacy check. The Operator runs the market and signs every PT, but it sees zero quotes. It never learns the price." Then act as **Bank**: "Only the dealer sees it." | Operator: **0 Quote**; Bank: **1 Quote** |
| 1:25 | B | Click **Accept** | "Alice accepts. Her USDC and the PT change hands in one atomic Canton transaction: both legs, or nothing." | Toast "Bought 500 PT for 487.7515 USDC"; Portfolio shows 500 PT |
| 1:40 | A: **Lab** as **Oracle** | Publish index `1.025`, date `2027-01-01` | "Three months later the fund has grown from 1.00 to 1.025." | Demo date Jan 1 2027, index **1.025** |
| 1:55 | A: **Dealer** | Click **Claim Bank's yield** | "Bank's YT collected the yield. The Operator's bot pays it from the vault in two seconds." | Bank's USYC **24.390243** |
| 2:10 | A: **Lab** as **Oracle** | Publish index `1.05`, date `2027-04-01` | "At maturity, April 1, the index is 1.05. The Operator's bot matures the market by itself." | Market badge **Matured**, maturity index **1.05** |
| 2:25 | B: **At maturity** | Click **Redeem PT** | "Alice redeems. Each PT pays one dollar of USYC at today's price." | **476.190476 USYC** = 500 USD |
| 2:40 | B: **Portfolio** / **Wallet** activity | Scroll | "Alice paid 487.75 and got 500: a fixed 5.1 % a year, and nobody but her dealer ever saw the price. Bank kept the floating yield. Every number is checked to six decimals by our Daml tests." | Activity: Bought PT, Redeemed PT |
| 2:55 | Any | End | "Exodus: private fixed-rate markets on Canton." | |

## Numbers to know

| What | Value | Where it comes from |
|---|---|---|
| Dealer's buy price on Oct 1 | 0.975503 (5.10 % fixed) | Pendle's formula `(1 + 5.2 % − 0.10 %)^(−182/365)`, rounded up |
| Alice pays for 500 PT | 487.7515 USDC | `roundDown6 (0.975503 × 500)` |
| Bank's claim on Jan 1 | 24.390243 USYC | `1000 × (1/1.00 − 1/1.025)` |
| Alice's redeem on Apr 1 | 476.190476 USYC | `500 / 1.05` (= 500 USD) |
| Bank's final claim | 23.228803 USYC | `1000 × (1/1.025 − 1/1.05)` |

To show the spec's exact quote of **0.975** (about 5.19 %), untick "Answer requests automatically" on `/dealer` before step 0:45 and quote `0.975` by hand in "Open requests". Alice then pays exactly 487.5 USDC, as in the spec's profit table.
