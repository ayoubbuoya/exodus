// The test USDC faucet: an approved client gets FAUCET_AMOUNT (100) simulated
// USDC, at most once per FAUCET_COOLDOWN_HOURS (24).
//
// The rule is checked here, off-ledger: the backend mints as UsdcIssuer only
// if the database says the cooldown has passed. (The client's approval is
// checked by ApprovedClientGuard before we get here.)
import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Holding } from "@exodus/ledger";
import type { ClientWallet } from "../common/request-context.ts";
import type { EnvironmentVariables } from "../config/environment.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { PrismaService } from "../prisma/prisma.service.ts";
import { toHttpError } from "../ledger/ledger-errors.ts";

const MS_PER_HOUR = 60 * 60 * 1000;

export type FaucetClaimResult = {
  amount: string;
  instrument: "USDC";
  nextClaimAt: Date;
};

@Injectable()
export class FaucetService {
  private readonly logger = new Logger(FaucetService.name);
  private readonly amount: string;
  private readonly cooldownMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.amount = config.get("FAUCET_AMOUNT", { infer: true });
    this.cooldownMs = config.get("FAUCET_COOLDOWN_HOURS", { infer: true }) * MS_PER_HOUR;
  }

  // When this client may use the faucet again; null means "now".
  async getNextClaimAt(userId: string): Promise<Date | null> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { lastFaucetAt: true } });
    return this.nextClaimAfter(user.lastFaucetAt);
  }

  async claim(wallet: ClientWallet): Promise<FaucetClaimResult> {
    const now = new Date();
    const previousClaimAt = await this.reserveClaim(wallet.userId, now);
    try {
      await this.mintUsdc(wallet.partyId);
    } catch (error) {
      // The mint failed, so the claim does not count: give the old time back.
      await this.prisma.user.updateMany({
        where: { id: wallet.userId, lastFaucetAt: now },
        data: { lastFaucetAt: previousClaimAt },
      });
      throw toHttpError(error, "Faucet mint", this.logger);
    }

    await this.prisma.faucetClaim.create({ data: { userId: wallet.userId, amount: this.amount } });
    this.logger.log(`Faucet: ${this.amount} USDC to user ${wallet.userId}`);
    return { amount: this.amount, instrument: "USDC", nextClaimAt: new Date(now.getTime() + this.cooldownMs) };
  }

  // Marks "claimed at `now`" ONLY if the cooldown has passed, in one SQL UPDATE.
  // Why one statement: if Alice double-clicks, two requests arrive together.
  // A "read, then write" would let both see "cooldown passed" and mint twice.
  // With a conditional UPDATE, PostgreSQL runs them one after the other: the
  // first changes the row, the second then finds lastFaucetAt = now and changes nothing.
  // Returns the previous claim time (to undo the reservation if minting fails).
  private async reserveClaim(userId: string, now: Date): Promise<Date | null> {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { lastFaucetAt: true } });
    const cooldownStartedBefore = new Date(now.getTime() - this.cooldownMs);
    const reserved = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [{ lastFaucetAt: null }, { lastFaucetAt: { lte: cooldownStartedBefore } }],
      },
      data: { lastFaucetAt: now },
    });
    if (reserved.count === 0) {
      const nextClaimAt = await this.getNextClaimAt(userId);
      throw new HttpException(
        `You already used the faucet. Next claim: ${nextClaimAt?.toISOString() ?? "now"}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return before.lastFaucetAt;
  }

  // New USDC is created by its issuer (the Holding's signatory), so we act as UsdcIssuer.
  private async mintUsdc(owner: string): Promise<void> {
    const parties = await this.ledger.getDemoParties();
    await this.ledger.backendLedger.create(parties.UsdcIssuer, Holding, {
      issuer: parties.UsdcIssuer,
      owner,
      instrument: "USDC",
      amount: this.amount,
    });
  }

  private nextClaimAfter(lastClaimAt: Date | null): Date | null {
    if (lastClaimAt === null) {
      return null;
    }
    const next = new Date(lastClaimAt.getTime() + this.cooldownMs);
    return next.getTime() <= Date.now() ? null : next;
  }
}
