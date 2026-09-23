# exodus-app

The off-ledger parts of Exodus: a shared JSON Ledger API client, the demo oracle bot, the backend API and the web UI.

This is a **walking skeleton**: a thin but real end-to-end slice (ledger, bot, UI) built on the contracts that exist today (`Holding`, `HoldingTransferFactory`, `RateIndex`, `UsycFund`). New screens get added as each new contract (`Tokens`, `Market`, `Rfq`) is written.

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by the `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle.

## Packages

| Folder | Package | What it does |
|---|---|---|
| `ledger/` | `@exodus/ledger` | Typed client for the Canton JSON Ledger API v2, read helpers (`getRateIndex`, `getOwnedHoldings`, ...), CIP-56 `sendHoldings`, `subscribeUsyc` (USDC to USYC, with stale-index retry), the demo oracle schedule, and the `bootstrap` script. Shared by the bot and the UI. |
| `oracle-bot/` | `@exodus/oracle-bot` | Moves the USYC index and the demo clock forward along the spec §9 path. |
| `web/` | `@exodus/web` | React + Vite + Tailwind CSS 4 + shadcn/ui UI with React Router. `/` is the public landing page; `/signup`, `/login`, `/onboarding` (access form and review status), `/admin` (review queue) and `/app` (approved clients; the dashboard lands in step 5) talk to the backend API. `/lab` is the developer lab: party switcher, oracle card, CIP-56 wallet, USYC subscribe card, send form, oracle controls and a "what can this party see?" privacy table. |
| `api/` | `@exodus/api` | NestJS + Prisma + PostgreSQL backend: email/password accounts (DB sessions), access applications, admin approval (allocates the client's custodial party + ledger user and creates their `ClientAccess` pass), the 100 test USDC faucet, custodial wallet commands (subscribe, send) and the USYC price history. Endpoints are listed in `../docs/client-app.md`; Swagger UI at `http://localhost:3000/api/docs`. |
| `generated/daml.js/` | `@daml.js/*` | TypeScript types for our Daml templates, from `dpm codegen-js`. Generated, not committed. |

Where the types come from:

- **Daml payloads** (`RateIndex`, `Holding`, CIP-56 `HoldingView`, ...) come from `dpm codegen-js` (`npm run codegen:daml`).
- **JSON API requests and responses** come from the official OpenAPI spec in `ledger/openapi/json-ledger-api-v2.yaml` (Canton 3.5.18). `npm run codegen:api` regenerates `ledger/src/generated/json-ledger-api-v2.ts`. Both files are committed, because they only change with the SDK.
- `@daml/ledger` is **not** used. Its last stable release (2.10.6) only speaks the old JSON API v1.

## Requirements

- Node.js 24 (runs the `.ts` files of the bot and bootstrap directly, no build step)
- Docker (PostgreSQL for the backend API)
- `dpm` with SDK 3.5.11 (see `../CLAUDE.md`)

## Run it

```bash
cd exodus-app
npm run codegen:daml   # 1. build the DAR and generate the Daml types (needed before npm install)
npm install            # 2. install packages

npm run ledger         # terminal 1: Canton sandbox with our DAR, JSON API on :7575
npm run bootstrap      # once per sandbox start (the sandbox keeps data in memory only)
npm run oracle         # terminal 2: oracle bot (or `npm run oracle:hold` to move time by hand in the UI)
npm run web            # terminal 3: UI on http://localhost:5173
```

Backend API (needed by the client pages; `/lab` works without it):

```bash
cp api/.env.example api/.env   # once; change ADMIN_PASSWORD
npm run db:up          # PostgreSQL 18 in Docker on :5432 (data kept in a Docker volume)
npm run db:migrate     # apply the database migrations
npm run db:seed        # create the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run api            # terminal 4: build and start the API on :3000 (Vite forwards /api to it)
```

The API checks every `.env` value at startup (see `api/.env.example`). It also polls the ledger:

- every `PRICE_POLL_SECONDS` (5) it stores the USYC index when it changed, for the price chart;
- every `WALLET_CHECK_SECONDS` (30) it re-creates client wallets whose party no longer exists. The sandbox forgets everything when it restarts, so after `npm run ledger` + `npm run bootstrap`, approved clients get a new, empty wallet on their own.

To change the database schema: edit `api/prisma/schema.prisma`, then `npm run db:migrate:dev -w @exodus/api -- --name what_changed`.

After a change in `exodus-contract/main`, run `npm run codegen:daml` again and restart the sandbox.

**Keep an oracle bot running.** Each price snapshot is usable for 30 s. The bot publishes the next step, sends a heartbeat (the same price again) when the clock is not moving, and archives expired snapshots. Without it, the index card shows "expired" and Subscribe fails with "No valid USYC price".

| Command | What the oracle bot does |
|---|---|
| `npm run oracle` | advance the demo clock every tick + heartbeat + cleanup |
| `npm run oracle:hold` | heartbeat + cleanup only; move the clock with the Oracle's "Next step" button |
| `npm run oracle:once` | one tick, then exit |

Oracle bot settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `LEDGER_URL` | `http://localhost:7575` | JSON Ledger API |
| `ORACLE_TICK_SECONDS` | `5` | real seconds between ticks |
| `ORACLE_STEP_DAYS` | `7` | demo days per publish (never jumps over Jan 1 or Apr 1, so the spec values are hit exactly) |

Other commands: `npm run typecheck` (all packages), `npm run lint -w @exodus/web`, `npm run build -w @exodus/web`.

## What the bootstrap creates

| Contract | Details |
|---|---|
| Parties | Operator, UsycIssuer, UsdcIssuer, Oracle, Alice, Bank |
| `RateFeed` + first `RateIndex` snapshot | USYC index 1.00 on 2026-10-01; snapshots valid for 30 s; reader UsycIssuer (the fund); operator Operator |
| `HoldingTransferFactory` × 2 | one for UsycIssuer, one for UsdcIssuer; no observers (disclosed to senders); accepts the Operator's access passes |
| `UsycFund` | signed by UsycIssuer, no observers (disclosed to subscribers); accepts USDC from UsdcIssuer, the index from Oracle and the Operator's access passes |
| `ClientAccess` × 2 | access passes for Alice and Bank, signed by Operator, observed by the client and both issuers |
| `Holding` | 1000 USYC for Bank, 1000 USDC for Alice |

## What the skeleton checks (results from 2026-09-23)

| # | Check | How | Result |
|---|---|---|---|
| 1 | CIP-56 works outside Daml Script | The wallet reads holdings only through the `HoldingV1.Holding` interface view; Send uses `TransferFactory_Transfer` | ✅ Bank sent 100 USYC to Alice; Bank 900, Alice 100 |
| 2 | Privacy | "What can this party see?" table per party | ✅ Operator sees only the `RateIndex`, no holdings. UsdcIssuer cannot see the `RateIndex`. Since the access passes: Alice sees only her holdings and her own pass (no fund, factory, price or other client) |
| 9 | Access passes + disclosure | Fresh sandbox; Alice subscribes 100 USDC; Bank sends 50 USYC to Alice; Bank sends to Operator | ✅ Subscribe and send work with the fund, factory, price and receiver's pass disclosed; sending to Operator (no pass) is refused with "The receiver is not an approved Exodus client" |
| 3 | Stale `RateIndex` contract id | Two bots at 0.2 s ticks; then the UI "Next step" button while the bot runs at 0.3 s | ⚠️ See below |
| 4 | Clock drift (`requestedAt <= ledger time`) | Send uses this machine's clock for `requestedAt` | ✅ No failure on the local sandbox (same clock). Re-check on LocalNet/DevNet. |
| 5 | Decimals | Amounts stay strings; sums use bigint units | ✅ |
| 6 | Atomic USYC subscribe | Alice pays 500 USDC at index 1.025 in the UI | ✅ Alice: 487.804878 USYC + 500 USDC change; UsycIssuer: 500 USDC; Bank and UsdcIssuer see none of Alice's USYC |
| 7 | Subscribe during oracle publishing | 10 subscribes while the bot publishes every 1 s | ✅ Before the gap 12 fix: 10/10, but all needed a retry. After: **10/10 with 0 retries** |
| 8 | Oracle stopped / hold mode | No bot for 35 s, then `oracle:hold` and 3 manual "Next step" clicks | ✅ Card shows "expired" and Subscribe explains why; heartbeat restores it; manual steps work alongside `hold` |

**Stale `RateIndex` (check 3).** Every `Publish` archives the old `RateIndex`, so any command holding the old contract id fails:

- Two writers at the same time: `LOCAL_VERDICT_LOCKED_CONTRACTS` (about half of all publishes failed; the bot's retry-with-fresh-read recovered every time).
- An id that is already archived: `CONTRACT_NOT_FOUND`.
- The UI (which reads the id on a 2 s poll) lost **6 out of 6** times against a bot publishing every 0.3 s.

`isStaleContractError()` in `@exodus/ledger` detects these, plus `UNKNOWN_CONTRACT_SYNCHRONIZERS` ("contracts have been archived", reported before the transaction even runs; found by check 7) and `LOCAL_VERDICT_INACTIVE_CONTRACTS`.

**The fix (gap 12, done).** A submit takes about 0.5–0.8 s on the sandbox, so with a 1 s oracle a retry-only approach needed a retry almost every time. The contract now splits the price in two: the oracle writes to a private `RateFeed`, and each publish creates a `RateIndex` snapshot that stays usable for 30 s and is not archived by the next publish. Readers never hold an id that dies on the next publish. The retry stays as a safety net. The trade-off (a user may pick the older of two valid snapshots) is gap 14 in `docs/exodus.md`.
