/** Render an SVG to a transparent PNG using the installed Chrome browser. */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const [sourceArg, outputArg, widthArg, heightArg] = process.argv.slice(2)
if (!sourceArg || !outputArg || !widthArg || !heightArg) {
  throw new Error('Usage: node render_svg_chrome.mjs input.svg output.png width height')
}

const source = resolve(sourceArg)
const output = resolve(outputArg)
const width = Number(widthArg)
const height = Number(heightArg)
const chromePath = process.env.EXODUS_CHROME_PATH ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

if (!existsSync(source) || !existsSync(chromePath)) {
  throw new Error('SVG source or Chrome executable is missing')
}

if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
  throw new Error('Width and height must be positive integers')
}

// A fresh profile exposes one private DevTools port without touching the user's browser.
const profile = mkdtempSync(join(tmpdir(), 'exodus-brand-chrome-'))
const browser = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--hide-scrollbars',
  '--remote-debugging-port=0',
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  pathToFileURL(source).href,
], { stdio: 'ignore', windowsHide: true })

/** Wait briefly for Chrome's DevToolsActivePort file. */
async function readPort() {
  const portFile = join(profile, 'DevToolsActivePort')
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (existsSync(portFile)) {
      return Number(readFileSync(portFile, 'utf8').split('\n')[0])
    }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error('Chrome did not open a DevTools port')
}

/** Connect to the page and return a small request helper for Chrome DevTools. */
async function connect(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`)
  const targets = await response.json()
  const page = targets.find((target) => target.type === 'page')
  if (!page) throw new Error('Chrome did not create a page target')

  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((done, reject) => {
    socket.addEventListener('open', done, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 1
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id) return
    const handlers = pending.get(message.id)
    if (!handlers) return
    pending.delete(message.id)
    if (message.error) handlers.reject(new Error(message.error.message))
    else handlers.resolve(message.result)
  })

  /** Send one CDP request and match its response by id. */
  function send(method, params = {}) {
    const id = nextId++
    return new Promise((resolveResult, reject) => {
      pending.set(id, { resolve: resolveResult, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }

  return { socket, send }
}

/** Capture an alpha-backed PNG so the exact vector paths remain reusable. */
async function main() {
  const port = await readPort()
  const { socket, send } = await connect(port)
  try {
    await send('Page.enable')
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: false,
    })
    await send('Emulation.setDefaultBackgroundColorOverride', {
      color: { r: 0, g: 0, b: 0, a: 0 },
    })
    await send('Page.reload', { ignoreCache: true })
    await new Promise((done) => setTimeout(done, 500))
    const result = await send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
    })
    writeFileSync(output, Buffer.from(result.data, 'base64'))
    console.log(output)
    await send('Browser.close')
  } finally {
    socket.close()
  }
}

try {
  await main()
} finally {
  if (browser.exitCode === null) browser.kill()
  await new Promise((done) => {
    if (browser.exitCode !== null) done()
    else {
      browser.once('exit', done)
      setTimeout(done, 3000)
    }
  })
  const allowedParent = resolve(tmpdir()) + sep
  if (resolve(profile).startsWith(allowedParent) && dirname(profile) === resolve(tmpdir())) {
    // Windows can keep a Chrome profile file locked briefly after the browser exits.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(profile, { recursive: true, force: true })
        break
      } catch (error) {
        if (attempt === 4) console.warn(`Could not remove temporary Chrome profile: ${error.message}`)
        else await new Promise((done) => setTimeout(done, 200))
      }
    }
  }
}
