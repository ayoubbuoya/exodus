import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // tailwindcss() turns the Tailwind classes we use into CSS (Tailwind v4 needs no config file).
  plugins: [react(), tailwindcss()],
  resolve: {
    // "@/..." points to "src/...", the same alias as in tsconfig.app.json.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    // The browser calls /v2/... and /api/... on this dev server, and Vite forwards
    // them. Same origin for the browser, so no CORS setup and the API's session
    // cookie just works.
    // - /v2: the Canton JSON Ledger API, used directly by the developer lab (/lab).
    // - /api: our NestJS backend (exodus-app/api), used by the client app.
    //   xfwd adds X-Forwarded-For, so the API rate-limits by the real client IP.
    // Point them elsewhere with LEDGER_URL / API_URL, for example to run a
    // second copy of Exodus next to your usual one.
    proxy: {
      '/v2': process.env.LEDGER_URL ?? 'http://localhost:7575',
      '/api': { target: process.env.API_URL ?? 'http://localhost:3000', xfwd: true },
    },
  },
  optimizeDeps: {
    // The Daml codegen packages are CommonJS and linked through npm workspaces.
    // Vite only converts linked packages to ES modules when we list them here.
    include: [
      '@daml.js/exodus-contract-main-0.0.1',
      '@daml.js/splice-api-token-holding-v1-1.0.0',
      '@daml.js/splice-api-token-metadata-v1-1.0.0',
      '@daml.js/splice-api-token-transfer-instruction-v1-1.0.0',
    ],
  },
})
