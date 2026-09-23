# Exodus client app: plan and decisions

This file is the working context for turning `exodus-app/web` from a developer skeleton into a real client app. It records **what we decided and why** so any new session can continue without re-asking. The contract design itself stays in [`exodus.md`](exodus.md).

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by our `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote. Say so in the UI (a visible "Simulated tokens" badge) and in all copy.

## Goal

A usable product for real users, in the style of the Hashnote USYC app (dark dashboard, price and yield up top, one Subscribe/Redeem panel, holdings and activity below). Scope for now is **only the simulated yield asset** (faucet, subscribe, wallet). Later pages add split (PT/YT) and trading.

## User flow

Example with Alice:

1. **Sign up / log in** with email and password.
2. **Access form** (kept light): full name, country, and a checkbox "I understand USYC and USDC here are simulated test tokens". Status becomes **pending**.
3. **Admin** (the platform operator) sees "Alice Martin, France, pending" on `/admin` and clicks **Approve** (or Reject).
4. On approval the backend:
   - allocates Alice's **custodial Canton wallet**: a party such as `alice-7f3a::1220…` plus a ledger user with `actAs` rights for it;
   - creates **one `ClientAccess` contract** for her (signed by the Operator, Alice is observer). This single pass is her on-ledger whitelist entry for everything a client can do.
5. Alice opens `/app` and can do everything a client can do: **faucet** (100 test USDC, with a cooldown), **subscribe** (USDC → USYC), **send**. Later also split and trade.

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Everyone | Landing: what Exodus is, how simulated USYC works, "Request access" |
| `/login`, `/signup` | Everyone | Email + password |
| `/onboarding` | Signed-in, not approved | Access form, then "pending review" / "rejected" status |
| `/app` | Approved clients | Dashboard: price strip (USYC price, APY from index growth, demo date, live dot), price chart, Subscribe/Redeem panel (Redeem disabled until spec gap 13 is fixed), faucet card, holdings, activity |
| `/admin` | Operator admins | Applications list, Approve / Reject |
| `/lab` | Developers | The original walking skeleton: party switcher, oracle card and controls, CIP-56 wallet, subscribe, send, "what can this party see?" privacy table. Kept on purpose as the privacy demo for judges |

## Decisions (agreed 2026-09-23)

| # | Topic | Choice | Why (short) |
|---|---|---|---|
| A | Backend framework | **NestJS** (new workspace `exodus-app/api`) | Already the spec's plan for the operator bot; modules, guards and DTO validation are built in. The operator bot for `Market`/`Rfq` settlement will live here too |
| B | Database | **PostgreSQL** (Docker, `docker compose up db`) + **Prisma** | Production-like; stores users, applications, faucet claims, index history for the chart |
| C | Login | **Email + password**, httpOnly session cookie | No email server needed for the demo |
| D | Wallet | **Custodial**: the backend allocates a party + ledger user per client and submits commands for them after checking the session | Easy for users, like Hashnote. Self-custody (Canton external party with browser-held key) is a later step |
| E | On-ledger whitelist | **E2: one `ClientAccess` pass per client** + **explicit disclosure** of shared contracts | See below |
| F | Frontend stack | **Tailwind CSS 4** (`@tailwindcss/vite`) + **shadcn/ui** (Radix, code copied into `src/components/ui`) + **React Router** + **Recharts** + **lucide-react** | Accessible dialogs/tabs/toasts, readable code we own |
| G | Theme | **"Exodus Night"**: dark first, light mode too, teal primary, gold for yield | See the palette below |
| H | Session | **DB session**: random token in the httpOnly cookie, only its SHA-256 in `sessions` (agreed 2026-09-23) | Logout and revoking work at once; a JWT stays valid until it expires |
| I | Sandbox restarts | **Auto re-provision**: every `WALLET_CHECK_SECONDS` the API re-creates wallets whose party is gone | The sandbox is in-memory; clients keep their account, balances restart at 0 and the faucet cooldown resets |
| J | First admin | **Seed script** `npm run db:seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Explicit; nobody can sign up as admin through the API |
| K | Transfer receiver | **Party id**, not email | Looking clients up by email would leak who is a client |

### Why E2 (`ClientAccess`) and not E1 (adding clients to `users` lists)

E1 would add each new client to the `users` / `readers` lists of `UsycFund`, both `HoldingTransferFactory`s and `RateFeed`.

| | E1: lists on each contract | E2: one pass per client |
|---|---|---|
| Approve | Recreate 4 contracts (more as `Market`/`Rfq` arrive) | Create 1 contract |
| Privacy | Every client sees the whole client list (Alice learns Bank is a customer) | Alice sees only her own pass. Nobody sees the client list |
| Contention | Each approval archives the fund, so an in-flight subscribe can fail with "contract not found" | Shared contracts are never recreated |
| Revoke | Recreate 4 contracts without her | Archive her one pass |

How it works: because wallets are custodial, the backend submits Alice's commands anyway. It reads the fund, the transfer factory and the newest `RateIndex` snapshot (as their stakeholder) and attaches them as **disclosed contracts**. Inside the choice, the contract checks the pass on-ledger, for example in `Subscribe`:

```
access <- fetch accessCid
assertMsg "not an approved client" (access.client == subscriber && access.operator == operator)
```

**Transfers need two passes (option B, chosen 2026-09-23).** When Alice sends USYC to Bob, the factory checks Alice's pass AND Bob's pass, so tokens only move between approved clients (like the real, permissioned USYC). The factory is signed by the issuer and must fetch Bob's pass, so every pass has the **issuers as observers** (they do KYC, and already see every transfer of their token). The passes travel in the CIP-56 `extraArgs.context` under `exodus-sender-access` / `exodus-receiver-access`; the app discloses the factory and Bob's pass (read as the issuer). The option not taken (A) checked only the sender, so unapproved parties could receive tokens.

The faucet does **not** need the pass on-ledger: the backend mints as `UsdcIssuer` only if the database says the client is approved and the cooldown has passed.

This fixes spec gap 9 (factory shared through an observer list) and most of gap 11 (no allowlist; the owner-only `Holding.Transfer` is still unchecked). Bootstrap gives Alice and Bank passes so `/lab` keeps working.

**Who reads what, for disclosure** (the backend will do the same as `@exodus/ledger` does today):

| Contract | Read as | Disclosed to |
|---|---|---|
| `UsycFund` | UsycIssuer | the subscriber |
| newest `RateIndex` | UsycIssuer (the only reader) | the subscriber |
| `HoldingTransferFactory` | its issuer | the sender |
| receiver's `ClientAccess` | the issuer | the sender |
| own `ClientAccess` | the client itself | (not needed) |

### Theme "Exodus Night"

| Token | Dark | Light | Used for |
|---|---|---|---|
| background | `#0A0E14` | `#F7F8FA` | page |
| surface (card) | `#111722` | `#FFFFFF` | cards |
| border | `#1F2733` | `#E3E7ED` | lines |
| text / muted | `#E7ECF3` / `#8B97A8` | `#0F1720` / `#5B6675` | copy |
| primary (teal) | `#2DD4BF` | `#0F9E8C` | buttons, chart line, "live" dot |
| gold | `#E8B75A` | `#B7862B` | yield / APY highlights |
| destructive / warning | `#F87171` / `#FBBF24` | `#DC2626` / `#B45309` | errors / "Simulated" badge |

Fonts: **Inter** for text, **JetBrains Mono** for numbers (tabular figures so amounts line up).

## Build order and status

| Step | What | Status |
|---|---|---|
| 1 | Frontend foundation: Tailwind, shadcn/ui, router, theme, landing page; the old screens moved to `/lab` with no behaviour change | Done (2026-09-23). Own `ThemeProvider` instead of `next-themes` (its inline script makes React 19 log an error) |
| 2 | Contracts: `ClientAccess` template; `Subscribe` and the transfer factory take the pass; shared contracts read through disclosure; tests; bootstrap gives Alice and Bank passes; ledger client attaches disclosed contracts | Done (2026-09-23). Option B: transfers check sender and receiver passes. 24 Daml tests pass; checked in the browser on a fresh sandbox. Bootstrap now retries the DAR upload while the sandbox is still connecting to its synchronizer |
| 3 | Backend `exodus-app/api`: NestJS + Prisma + Postgres; auth, applications, admin approve (allocate party + user, create pass), faucet, index-history recorder, custodial command endpoints | Done (2026-09-23). NestJS 12, Prisma 7.10 (the npm `latest` tag of the CLI is an 8.0 RC, so we pinned the stable 7.10), Postgres 18 in Docker. Built with plain `tsc` (TS 7 emits decorator metadata). Checked end to end through the Vite proxy: sign-up, apply, approve, faucet (+ 429 cooldown), subscribe, send to Bank, send to Operator refused, re-provisioning, price recording |
| 4 | Pages: landing, signup/login, onboarding form, admin | To do |
| 5 | `/app` dashboard: price strip, chart, subscribe, faucet, holdings, activity | To do |
| 6 | Update README, CLAUDE.md and the spec; typecheck, lint, tests | To do |

Update this table as steps land.

## Backend API (step 3)

Base path `/api` (Swagger UI at `http://localhost:3000/api/docs`). Every response is `{ statusCode, message, data }`; errors are `{ statusCode, message, errors? }`. Every route needs the session cookie unless marked public.

| Method + path | Who | What |
|---|---|---|
| `POST /auth/signup`, `POST /auth/login` | Public (rate-limited) | Create account / log in; sets the `exodus_session` cookie |
| `POST /auth/logout`, `GET /auth/me` | Signed in | End the session / profile with application status and wallet party (the web app routes on this) |
| `GET`, `PUT /applications/me` | Signed in | Read / submit my access form (again after a rejection) |
| `GET /admin/applications?status=&page=&limit=` | Admin | Review queue, oldest first |
| `POST /admin/applications/:id/approval` | Admin | Allocate party `client-<12 hex of user id>` + ledger user, create the `ClientAccess` pass, save the wallet |
| `POST /admin/applications/:id/rejection` | Admin | Reject with an optional reason |
| `GET /wallet` | Approved client | Party id, balances, holdings, next faucet time |
| `POST /wallet/faucet-claims` | Approved client | 100 test USDC, once per 24 h (429 otherwise) |
| `POST /wallet/subscriptions` | Approved client | `{ usdcAmount }`, uses `subscribeUsyc` |
| `POST /wallet/transfers` | Approved client | `{ receiverPartyId, instrument, amount }`, uses `sendHoldings` |
| `GET /prices/usyc?limit=` | Public | Recorded index history for the chart (changes only, no heartbeats) |
