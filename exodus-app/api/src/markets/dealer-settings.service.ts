// The house dealer's quoting settings (DealerSettings table): auto-quote on or
// off, how the target APY is found, the spread, the size limit and how long a
// quote stays firm. Admins change them on the dealer desk.
import { Injectable } from "@nestjs/common";
import type { DemoPartyName } from "@exodus/ledger";
import { PrismaService } from "../prisma/prisma.service.ts";
import type { UpdateDealerSettingsDto } from "./dto/dealer.dto.ts";

// The demo's only dealer (decision D2): Bank, run by the platform.
export const HOUSE_DEALER: DemoPartyName = "Bank";

// The settings as the API shows them. Percentages are numbers (5.2 = 5.2 %);
// the PT size limit stays an exact decimal string, like every token amount.
export type DealerSettingsView = {
  dealerName: string;
  autoQuote: boolean;
  apyOffsetPercent: number;
  fallbackApyPercent: number;
  spreadPercent: number;
  maxPtPerQuote: string;
  quoteValidSeconds: number;
  updatedAt: Date;
};

const SETTINGS_SELECT = {
  dealerName: true,
  autoQuote: true,
  apyOffsetPercent: true,
  fallbackApyPercent: true,
  spreadPercent: true,
  maxPtPerQuote: true,
  quoteValidSeconds: true,
  updatedAt: true,
} as const;

@Injectable()
export class DealerSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // The house dealer's settings. The row is created with the schema's
  // defaults the first time (upsert), so a fresh database needs no seed.
  async get(): Promise<DealerSettingsView> {
    const row = await this.prisma.dealerSettings.upsert({
      where: { dealerName: HOUSE_DEALER },
      create: { dealerName: HOUSE_DEALER },
      update: {},
      select: SETTINGS_SELECT,
    });
    return toView(row);
  }

  // Replaces the settings with the admin's values (PUT: every field is sent).
  async update(dto: UpdateDealerSettingsDto): Promise<DealerSettingsView> {
    const values = {
      autoQuote: dto.autoQuote,
      apyOffsetPercent: dto.apyOffsetPercent,
      fallbackApyPercent: dto.fallbackApyPercent,
      spreadPercent: dto.spreadPercent,
      maxPtPerQuote: dto.maxPtPerQuote,
      quoteValidSeconds: dto.quoteValidSeconds,
    };
    const row = await this.prisma.dealerSettings.upsert({
      where: { dealerName: HOUSE_DEALER },
      create: { dealerName: HOUSE_DEALER, ...values },
      update: values,
      select: SETTINGS_SELECT,
    });
    return toView(row);
  }
}

// Prisma returns Decimal columns as Decimal objects; the API sends numbers
// for percentages and an exact string for the PT limit.
type SettingsRow = {
  dealerName: string;
  autoQuote: boolean;
  apyOffsetPercent: { toNumber(): number };
  fallbackApyPercent: { toNumber(): number };
  spreadPercent: { toNumber(): number };
  maxPtPerQuote: { toFixed(decimals: number): string };
  quoteValidSeconds: number;
  updatedAt: Date;
};

function toView(row: SettingsRow): DealerSettingsView {
  return {
    dealerName: row.dealerName,
    autoQuote: row.autoQuote,
    apyOffsetPercent: row.apyOffsetPercent.toNumber(),
    fallbackApyPercent: row.fallbackApyPercent.toNumber(),
    spreadPercent: row.spreadPercent.toNumber(),
    maxPtPerQuote: row.maxPtPerQuote.toFixed(10),
    quoteValidSeconds: row.quoteValidSeconds,
    updatedAt: row.updatedAt,
  };
}
