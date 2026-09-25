# Run Exodus on your machine

This guide takes you from a fresh clone to the full demo: sign up, get approved, claim test USDC, subscribe to simulated USYC, watch the price grow and redeem it back to USDC.

> "USYC" and "USDC" in Exodus are **simulated** tokens issued by our own demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote.

> **Just want to see the demo?** From the repository root: `docker compose up --build`, then open http://localhost:8080 (admin `admin@exodus.local` / `exodus-demo-admin`). Only Docker is needed. This guide is for running the parts by hand while developing.

## What runs where

Five programs work together. You start each one in its own terminal (Postgres runs in Docker in the background).

| # | Program | Command | Address | What it does |
|---|---|---|---|---|
| 1 | PostgreSQL | `npm run db:up` | `localhost:5432` | Stores accounts, applications, wallets, faucet claims and price history |
| 2 | Canton sandbox | `npm run ledger` | `localhost:7575` | The ledger: runs the Daml contracts and holds balances and access passes |
| 3 | Oracle bot | `npm run oracle` | none | Publishes the USYC price and moves the demo clock forward |
| 4 | Backend API | `npm run api` | `localhost:3000` (Swagger at `/api/docs`) | Login, applications, admin approval, custodial wallets, faucet |
| 5 | Web app | `npm run web` | **http://localhost:5173** | What you open in the browser |

```
browser ──► web :5173 ──/api──► API :3000 ──► Postgres :5432
                    └──/v2───► Canton sandbox :7575 ◄── oracle bot
                               (the API talks to the sandbox too)
```

All commands below run from the **`exodus-app`** folder unless the step says otherwise.

---

## 1. One-time setup

### 1.1 Check your tools

| Tool | Check | You need |
|---|---|---|
| Node.js | `node -v` | v24 or newer |
| dpm (Daml toolchain) | `dpm version --active` | `3.5.11` |
| Java | `java -version` | 17 or newer (the sandbox runs on Java) |
| Docker + Compose | `docker compose version` | any recent version, with the Docker daemon running |

If `dpm` is missing, install it from the Digital Asset docs ("Install dpm"), then install SDK 3.5.11 (the version pinned in `exodus-contract/multi-package.yaml`).

### 1.2 Build the contracts and install packages

```bash
cd exodus-app
npm run codegen:daml   # builds the Daml DAR and generates its TypeScript types (1–2 min the first time)
npm install            # installs every package (ledger, oracle-bot, api, web)
```

Order matters: `npm install` needs the generated types from `codegen:daml`.

### 1.3 Configure the API

```bash
cp api/.env.example api/.env
```

Open `api/.env` and set at least **`ADMIN_PASSWORD`** (10+ characters). That is the password of your admin account. The other defaults work for local use:

| Setting | Default | Change it when… |
|---|---|---|
| `ADMIN_EMAIL` | `admin@exodus.local` | you want another admin login |
| `FAUCET_COOLDOWN_HOURS` | `24` | testing: set `0` to claim again right away |
| `DATABASE_URL` | Postgres from Docker on 5432 | port 5432 is taken (see Troubleshooting) |

### 1.4 Create the database and the admin

```bash
npm run db:up        # starts PostgreSQL in Docker (waits until it is healthy)
npm run db:migrate   # creates the tables
npm run db:seed      # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
```

You should see `Admin ready: admin@exodus.local (…)`.

Setup is done. You do not repeat these steps unless you reset everything (section 5).

---

## 2. Start everything (every time)

Open **four terminals**, all in `exodus-app`.

**Terminal 1: the ledger**

```bash
npm run ledger
```

Leave it running. It needs about 20–40 seconds to start.

**Terminal 2: set up the ledger, then run the oracle**

```bash
npm run bootstrap   # creates the demo parties, fund (with a 1,000,000 USDC reserve), price feed, Alice and Bank, and the market PT-USYC-APR2027 where Bank splits its 1000 USYC into PT + YT (ends with "Done.")
npm run oracle      # keeps running: publishes a new price every 5 s
```

- Run `bootstrap` **after every ledger start**: the sandbox keeps everything in memory, so it starts empty each time. If you run it too early, it retries by itself ("attempt 2/10…").
- The price only stays valid for 30 seconds, so **keep the oracle running**. Otherwise the dashboard shows "Paused" and Subscribe is blocked.
- Prefer to move time by hand? Use `npm run oracle:hold` instead: it keeps the price valid but does not move the demo clock. Then use the "Next step" button on `/lab`.

**Terminal 3: the API**

```bash
npm run db:up   # only needed after a reboot (Docker stopped the database)
npm run api     # builds, then prints "Exodus API on http://localhost:3000/api"
```

**Terminal 4: the web app**

```bash
npm run web
```

Open **http://localhost:5173**.

---

## 3. Your first demo (5 minutes)

Use two browser windows. A private/incognito window gives a second login.

1. **Admin (window A).** Go to `/login` and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. You land on `/admin`, where the queue is empty.
2. **Client (window B).** On the home page, click **Request access** and sign up (for example `carol@example.com` and a 10+ character password).
3. Fill in the form: name, country (type "fra" to find France), tick the "simulated tokens" box, then **Send request**. You now see "under review".
4. **Admin (window A).** Carol appears within 15 seconds. Click **Approve**, then **Approve** again in the dialog. This creates her Canton party, her ledger user and her access pass.
5. **Client (window B).** Within 10 seconds the page switches to **"You are approved"**. Click **Open my wallet**.
6. On the dashboard:
   - **Faucet:** click **Claim 100 test USDC**. Holdings shows 100 USDC and Activity shows "Received +100 USDC".
   - **Subscribe:** enter `50` and check the preview ("You get about 49.5 USYC"), then click **Subscribe**. Activity shows "Subscribed −50 USDC · +49.5 USYC".
   - **Price:** watch the price strip and chart. With `npm run oracle` running, the demo date jumps 7 days every 5 seconds and the USYC price grows (1.00 on Oct 1 2026 → 1.025 on Jan 1 2027 → 1.05 on Apr 1 2027). Your USYC balance stays the same, but its USD value grows. That growth is the yield.
   - **Redeem:** open the **Redeem** tab, enter `20` USYC and check the estimate ("You get about 20.2 USDC"), then click **Redeem**. Your USYC is burned at once and the request shows under **Pending redeems**. Within about 2 seconds the fund pays you at the price of that moment and the request disappears. Activity shows "Redeem requested −20 USYC", then "Redeemed +20.2… USDC". Click **Cancel** on a pending request (for example while the oracle is stopped) to get the USYC back.
   - **Send:** sign up and approve a second client, copy their party id from their Holdings card, and send them some USYC. Sending to a party without an access pass is refused.
7. Want the privacy story? Open **`/lab`**. You can act as any demo party (Alice, Bank, the issuers, the Operator) and see which contracts each one can see.

---

### 3.1 The markets (spec section 13 demo)

Tip: use `npm run oracle:hold` for this demo and move the clock by hand with **Next step** on `/lab` (as the Oracle), so the dates wait for you.

1. **Client (window B)**, after subscribing some USDC to USYC on the Wallet: open **Markets** → `PT-USYC-APR2027`. On Oct 1 it shows a fixed APY of 5.10 % (buy PT at 0.975503).
2. **Fixed Yield (PT)**: enter `20`, **Get firm quote**. Within about 2 seconds the house dealer's quote appears with a countdown. **Accept**: your USDC and the PT change hands in one transaction.
3. **Privacy (window A, admin)**: open `/lab`, act as **Operator**: its "Markets" line shows `0 Quote` (it never sees the price); as **Bank** it shows the quote.
4. **Mint / Redeem**: mint PT + YT from USYC; redeem PT + YT together (the USYC arrives in about 2 seconds).
5. Move the clock to Jan 1 2027. **Dealer** page (admin): **Claim Bank's yield** → 24.390243 USYC for Bank's 1000 YT. The client's **Yield (YT)** tab shows its own claimable yield.
6. Move the clock to Apr 1 2027: the Operator bot matures the market by itself (the market shows **Matured**).
7. **At maturity**: **Redeem PT** (1 USD of USYC per PT), then the final claim in **Yield (YT)**. **Portfolio** and the Wallet's activity show every step.

Everything is also in Swagger (**http://localhost:3000/api/docs**): `/markets`, `/quote-requests`, `/quotes`, `/portfolio`, `/dealer/*`.

**After updating the code to Phase 6**, run `npm run db:migrate` once: it adds the `dealer_settings` table.

---

## 4. Stop and restart

- Stop a program with **Ctrl+C** in its terminal. Stop the database with `npm run db:down -w @exodus/api` (your data stays in a Docker volume).
- **Restarting the ledger wipes the ledger** (parties, balances, passes, price). After `npm run ledger`, run `npm run bootstrap` again.
  - Accounts and approvals survive, because they are in Postgres. Within 30 seconds the API notices that each approved client's party is gone and **creates a new, empty wallet** for them. Their faucet cooldown is reset, so they can start again.
  - The demo clock starts again at Oct 1 2026.
- Restarting the API or the web app loses nothing.

---

## 5. Reset everything

```bash
npm run db:reset -w @exodus/api   # deletes ALL accounts, applications, wallets and price history, then recreates the tables
npm run db:seed                   # recreate the admin
```

Then restart the ledger (Ctrl+C in terminal 1, `npm run ledger`) and run `npm run bootstrap`.

**After you change a Daml contract** (`exodus-contract/main`):

```bash
npm run codegen:daml   # rebuild the DAR and the TypeScript types
```

Then restart the ledger, run `npm run bootstrap`, and restart `npm run api` and `npm run web`.

---

## 6. Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| "Cannot reach the Exodus server" | The API is not running | Terminal 3: `npm run api` |
| Price feed **Paused**, or "No valid USYC price" | The oracle bot is stopped, so the last price expired (30 s) | Terminal 2: `npm run oracle` (or `oracle:hold`) |
| "The ledger is not set up yet. Run `npm run bootstrap`" | The ledger was restarted and is empty | `npm run bootstrap` |
| "Could not set up the wallet on the ledger" when approving | The ledger is down or still starting | Check terminal 1, wait, click Approve again (safe to repeat) |
| "Too many attempts. Please wait a minute" | Login is limited to 5 tries per minute per IP (sign-up: 10 per hour) | Wait one minute |
| "You already used the faucet" | 24 h cooldown per client | Wait, or set `FAUCET_COOLDOWN_HOURS=0` in `api/.env` and restart the API |
| A redeem stays under **Pending redeems** | The fund pays only with a valid price, so the oracle bot is probably stopped (the API log says "Redeem settlement skipped: No valid USYC price") | Start `npm run oracle`; the request is paid within 2 s. Or click **Cancel** to get the USYC back |
| "The receiver is not an approved Exodus client" | Tokens only move between approved clients (both need an access pass) | Send to an approved client's party id |
| API stops at start with "Invalid environment variables" | A value in `api/.env` is missing or wrong | Compare with `api/.env.example`; the message names the variable |
| API error "Can't reach database server" | Postgres is not running | `npm run db:up` |
| `npm run db:up` fails: port 5432 already in use | Another PostgreSQL runs on your machine | In `api/docker-compose.yml` change `"5432:5432"` to `"5433:5432"`, and in `api/.env` use `localhost:5433` in `DATABASE_URL` |
| "Port 7575 / 3000 / 5173 already in use" | That program is already running (maybe in another terminal) | Stop the old one (Ctrl+C) or reuse it |
| `npm install` fails on `@daml.js/...` | The generated Daml types are missing | `npm run codegen:daml`, then `npm install` |
| The chart shows "The chart fills in as the oracle publishes new prices" | Fewer than 2 prices recorded yet | Keep `npm run oracle` running for a few seconds |

---

## 7. Handy commands

| Command | What it does |
|---|---|
| `npm test` | Run the off-ledger unit tests (ledger helpers, API, web); no sandbox or database needed |
| `npm run typecheck` | Type-check all packages |
| `npm run lint -w @exodus/web` | Lint the web app |
| `cd ../exodus-contract/test && dpm test` | Run the Daml contract tests |
| `npm run oracle:once` | Move the demo clock one step (7 days) and exit |
| `npm run demo:markets` | Run the whole markets story (spec section 9: buy PT, claim, mature, redeem) through `@exodus/ledger` and check every amount. **Needs a fresh sandbox** (restart `npm run ledger`, then `npm run bootstrap`; `npm run oracle` stopped). It moves the demo clock to maturity, so restart the ledger again afterwards |
| http://localhost:3000/api/docs | Swagger: try every API endpoint |
| `npm run db:migrate:dev -w @exodus/api -- --name what_changed` | Create a migration after editing `api/prisma/schema.prisma` |
