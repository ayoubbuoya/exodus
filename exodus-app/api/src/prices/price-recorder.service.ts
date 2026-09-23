// Records the USYC price history for the dashboard chart.
//
// The ledger only keeps the newest price snapshots (old ones expire and are
// archived), so nobody can ask it "what was the price last month?". Every
// PRICE_POLL_SECONDS we read the newest RateIndex and store it when it changed.
// Example: the bot publishes 1.0 (Oct 1), heartbeats 1.0 ten times, then 1.0048
// (Oct 8): we store two rows, not twelve.
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { getRateIndex } from "@exodus/ledger";
import type { EnvironmentVariables } from "../config/environment.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { PrismaService } from "../prisma/prisma.service.ts";

const JOB_NAME = "price-recorder";

@Injectable()
export class PriceRecorderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PriceRecorderService.name);
  private readonly intervalMs: number;
  // "simTime|index" of the last stored point: skips the database while nothing changes.
  private lastRecordedKey = "";
  private isRunning = false;
  // So a stopped sandbox gives one warning, not one every 5 seconds.
  private lastWarning = "";

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs = config.get("PRICE_POLL_SECONDS", { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    // The interval comes from config, so we register it here instead of using @Interval(5000).
    const timer = setInterval(() => void this.recordLatestPrice(), this.intervalMs);
    this.scheduler.addInterval(JOB_NAME, timer);
  }

  async recordLatestPrice(): Promise<void> {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.readAndStore();
      this.lastWarning = "";
    } catch (error) {
      this.warnOnce(`Price not recorded: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async readAndStore(): Promise<void> {
    const parties = await this.ledger.getDemoParties();
    // UsycIssuer is the reader of the price snapshots (the fund prices subscriptions with them).
    const snapshot = await getRateIndex(this.ledger.backendLedger, parties.UsycIssuer);
    if (snapshot === null) {
      return;
    }
    const { instrument, index, simTime, publishedAt } = snapshot.payload;
    const key = `${instrument}|${simTime}|${index}`;
    if (key === this.lastRecordedKey) {
      return;
    }
    // skipDuplicates: after an API restart the first point is usually already stored.
    await this.prisma.pricePoint.createMany({
      data: [{ instrument, index, simTime: new Date(simTime), publishedAt: new Date(publishedAt) }],
      skipDuplicates: true,
    });
    this.lastRecordedKey = key;
  }

  private warnOnce(message: string): void {
    if (message !== this.lastWarning) {
      this.logger.warn(message);
      this.lastWarning = message;
    }
  }
}
