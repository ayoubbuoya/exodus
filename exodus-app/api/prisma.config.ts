// Prisma CLI settings (Prisma 7 reads the database URL from here, not from schema.prisma).
// Used by `prisma generate` and `prisma migrate`. The running API builds its own
// connection in src/prisma/prisma.service.ts.
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads .env by itself. Node 24 can: load it when it exists
// (in CI the variables may come from the environment instead).
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: rely on the real environment variables.
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
