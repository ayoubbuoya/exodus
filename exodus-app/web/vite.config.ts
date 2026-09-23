import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The browser calls /v2/... on this dev server, and Vite forwards it to the
    // Canton JSON Ledger API. Same origin for the browser, so no CORS setup.
    proxy: {
      '/v2': 'http://localhost:7575',
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
