# exodus-app

The off-ledger parts of Exodus: a shared JSON Ledger API client, the demo oracle bot and the web UI.

This is a **walking skeleton**: a thin but real end-to-end slice (ledger, bot, UI) built on the contracts that exist today (`Holding`, `HoldingTransferFactory`, `RateIndex`). New screens get added as each new contract (`Tokens`, `Market`, `Rfq`) is written.

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by the `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle.

## Packages

| Folder | Package | What it does |
|---|---|---|
| `ledger/` | `@exodus/ledger` | Typed client for the Canton JSON Ledger API v2, read helpers (`getRateIndex`, `getOwnedHoldings`, ...), CIP-56 `sendHoldings`, the demo oracle schedule, and the `bootstrap` script. Shared by the bot and the UI. |
| `oracle-bot/` | `@exodus/oracle-bot` | Moves the USYC index and the demo clock forward along the spec §9 path. |
| `web/` | `@exodus/web` | React + Vite UI: party switcher, oracle card, CIP-56 wallet, send form, oracle controls and a "what can this party see?" privacy table. |
| `generated/daml.js/` | `@daml.js/*` | TypeScript types for our Daml templates, from `dpm codegen-js`. Generated, not committed. |

Where the types come from:

- **Daml payloads** (`RateIndex`, `Holding`, CIP-56 `HoldingView`, ...) come from `dpm codegen-js` (`npm run codegen:daml`).
- **JSON API requests and responses** come from the official OpenAPI spec in `ledger/openapi/json-ledger-api-v2.yaml` (Canton 3.5.18). `npm run codegen:api` regenerates `ledger/src/generated/json-ledger-api-v2.ts`. Both files are committed, because they only change with the SDK.
- `@daml/ledger` is **not** used. Its last stable release (2.10.6) only speaks the old JSON API v1.

## Requirements

- Node.js 24 (runs the `.ts` files of the bot and bootstrap directly, no build step)
- `dpm` with SDK 3.5.11 (see `../CLAUDE.md`)

## Run it

```bash
cd exodus-app
npm run codegen:daml   # 1. build the DAR and generate the Daml types (needed before npm install)
npm install            # 2. install packages

npm run ledger         # terminal 1: Canton sandbox with our DAR, JSON API on :7575
npm run bootstrap      # once per sandbox start (the sandbox keeps data in memory only)
npm run oracle         # terminal 2: oracle bot (or `npm run oracle:once` for one step)
npm run web            # terminal 3: UI on http://localhost:5173
```

After a change in `exodus-contract/main`, run `npm run codegen:daml` again and restart the sandbox.

Oracle bot settings (environment variables):

| Variable | Default | Meaning |
|---|---|---|
| `LEDGER_URL` | `http://localhost:7575` | JSON Ledger API |
| `ORACLE_TICK_SECONDS` | `5` | real seconds between publishes |
| `ORACLE_STEP_DAYS` | `7` | demo days per publish (never jumps over Jan 1 or Apr 1, so the spec values are hit exactly) |

Other commands: `npm run typecheck` (all packages), `npm run lint -w @exodus/web`, `npm run build -w @exodus/web`.

## What the bootstrap creates

| Contract | Details |
|---|---|
| Parties | Operator, UsycIssuer, UsdcIssuer, Oracle, Alice, Bank |
| `RateIndex` | USYC index 1.00 on 2026-10-01; readers Alice and Bank; operator Operator |
| `HoldingTransferFactory` × 2 | one for UsycIssuer, one for UsdcIssuer; users Alice and Bank |
| `Holding` | 1000 USYC for Bank, 1000 USDC for Alice |

## What the skeleton checks (results from 2026-09-23)

| # | Check | How | Result |
|---|---|---|---|
| 1 | CIP-56 works outside Daml Script | The wallet reads holdings only through the `HoldingV1.Holding` interface view; Send uses `TransferFactory_Transfer` | ✅ Bank sent 100 USYC to Alice; Bank 900, Alice 100 |
| 2 | Privacy | "What can this party see?" table per party | ✅ Operator sees only the `RateIndex`, no holdings. UsdcIssuer cannot see the `RateIndex`. |
| 3 | Stale `RateIndex` contract id | Two bots at 0.2 s ticks; then the UI "Next step" button while the bot runs at 0.3 s | ⚠️ See below |
| 4 | Clock drift (`requestedAt <= ledger time`) | Send uses this machine's clock for `requestedAt` | ✅ No failure on the local sandbox (same clock). Re-check on LocalNet/DevNet. |
| 5 | Decimals | Amounts stay strings; sums use bigint units | ✅ |

**Stale `RateIndex` (check 3).** Every `Publish` archives the old `RateIndex`, so any command holding the old contract id fails:

- Two writers at the same time: `LOCAL_VERDICT_LOCKED_CONTRACTS` (about half of all publishes failed; the bot's retry-with-fresh-read recovered every time).
- An id that is already archived: `CONTRACT_NOT_FOUND`.
- The UI (which reads the id on a 2 s poll) lost **6 out of 6** times against a bot publishing every 0.3 s.

`isStaleContractError()` in `@exodus/ledger` detects both codes. This is the same failure `Split` and `Claim` will hit, because they take a `rateCid`. It is tracked as known gap 12 in `docs/exodus.md`.
