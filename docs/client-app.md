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
| G | Theme | **"Meridian"** (replaced "Exodus Night" on 2026-09-23): dark first, light mode too; two brand inks, the text colour for principal (PT) and copper for yield (YT) only | See the palette below |

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

The faucet does **not** need the pass on-ledger: the backend mints as `UsdcIssuer` only if the database says the client is approved and the cooldown has passed.

This also covers spec gap 9 (factory shared through an observer list) and most of gap 11 (no allowlist). Bootstrap gives Alice and Bank passes so `/lab` keeps working.

### Theme "Meridian"

The values live in `exodus-app/web/src/styles/tokens.css`. The idea: every Exodus position runs toward one date, the maturity (the "meridian").

| Token | Dark (default) | Light | Used for |
|---|---|---|---|
| background (bg-0) | `#0E1210` | `#F3F4F1` | page |
| card (bg-1) | `#151A17` | `#FFFFFF` | panels |
| secondary (bg-2) | `#1B211E` | `#ECEEEA` | hover, selected, inputs |
| border / input | `#262D29` / `#353D38` | `#E1E4DE` / `#C9CEC6` | lines / input borders |
| foreground / muted / faint | `#ECE8DF` / `#A9A59B` / `#8A867D` | `#111513` / `#4F5752` / `#666D67` | copy / secondary / labels |
| pt (= foreground) | `#ECE8DF` | `#111513` | principal, par, the maturity line; primary buttons |
| yt (copper) | `#D98A52` | `#A4561F` | **yield only**: YT, claimable yield, floating rates. Never buttons, borders, focus or decoration |
| success / destructive / warning / info | `#86C79A` / `#E8735F` / `#E2BE5C` / `#8FB3D9` | `#2B6A3E` / `#B0392B` / `#8A6200` / `#3D6592` | status, always with a word or icon; info = settling |

Fonts (bundled from npm): **Geist** for all interface text and numbers (tabular figures), **Geist Mono** only for identifiers (party and contract ids), **Archivo** (semi-condensed, 88% width, weight 600, tight tracking) for display: headlines, section titles, big figures and the wordmark. It replaced Instrument Serif on 2026-09-23 because the serif read as an editorial template. Radius: 3 px chips, 6 px controls, 8 px panels. The "Simulated tokens" note is neutral information, not a warning. The landing page is always dark (`MarketingLayout` puts `.dark` on its root); one section, "The maths adds up", uses `.theme-light` on purpose as an institutional term sheet.

## Build order and status

| Step | What | Status |
|---|---|---|
| 1 | Frontend foundation: Tailwind, shadcn/ui, router, theme, landing page; the old screens moved to `/lab` with no behaviour change | Done (2026-09-23). Own `ThemeProvider` instead of `next-themes` (its inline script makes React 19 log an error) |
| 1b | Meridian design: tokens and fonts, the cut-plate mark and favicon, and the landing page: hero with the 3D instrument (`web/public/instrument/`), scroll-driven split story, "Two instruments. One date." maturity chart, "One trade. Four ledgers." privacy lens, the light "maths adds up" term sheet and a real product preview. `/lab` loads lazily so the landing page ships no ledger code | Done (2026-09-23). App shell and Portfolio screen next |
| 1c | Privacy section rebuilt around a three-plate stack (`web/public/privacy/`, from the Codex renders in `assets/`): smoked glass = price and rate (Quote), silver = PT leg, gunmetal = cash leg. Picking a party fades the plates its node does not store and shows "N of 3 parts". The glass export was 4.5% too wide; its web file is corrected (95.5% scale, +35/+15 px, fitted to `privacy-stack-reference.png`) | Done (2026-09-24) |
| 1d | Glacier theme (experiment, uncommitted): navy glass, silver = principal, electric blue `--yt` = yield only (replaces copper), violet `--info`. Glass utilities (`.glass`, `.glass-strong`, `.glass-glow`, `.text-chrome`, `.btn-chrome`, `.reveal`), ambient light layer, floating glass nav, `chrome`/`glass` button variants, seated-wedge mark and favicon. `GlassStage` draws the silver block + glass wedge as vector until the Codex renders land in `web/public/glass/` (`shell`, `wedge`, `shadow-*`, `glow-wedge`, `hero-joined`, plus `shell-front` cut by us), then switches to them; re-measure `landing/glass-geometry.ts` then | In progress |
| 2 | Contracts: `ClientAccess` template; `Subscribe` and the transfer factory take the pass; shared contracts read through disclosure; tests; bootstrap gives Alice and Bank passes; ledger client attaches disclosed contracts | To do |
| 3 | Backend `exodus-app/api`: NestJS + Prisma + Postgres; auth, applications, admin approve (allocate party + user, create pass), faucet, index-history recorder, custodial command endpoints | To do |
| 4 | Pages: landing, signup/login, onboarding form, admin | To do |
| 5 | `/app` dashboard: price strip, chart, subscribe, faucet, holdings, activity | To do |
| 6 | Update README, CLAUDE.md and the spec; typecheck, lint, tests | To do |

Update this table as steps land.
