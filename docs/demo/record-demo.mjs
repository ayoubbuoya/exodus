// Records the 3-minute demo (script.md) as silent screen recordings, one clip
// per scene, and takes the README screenshots on the way.
//
// Run it against a FRESH demo stack (the clock must be on Oct 1 2026):
//
//   docker compose down && docker compose up --build -d     # from the repo root
//   cd docs/demo && npm i --no-save playwright-core && npx playwright-core install chromium
//   node record-demo.mjs
//
// Options (environment variables):
//   WEB_URL         the web app, default http://localhost:8080 (Docker demo)
//   ADMIN_EMAIL     default admin@exodus.local (the Docker demo's admin)
//   ADMIN_PASSWORD  default exodus-demo-admin
//   CHROME_PATH     a Chromium to use instead of Playwright's own download
//
// Output: recordings/NN-scene.webm (1280x720) and ../images/*.png.
// Clips may start or end with a few still seconds (waiting for a bot): trim
// them when you edit. "USYC" and "USDC" are simulated tokens, not Circle's.
import { mkdirSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const WEB = process.env.WEB_URL ?? 'http://localhost:8080'
const ADMIN = {
  email: process.env.ADMIN_EMAIL ?? 'admin@exodus.local',
  password: process.env.ADMIN_PASSWORD ?? 'exodus-demo-admin',
}
// A new client each run, so the script can be re-run on the same stack for the screenshots.
const ALICE = { email: `alice-${Date.now()}@demo.test`, password: 'alice-demo-password' }
const MARKET = 'PT-USYC-APR2027'
const SIZE = { width: 1280, height: 720 }

const RECORDINGS = new URL('./recordings/', import.meta.url)
const IMAGES = new URL('../images/', import.meta.url)
mkdirSync(RECORDINGS, { recursive: true })
// A file URL as a path for this OS. (URL.pathname gives "/C:/…" on Windows,
// which Node reads as "C:\C:\…".)
const pathOf = (url) => fileURLToPath(url)

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, slowMo: 120 })
const pause = (page, ms = 1500) => page.waitForTimeout(ms)

// Saved logins (cookies), so each person logs in only once: the API limits
// login attempts per minute.
const logins = {}

// A browser session, recording video when `scene` is given. `who` reuses a
// saved login ("alice" or "admin").
async function session(scene, who) {
  const context = await browser.newContext({
    viewport: SIZE,
    storageState: who === undefined ? undefined : logins[who],
    recordVideo: scene === undefined ? undefined : { dir: pathOf(RECORDINGS), size: SIZE },
  })
  const page = await context.newPage()
  return { context, page, scene }
}

// Closes a session; its video is saved as recordings/<scene>.webm.
async function finish(recorded) {
  const video = recorded.page.video()
  await recorded.context.close()
  if (video !== null && recorded.scene !== undefined) {
    renameSync(await video.path(), pathOf(new URL(`${recorded.scene}.webm`, RECORDINGS)))
    console.log(`recorded ${recorded.scene}.webm`)
  }
}

// Calls the API with this session's cookies (same origin as the web app).
async function api(page, method, path, body) {
  const response = await page.request.fetch(`${WEB}/api${path}`, { method, data: body })
  const json = await response.json()
  if (!response.ok()) {
    throw new Error(`${method} ${path}: ${json.message}`)
  }
  return json.data
}

const screenshot = (page, name) => page.screenshot({ path: pathOf(new URL(`${name}.png`, IMAGES)) })

// Publishes a price as the Oracle on /lab (the demo clock jumps to that date).
async function publishPrice(page, index, date) {
  await page.goto(`${WEB}/lab`)
  await page.getByRole('tab', { name: 'Oracle' }).click()
  await page.getByLabel('New index').fill(index)
  await page.getByLabel('New demo date').fill(date)
  await pause(page, 800)
  await page.getByRole('button', { name: 'Publish' }).click()
  await page.getByText(date.slice(0, 4)).first().waitFor()
  await pause(page, 2000)
}

// ---------------------------------------------------------------------------
// Off camera: Alice signs up, is approved, and gets 1000 test USDC.
// ---------------------------------------------------------------------------
const alice = await session()
await api(alice.page, 'POST', '/auth/signup', ALICE)
await api(alice.page, 'PUT', '/applications/me', { fullName: 'Alice Demo', country: 'FR', acceptsSimulatedTokens: true })
const admin = await session()
await api(admin.page, 'POST', '/auth/login', ADMIN)
const pending = await api(admin.page, 'GET', '/admin/applications?status=PENDING')
await api(admin.page, 'POST', `/admin/applications/${pending.items.find((item) => item.user.email === ALICE.email).id}/approval`)
await api(alice.page, 'POST', '/wallet/faucet-claims')
logins.alice = await alice.context.storageState()
logins.admin = await admin.context.storageState()
await finish(alice)
await finish(admin)
console.log(`Alice is ${ALICE.email}`)

// 01: the landing page.
const intro = await session('01-landing')
await intro.page.goto(WEB)
await pause(intro.page, 4000)
await finish(intro)

// 02: Alice opens Markets and the market.
const aliceSession = await session('02-markets', 'alice')
await aliceSession.page.goto(`${WEB}/markets`)
await aliceSession.page.getByText(MARKET).first().waitFor()
await pause(aliceSession.page, 3000)
await screenshot(aliceSession.page, 'markets')
await finish(aliceSession)

// 03: the admin's dealer desk: Bank holds 1000 PT and 1000 YT.
const desk = await session('03-dealer', 'admin')
await desk.page.goto(`${WEB}/dealer`)
await desk.page.getByRole('button', { name: "Claim Bank's yield" }).waitFor()
await pause(desk.page, 3500)
await finish(desk)

// 04: Alice asks for a firm quote on 500 PT (this clip also holds the accept, scene 06).
const trade = await session('04-quote-and-accept', 'alice')
await trade.page.goto(`${WEB}/markets/${MARKET}`)
await trade.page.getByLabel('You buy').pressSequentially('500', { delay: 150 })
await pause(trade.page, 2000)
await trade.page.getByRole('button', { name: 'Get firm quote' }).click()
// The firm quote is a <section aria-label="Firm quote">; bring it into view
// (the trade widget is taller than the 720 px window).
const quoteCard = trade.page.getByRole('region', { name: 'Firm quote' })
await quoteCard.waitFor({ timeout: 20000 })
await quoteCard.scrollIntoViewIfNeeded()
await pause(trade.page, 3000)
await screenshot(trade.page, 'quote')

// 05: privacy while the quote is live: the Operator sees 0 Quote, Bank sees 1.
const privacy = await session('05-privacy', 'admin')
await privacy.page.goto(`${WEB}/lab`)
await privacy.page.getByRole('tab', { name: 'Operator' }).click()
await privacy.page.getByText(/^Markets:/).waitFor()
await pause(privacy.page, 3500)
await screenshot(privacy.page, 'lab-privacy')
await privacy.page.getByRole('tab', { name: 'Bank' }).click()
await pause(privacy.page, 3500)
await finish(privacy)

// 06 (in clip 04): Alice accepts; one transaction moves both legs.
await trade.page.getByRole('button', { name: 'Accept' }).click()
await trade.page.locator('[data-sonner-toast]').filter({ hasText: 'Bought' }).waitFor()
await pause(trade.page, 3000)
await trade.page.goto(`${WEB}/portfolio`)
await trade.page.getByText('Market activity').waitFor()
await pause(trade.page, 3000)
await screenshot(trade.page, 'portfolio')
await finish(trade)

// 07: three months later: Bank claims its yield from the desk.
const january = await session('07-january-claim', 'admin')
await publishPrice(january.page, '1.025', '2027-01-01')
await january.page.goto(`${WEB}/dealer`)
await january.page.getByRole('button', { name: "Claim Bank's yield" }).click()
await pause(january.page, 5000)
await screenshot(january.page, 'dealer')
await finish(january)

// 08: maturity: the Operator bot matures the market by itself.
const april = await session('08-maturity', 'admin')
await publishPrice(april.page, '1.05', '2027-04-01')
await april.page.goto(`${WEB}/markets/${MARKET}`)
await april.page.getByText('Matured', { exact: true }).first().waitFor({ timeout: 20000 })
await pause(april.page, 3000)
await finish(april)

// 09: Alice redeems her PT and looks at her activity.
const redeem = await session('09-redeem', 'alice')
await redeem.page.goto(`${WEB}/markets/${MARKET}`)
await redeem.page.getByRole('button', { name: 'Redeem PT' }).waitFor()
await pause(redeem.page, 2500)
await redeem.page.getByRole('button', { name: 'Redeem PT' }).click()
await pause(redeem.page, 4000)
await redeem.page.goto(`${WEB}/app`)
await redeem.page.getByText('Activity', { exact: true }).waitFor()
await pause(redeem.page, 4000)
await finish(redeem)

await browser.close()
console.log('Done: recordings/ and ../images/')
