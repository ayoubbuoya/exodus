// Reads the stored USYC price history for the chart.
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.ts";

// One chart point, for example { index: "1.0250000000", simTime: 2027-01-01, publishedAt: ... }.
// `index` stays a string: it is an exact decimal, and a JS number could round it.
export type PricePointView = {
  index: string;
  simTime: Date;
  publishedAt: Date;
};

// Daml Decimals have 10 decimals; we show the same form the ledger uses.
const INDEX_DECIMALS = 10;

@Injectable()
export class PricesService {
  constructor(private readonly prisma: PrismaService) {}

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
