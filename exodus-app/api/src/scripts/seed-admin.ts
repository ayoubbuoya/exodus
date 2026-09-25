// Creates (or updates) the first admin account from ADMIN_EMAIL and ADMIN_PASSWORD.
// Run it with `npm run db:seed` after `npm run db:migrate`. Running it again
// resets that admin's password to the one in .env.
//
// Only an admin can approve access applications, and nobody can sign up as an
// admin through the API, so this script is the one way to get the first one.
import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";
import { PrismaClient, Role } from "../generated/prisma/client.ts";

const MIN_ADMIN_PASSWORD_LENGTH = 10;

function readRequired(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`${name} is not set. Add it to exodus-app/api/.env (see .env.example).`);
  }
  return value.trim();
}

async function main(): Promise<void> {
  try {
    process.loadEnvFile(".env");
  } catch {
    // No .env file: use the real environment variables.
  }

  const email = readRequired("ADMIN_EMAIL").toLowerCase();
  const password = readRequired("ADMIN_PASSWORD");
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD needs at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: readRequired("DATABASE_URL") }) });
  try {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const admin = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, role: Role.ADMIN },
      update: { passwordHash, role: Role.ADMIN },
      select: { id: true, email: true },
    });
    console.log(`Admin ready: ${admin.email} (${admin.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seeding the admin failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
