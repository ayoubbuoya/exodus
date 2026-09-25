// What every markets screen and bot needs to know about "now": the USYC
// price and demo date, the underlying APY, the dealer's settings, and from
// those the dealer's PT prices for a market (decision D5: an indicative price
// from the house dealer's settings; real quotes stay private on the ledger).
import { Injectable } from "@nestjs/common";
import { yearsBetween } from "@exodus/ledger";
import { PricesService } from "../prices/prices.service.ts";
import { dealerPrices, targetApyPercent, type DealerPrices } from "./dealer-pricing.ts";
import { DealerSettingsService, type DealerSettingsView } from "./dealer-settings.service.ts";

export type PricingContext = {
  index: string; // the newest USYC price, for example "1.0250000000"
  simTime: string; // its demo date, for example "2027-01-01T00:00:00Z"
  isLive: boolean; // false when the oracle bot is stopped (the snapshot expired)
  underlyingApyPercent: number | null; // 30-day APY; null in the first 7 demo days
  settings: DealerSettingsView;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class MarketPricingService {
  constructor(
    private readonly prices: PricesService,
    private readonly dealerSettings: DealerSettingsService,
  ) {}

  // Reads the price (from the ledger) and the settings (from the database).
  // Throws the prices service's HTTP error when no price exists yet.
  async readContext(): Promise<PricingContext> {
    const latest = await this.prices.getLatest();
    return {
      index: latest.index,
      simTime: latest.simTime,
      isLive: latest.isLive,
      underlyingApyPercent: latest.apy30dPercent,
      settings: await this.dealerSettings.get(),
    };
  }

  // The dealer's prices for a market maturing at `maturity` (demo clock).
  // Example on Oct 1 with no history yet: target 5.2 % -> ask 0.975503, bid 0.974577.
  pricesFor(context: PricingContext, maturity: string): DealerPrices {
    const target = targetApyPercent(context.underlyingApyPercent, context.settings);
    return dealerPrices(target, context.settings.spreadPercent, yearsBetween(context.simTime, maturity));
  }
}

// Whole demo days from `simTime` to `maturity`, never below 0.
// Example: Jan 1 2027 -> Apr 1 2027 = 90.
export function daysBetween(simTime: string, maturity: string): number {
  const days = (Date.parse(maturity) - Date.parse(simTime)) / MS_PER_DAY;
  return Math.max(0, Math.ceil(days));
}
