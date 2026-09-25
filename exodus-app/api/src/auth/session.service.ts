// Login sessions stored in the database.
//
// How it works, with Alice:
// 1. She logs in. We make a random token, for example "q8Zk...43 chars", put it
//    in her httpOnly cookie, and store only sha256(token) in `sessions`.
// 2. On every request SessionGuard hashes the cookie again and looks the hash up.
// 3. Logging out deletes the row, so the cookie stops working at once.
//
// Why hash it: if the database leaks, the hashes cannot be turned back into cookies.
// Why not a JWT: a JWT stays valid until it expires; a row can be deleted any time.
import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthUser } from "../common/request-context.ts";
import type { EnvironmentVariables } from "../config/environment.ts";
import { PrismaService } from "../prisma/prisma.service.ts";

// 32 random bytes = 256 bits: impossible to guess.
const SESSION_TOKEN_BYTES = 32;
const MS_PER_HOUR = 60 * 60 * 1000;

export type NewSession = {
  token: string;
  expiresAt: Date;
};

@Injectable()
export class SessionService {
  private readonly sessionTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.sessionTtlMs = config.get("SESSION_TTL_HOURS", { infer: true }) * MS_PER_HOUR;
  }

  // Starts a session for this user. Returns the raw token for the cookie (never stored).
  async createSession(userId: string): Promise<NewSession> {
    const token = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    await this.prisma.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });
    // Housekeeping: drop this user's old expired sessions so the table does not grow forever.
    await this.prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
    return { token, expiresAt };
  }

  // The user behind a cookie token, or null if the token is unknown or expired.
  async findUserBySessionToken(token: string): Promise<AuthUser | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        expiresAt: true,
        user: { select: { id: true, email: true, role: true } },
      },
    });
    if (session === null || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session.user;
  }

  // Logout. deleteMany (not delete) so an unknown token is not an error.
  async deleteSession(token: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
