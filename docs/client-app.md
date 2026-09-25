# Exodus client app: plan and decisions

This file is the working context for turning `exodus-app/web` from a developer skeleton into a real client app. It records **what we decided and why** so any new session can continue without re-asking. The contract design itself stays in [`exodus.md`](exodus.md).

> **Simulation notice.** "USYC" and "USDC" are simulated tokens issued by our `UsycIssuer` and `UsdcIssuer` demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote. Say so in the UI (a visible "Simulated tokens" badge) and in all copy.

> **Status (2026-09-23): all six steps are done.** How to run it: [`run-locally.md`](run-locally.md).

## Goal

A usable product for real users, in the style of the Hashnote USYC app (dark dashboard, price and yield up top, one Subscribe/Redeem panel, holdings and activity below). Scope for now is **only the simulated yield asset** (faucet, subscribe, redeem, wallet). Later pages add split (PT/YT) and trading.

## User flow

Example with Alice:

1. **Sign up / log in** with email and password.
2. **Access form** (kept light): full name, country, and a checkbox "I understand USYC and USDC here are simulated test tokens". Status becomes **pending**.
3. **Admin** (the platform operator) sees "Alice Martin, France, pending" on `/admin` and clicks **Approve** (or Reject).
4. On approval the backend:
   - allocates Alice's **custodial Canton wallet**: a party such as `alice-7f3a::1220…` plus a ledger user with `actAs` rights for it;
   - creates **one `ClientAccess` contract** for her (signed by the Operator, Alice is observer). This single pass is her on-ledger whitelist entry for everything a client can do.
5. Alice opens `/app` and can do everything a client can do: **faucet** (100 test USDC, with a cooldown), **subscribe** (USDC → USYC), **redeem** (USYC → USDC, paid by the fund a few seconds later), **send**. Later also split and trade.

## Pages

| Route | Who | What |
|---|---|---|
| `/` | Everyone | Landing: what Exodus is, how simulated USYC works, "Request access" |
| `/login`, `/signup` | Everyone | Email + password |
| `/onboarding` | Signed-in, not approved | Access form, then "pending review" / "rejected" status |
| `/app` | Approved clients | Dashboard: price strip (USYC price, APY from index growth, demo date, live dot), price chart, Subscribe/Redeem panel (Redeem shows pending requests with a Cancel button), faucet card, holdings, activity |
| `/markets` | Signed in | Market cards: maturity, underlying APY, fixed APY, the house dealer's PT price (markets-plan Phase 7) |
| `/markets/:id` | Signed in (actions: approved clients) | Tabs Fixed Yield (PT) (private RFQ: quote, countdown, Accept/Reject), Mint / Redeem (split / merge), Yield (YT) (claim), At maturity (redeem PT); "Your position" card |
| `/portfolio` | Approved clients | PT/YT per market with USD value, open payout requests with Cancel, market activity |
| `/dealer` | Admins | House dealer desk: open RFQs (manual quote / decline), Bank's position and its claim / PT redeem, live quotes, bot settings |
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
| G | Theme | **"Meridian"** (replaced "Exodus Night" on 2026-09-23): dark first, light mode too; two brand inks, the text colour for principal (PT) and copper for yield (YT) only | See the palette below |
| H | Session | **DB session**: random token in the httpOnly cookie, only its SHA-256 in `sessions` (agreed 2026-09-23) | Logout and revoking work at once; a JWT stays valid until it expires |
| I | Sandbox restarts | **Auto re-provision**: every `WALLET_CHECK_SECONDS` the API re-creates wallets whose party is gone | The sandbox is in-memory; clients keep their account, balances restart at 0 and the faucet cooldown resets |
| J | First admin | **Seed script** `npm run db:seed` from `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Explicit; nobody can sign up as admin through the API |
| K | Transfer receiver | **Party id**, not email | Looking clients up by email would leak who is a client |
| L | Forms | **Plain state** (`useState` + React Query mutation); the API validates and its field errors show under each input | No form library for 2–3 field forms |
| M | Page guards | **`<RequireStage stage=…>`** component reading `useProfile()` | Same data style as the rest of the app |
| N | Country field | **Searchable combobox**, ISO codes from `i18n-iso-countries` | Same codes the API validates |
| O | Activity list | **Ledger history**: `getHoldingActivity` reads the party's `Holding` creates/archives from `/v2/updates` and nets them per transaction | Shows incoming transfers too; always matches the ledger. A faucet mint and a transfer from another client both show as "Received" |
| Q | Redeem (added 2026-09-25) | **Request + settle** (approach A): `RequestRedeem` burns the USYC and opens a `UsycRedeemRequest`; the API's `RedeemSettlementService` pays it as UsycIssuer every `REDEEM_SETTLE_SECONDS`, **at the settle-time price**; the owner can cancel. Bootstrap seeds a **1,000,000 USDC fund reserve** | Only the fund's loop spends the fund's USDC, so no contention and clients never see the fund's balance. The option not taken (B, an atomic redeem co-signed by the backend as UsycIssuer) was instant but put the fund's authority on every client command and made concurrent redeems fight over the same holding. See spec 8.0b |
| P | APY | **Last 30 demo days**, annualised with compounding: `(indexNow / indexThen)^(365 / days) − 1` | Like a fund's 30-day yield; "—" until 7 demo days of history |

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

### Theme "Glacier"

The values live in `exodus-app/web/src/styles/tokens.css` (dark "Glacier" is the default, light "Frost" also exists). The idea comes from the logo: a solid silver block (principal) with a blue glass wedge (yield) seated in it.

| Token | Dark (default) | Light | Used for |
|---|---|---|---|
| background / card | `#060A13` / `#0B1220` | `#EEF2F8` / `#FFFFFF` | page / panels |
| foreground (= pt) | `#E6ECF5` (silver) | `#0B1220` | copy, principal, par, the maturity line |
| yt (electric blue) | `#4D8DFF` | `#1D5BD8` | **yield only**: YT, claimable yield, floating rates. Never buttons, borders, focus or decoration |
| info | `#A99BFF` (violet) | `#5B4BD1` | pending / settling, so it never looks like yield |

Surfaces are glass: `.glass` (thin fill, blur, a 1 px gradient rim), `.glass-strong` for floating things, `.glass-sheen` for large panels. Font: **Inter** everywhere (its display cut for big headlines), **Geist Mono** only for identifiers. No gradient text: hierarchy comes from white against dimmed white, and big amounts dim their decimals (`Amount`). Radius: 8 chips, 12 controls, 20 cards, 28 panels. The landing page is always dark and has five short sections (Hero, The split, Privacy, The app, Close).

## Build order and status

| Step | What | Status |
|---|---|---|
| 1 | Frontend foundation: Tailwind, shadcn/ui, router, theme, landing page; the old screens moved to `/lab` with no behaviour change | Done (2026-09-23). Own `ThemeProvider` instead of `next-themes` (its inline script makes React 19 log an error) |
| 1b | Meridian design: tokens and fonts, the cut-plate mark and favicon, and the landing page: hero with the 3D instrument (`web/public/instrument/`), scroll-driven split story, "Two instruments. One date." maturity chart, "One trade. Four ledgers." privacy lens, the light "maths adds up" term sheet and a real product preview. `/lab` loads lazily so the landing page ships no ledger code | Done (2026-09-23). App shell and Portfolio screen next |
| 1c | Privacy section rebuilt around a three-plate stack (`web/public/privacy/`): glass = price and rate (Quote), silver = PT leg, dark metal = cash leg. Picking a party fades the plates its node does not store and shows "N of 3 parts" | Done (2026-09-24) |
| 1d | Glacier redesign: glass surfaces, blue = yield only, Inter; the hero and split story show a rendered silver block and glass wedge (`web/public/glass/`); landing trimmed to five sections (about 1,060 → 400 words) | Done (2026-09-25) |
| 2 | Contracts: `ClientAccess` template; `Subscribe` and the transfer factory take the pass; shared contracts read through disclosure; tests; bootstrap gives Alice and Bank passes; ledger client attaches disclosed contracts | Done (2026-09-23). Option B: transfers check sender and receiver passes. 24 Daml tests pass; checked in the browser on a fresh sandbox. Bootstrap now retries the DAR upload while the sandbox is still connecting to its synchronizer |
| 3 | Backend `exodus-app/api`: NestJS + Prisma + Postgres; auth, applications, admin approve (allocate party + user, create pass), faucet, index-history recorder, custodial command endpoints | Done (2026-09-23). NestJS 12, Prisma 7.10 (the npm `latest` tag of the CLI is an 8.0 RC, so we pinned the stable 7.10), Postgres 18 in Docker. Built with plain `tsc` (TS 7 emits decorator metadata). Checked end to end through the Vite proxy: sign-up, apply, approve, faucet (+ 429 cooldown), subscribe, send to Bank, send to Operator refused, re-provisioning, price recording |
| 4 | Pages: landing, signup/login, onboarding form, admin | Done (2026-09-23). Plain `useState` forms + React Query mutations, with API field errors under each input; `RequireStage` guard component (redirects by profile); searchable country combobox (`i18n-iso-countries` + shadcn Command). `/app` is a placeholder (party id + copy) until step 5. Checked in headless Chromium: sign-up → form → pending → admin approve → "You are approved" appears by itself → `/app` → log out |
| 5 | `/app` dashboard: price strip, chart, subscribe, faucet, holdings, activity | Done (2026-09-23). Price strip (price, 30-day APY, demo date, days to maturity, Live/Paused), Recharts area chart with crosshair tooltip and a screen-reader table, Subscribe/Redeem panel (Redeem explained as spec gap 13), faucet with countdown, holdings with USD value and party id, send form, activity from the ledger history. Checked in headless Chromium (dark, light, 390 px): faucet, subscribe 40 USDC, send to Operator refused, send 5 USYC to Bank, activity rows |
| 6 | Update README, CLAUDE.md and the spec; typecheck, lint, tests | Done (2026-09-23). Unit tests with `node:test` (43: ledger 19, API 15, web 9; `npm test` in `exodus-app`), root `README.md` with screenshots (`docs/images/`), spec updated (architecture, trust in the custodial backend, gaps 15–17), `run-locally.md`. The API test found and fixed a bug: `COOKIE_SECURE=false` was read as `true`. Final run: 24 Daml tests, 43 unit tests, typecheck, lint, web build, migrations on an empty database, full browser flow |
| 7 | USYC redeem (spec gap 13): contract, tests, `@exodus/ledger` `redeem.ts`, API endpoints + settlement loop, Redeem tab with pending list, activity labels | Done (2026-09-25). 31 Daml tests (7 new in `RedeemTest`), unit tests for `multiplyRoundDown6`, `hasAtMost6Decimals`, `previewUsdc` and the redeem activity rows. Checked on a fresh sandbox with the oracle running: redeem 100 USYC, price moved before settle, paid 101.331521 USDC at 1.0133152174; cancel gave the USYC back; other parties saw no requests |
| 8 | Glacier integration of the app screens (Farouk): lazy app pages, landing → sign-up, Glacier primitives, glass sidebar shell, then every screen restyled or rebuilt on the same hooks | In progress (2026-09-25). 8.1 done: every page except the landing loads lazily (`lazyPage` in `router.tsx`); the landing downloads no ledger, app or chart code (entry file 1.28 MB → 458 kB). 8.2 done: the landing's buttons lead into the app ("Request access" → /signup, "Log in", "Open the lab"); the landing itself never calls the API. 8.3 done: the shadcn primitives follow Glacier (glass cards, pill tabs and buttons, glass menus and dialogs, quiet tables) and the colours mean one thing each: yield blue for yield only (the old `text-gold` did not exist), success green for live and approved, violet for pending. 8.4 done: the app shell (decision B1) is a floating glass sidebar (`AppLayout`: navigation by role, the demo clock with Live/Paused, the account menu; a glass top bar with a menu on phones); sign-up, login and onboarding use `FocusLayout` (one centred column). 8.5 done: sign-up, login and onboarding restyled on the same hooks, with a 4-step journey line (Account, Access request, Review, Wallet), show/hide password, a real h1 on each screen, and "Browse the markets" while an application waits. 8.6 done: the Wallet rebuilt on the same hooks: a "Get started" checklist for a new wallet (faucet → subscribe → markets), summary cards (value, USYC, USDC, fund APY), big amount boxes with Max and a "You get about" preview, the price chart with its growth since the first point, holdings with a Send dialog per token, glass activity rows. 8.7 done: Markets list (Pendle-style names, fixed APY in silver, underlying APY in yield blue, deep links `?tab=`) and the market page (stat cards, trade widget with an "at maturity" line, a firm-quote card with a draining countdown, token-row previews for mint/redeem/payouts). Fixed: asking again right after a quote expired picked the old quote up again (it shows "Expired" 2 s early), so the new quote never appeared. 8.8 done: Portfolio like the landing's app preview: summary cards (value, claimable yield summed exactly, principal at maturity, next maturity), one row per PT and per YT with its next action (Sell / Redeem / Claim, linking to the right tab), payout requests, market activity, and an empty state. 8.9 done: Dealer desk (summary cards, RFQ inbox, live quotes, inventory with Bank's payouts, bot settings, a Bot/Manual quoting chip) and Applications (status chips, bright Approve) restyled on the same hooks; checked manual quoting end to end |

Update this table as steps land.

## Web app structure (step 4)

- `web/src/api/`: `client.ts` (`apiRequest`, `ApiError` with `fieldErrors`), `types.ts` (response shapes, written by hand to match the API), `hooks.ts` (one React Query hook per call), `query-client.ts` (any 401 clears the cached profile, so guards send the user to `/login`).
- `web/src/auth/`: `RequireStage` (`signed-out` for /login and /signup, `signed-in` for /onboarding, `approved` for /app, `admin` for /admin) and `homePathFor` (admin → /admin, wallet → /app, else /onboarding).
- `web/src/components/layout/`: `AppLayout` (sidebar shell: `AppNav` decides the links by role, `DemoClock`, `AccountCard`), `FocusLayout` (sign-up, login, onboarding), `MarketingLayout` (landing).
- `web/src/router.tsx`: every page except the landing is a `lazyPage(...)`: its code downloads when it is opened, with `PageLoading` shown meanwhile on a first visit. Add new pages the same way, so the landing page never ships app code.
- Logging out reloads `/` with `window.location.assign`. A router navigation would lose the race against the guard of the current page, which would jump to /login.

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
| `POST /wallet/redemptions` | Approved client | `{ usycAmount }` (at most 6 decimals), uses `requestUsycRedeem`: burns the USYC and opens a request |
| `GET /wallet/redemptions` | Approved client | My open redeem requests `{ items: [{ requestId, usycAmount, requestedAt }] }`, oldest first |
| `DELETE /wallet/redemptions/:requestId` | Approved client | Cancel an open request; the USYC comes back (422 if the fund already paid it) |
| `POST /wallet/transfers` | Approved client | `{ receiverPartyId, instrument, amount }`, uses `sendHoldings` |
| `GET /wallet/activity?limit=` | Approved client | Latest token movements from the ledger: `RECEIVED`, `SENT`, `SUBSCRIBED`, `REDEEM_REQUESTED`, `REDEEMED`, `REDEEM_CANCELLED` with net change per token |
| `GET /prices/usyc/latest` | Public | Newest price snapshot, `isLive`, days to maturity, 30-day APY |
| `GET /prices/usyc?limit=` | Public | Recorded index history for the chart (changes only, no heartbeats) |
| `GET /markets`, `GET /markets/:marketId` | Signed in | Market cards: maturity, days left, matured + maturity index, current index, underlying 30-day APY, the house dealer's indicative `askPrice`/`bidPrice`/`midPrice` with fixed APY (null once matured), `dealerAutoQuote` |
| `POST /markets/:marketId/splits` | Approved client | `{ usycAmount }` (≤ 6 decimals): USYC into PT + YT (`splitUsyc`) |
| `POST /markets/:marketId/merges` | Approved client | `{ amount }`: PT + YT back into USYC before maturity; the Operator bot pays `amount / lastIndex` |
| `POST /markets/:marketId/claims` | Approved client | Claim the yield of all my YT (after maturity: the final claim, YT used up) |
| `POST /markets/:marketId/pt-redemptions` | Approved client | After maturity: redeem all my PT for 1 USD of USYC each |
| `GET /portfolio` | Approved client | `{ positions: [{ marketId, ptTotal, ptLocked, ptFree, ytTotal, ytPieces: [{ amount, lastIndex }], claimableUsyc, ptPrice, value: { ptUsd, ytUsd, claimableUsd, totalUsd } }], openRequests: [{ requestId, kind, amount, estimatedUsyc }], totalUsd }` (YT valued at 1 − PT price, like Pendle) |
| `DELETE /portfolio/requests/:requestId` | Approved client | Cancel my open claim, PT redeem or merge; the PT/YT come back |
| `POST /quote-requests` | Approved client | `{ marketId, side: "BuyPt" \| "SellPt", ptAmount }`: private RFQ to the house dealer (Bank) |
| `GET`, `DELETE /quote-requests[/:requestId]` | Approved client | My unanswered RFQs / cancel one |
| `GET /quotes` | Approved client | My firm quotes: price, `usdcAmount`, `validUntil`, `isLive`, `fixedApyPercent` |
| `POST /quotes/:quoteId/acceptance`, `/rejection` | Approved client | Accept (atomic DvP: USDC and PT in one transaction) / reject (a buy quote's locked PT is released at once) |
| `GET /dealer/quote-requests` | Admin | Bank's open RFQs with the requester and the bot's suggested price |
| `POST /dealer/quote-requests/:requestId/quotes`, `/declines` | Admin | Quote by hand `{ price }` / decline |
| `GET /dealer/position` | Admin | Bank's PT, YT, USDC (and USDC set aside for sell quotes), USYC, live quotes |
| `POST /dealer/markets/:marketId/claims`, `/pt-redemptions` | Admin | Bank's own YT claim / PT redeem (paid by the Operator bot) |
| `GET`, `PUT /dealer/settings` | Admin | Dealer bot settings: `autoQuote`, `apyOffsetPercent`, `fallbackApyPercent`, `spreadPercent`, `maxPtPerQuote`, `quoteValidSeconds` |

The markets bots run inside the API: `OperatorSettlementService` (every `MARKET_SETTLE_SECONDS`, 2) matures due markets and pays claims, PT redeems and merges oldest first; `DealerBotService` (every `DEALER_POLL_SECONDS`, 1) withdraws expired quotes and answers RFQs to Bank with `price = (1 + target ∓ spread)^−years` (target = underlying 30-day APY + offset, 5.2 % until 7 days of history), declining what is over the size limit or cannot be filled. Details and decisions M1–M2 in `markets-plan.md`.
