// Reads the USYC price: the live snapshot from the ledger (price strip) and
// the stored history (chart and APY).
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { daysToMaturity, getRateIndex, isRateValid } from "@exodus/ledger";
import { LedgerService } from "../ledger/ledger.service.ts";
import { PrismaService } from "../prisma/prisma.service.ts";
import { toHttpError } from "../ledger/ledger-errors.ts";

// One chart point, for example { index: "1.0250000000", simTime: 2027-01-01, publishedAt: ... }.
// `index` stays a string: it is an exact decimal, and a JS number could round it.
export type PricePointView = {
  index: string;
  simTime: Date;
  publishedAt: Date;
};

// The price strip: the newest snapshot plus what we derive from it.
export type LatestPriceView = {
  index: string;
  simTime: string; // the demo date of this price
  publishedAt: string;
  // After this (real) time the fund no longer accepts this snapshot.
  validUntil: string;
  // false when the oracle bot is stopped: Subscribe would fail with "No valid USYC price".
  isLive: boolean;
  daysToMaturity: number;
  // Annualised growth over the last 30 demo days, in percent (10.31 = 10.31 %); null until we have enough history.
  apy30dPercent: number | null;
};

// Daml Decimals have 10 decimals; we show the same form the ledger uses.
const INDEX_DECIMALS = 10;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const APY_WINDOW_DAYS = 30;
// Below this span the annualised number jumps around too much to be useful.
const MIN_APY_SPAN_DAYS = 7;

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  async getLatest(): Promise<LatestPriceView> {
    const snapshot = await this.readLatestSnapshot();
    const { index, simTime, publishedAt, validUntil } = snapshot;
    return {
      index,
      simTime,
      publishedAt,
      validUntil,
      isLive: isRateValid(snapshot, 0),
      daysToMaturity: daysToMaturity(simTime),
      apy30dPercent: await this.computeApy30d(index, new Date(simTime)),
    };
  }

  // Read as UsycIssuer, the reader of the price snapshots.
  private async readLatestSnapshot() {
    try {
      const parties = await this.ledger.getDemoParties();
      const snapshot = await getRateIndex(this.ledger.backendLedger, parties.UsycIssuer);
      if (snapshot === null) {
        throw new NotFoundException("No USYC price has been published yet. Run `npm run bootstrap`.");
      }
      return snapshot.payload;
    } catch (error) {
      throw toHttpError(error, "Reading the USYC price", this.logger);
    }
  }

  // APY from the last 30 demo days, annualised with compounding:
  //   apy = (indexNow / indexThen) ^ (365 / days) - 1
  // Example: 1.0125 on Nov 15 and 1.0043 on Oct 16 (30 days):
  //   (1.0125 / 1.0043) ^ (365 / 30) - 1 = 0.1036 -> 10.36 %
  // We take the newest stored point that is at least 30 days older; early in
  // the demo (less than 30 days of history) we use the oldest point instead.
  private async computeApy30d(indexNow: string, simTimeNow: Date): Promise<number | null> {
    const windowStart = new Date(simTimeNow.getTime() - APY_WINDOW_DAYS * MS_PER_DAY);
    const reference =
      (await this.findPoint({ lte: windowStart }, "desc")) ?? (await this.findPoint({ lt: simTimeNow }, "asc"));
    if (reference === null) {
      return null;
    }
    const days = (simTimeNow.getTime() - reference.simTime.getTime()) / MS_PER_DAY;
    if (days < MIN_APY_SPAN_DAYS) {
      return null;
    }
    // Number is fine here: the result is only displayed, never used for money.
    const growth = Number(indexNow) / reference.index.toNumber();
    const apy = Math.pow(growth, 365 / days) - 1;
    return Math.round(apy * 10_000) / 100;
  }

  private async findPoint(simTime: { lte?: Date; lt?: Date }, order: "asc" | "desc") {
    return this.prisma.pricePoint.findFirst({
      where: { instrument: "USYC", simTime },
      select: { index: true, simTime: true },
      orderBy: { simTime: order },
    });
  }

  async getHistory(instrument: string, limit: number): Promise<{ instrument: string; points: PricePointView[] }> {
    // Take the newest `limit` points, then flip them so the chart reads left to right.
    const newestFirst = await this.prisma.pricePoint.findMany({
      where: { instrument },
      select: { index: true, simTime: true, publishedAt: true },
      orderBy: [{ simTime: "desc" }, { publishedAt: "desc" }],
      take: limit,
    });
    const points = newestFirst.reverse().map((point) => ({
      index: point.index.toFixed(INDEX_DECIMALS),
      simTime: point.simTime,
      publishedAt: point.publishedAt,
    }));
    return { instrument, points };
  }
}
