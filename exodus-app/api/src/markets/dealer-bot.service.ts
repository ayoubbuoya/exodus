// The house dealer bot (decision D2): answers RFQs sent to Bank within
// seconds, so a client never waits for a person.
//
// Every DEALER_POLL_SECONDS it:
//   1. cleans up: withdraws Bank's expired quotes and unlocks their PT
//      (Quote_Withdraw + PT_Unlock in one ledger transaction);
//   2. if auto-quote is on, answers each open RFQ, oldest first:
//      - declines it when it is over the size limit or the market has
//        reached maturity, or when Bank cannot fill it (not enough free PT
//        to sell, or free USDC to buy with);
//      - otherwise quotes the dealer's price (Pendle's formula, see
//        dealer-pricing.ts), firm for the configured number of seconds.
// With auto-quote off, RFQs wait for an admin on the dealer desk.
//
// Example: Alice asks to buy 500 PT on Oct 1. The bot quotes 0.975503
// (5.1 % fixed, the 5.2 % target minus the 0.10 % spread), valid 60 s.
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { decimalToUnits, withdrawExpiredQuotes, yearsBetween, type Contract, type RfqRequest } from "@exodus/ledger";
import type { EnvironmentVariables } from "../config/environment.ts";
import { isUserMessageError } from "../ledger/ledger-errors.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { priceForSide } from "./dealer-pricing.ts";
import { DealerDeskService } from "./dealer-desk.service.ts";
import { DealerSettingsService, type DealerSettingsView } from "./dealer-settings.service.ts";
import { MarketPricingService, type PricingContext } from "./market-pricing.service.ts";

const JOB_NAME = "dealer-bot";

@Injectable()
export class DealerBotService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DealerBotService.name);
  private readonly intervalMs: number;
  private isRunning = false;
  // Warnings already logged, so a stopped oracle gives one line, not one a second.
  private loggedWarnings = new Set<string>();

  constructor(
    private readonly ledger: LedgerService,
    private readonly desk: DealerDeskService,
    private readonly settings: DealerSettingsService,
    private readonly pricing: MarketPricingService,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs = config.get("DEALER_POLL_SECONDS", { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    const timer = setInterval(() => void this.tick(), this.intervalMs);
    this.scheduler.addInterval(JOB_NAME, timer);
  }

  async tick(): Promise<void> {
    // Skip if the previous tick is still busy: two runs at once would quote
    // the same RFQ twice and pick the same PT.
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    const warnings: string[] = [];
    try {
      await this.withdrawExpired();
      await this.answerOpenRequests(warnings);
    } catch (error) {
      warnings.push(`Dealer bot skipped a tick: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
    this.logWarningsOnce(warnings);
  }

  private async withdrawExpired(): Promise<void> {
    const report = await withdrawExpiredQuotes(this.ledger.backendLedger, await this.desk.dealerParty());
    if (report.withdrawnQuotes > 0 || report.unlockedPts > 0) {
      this.logger.log(`Withdrew ${report.withdrawnQuotes} expired quote(s), unlocked ${report.unlockedPts} PT piece(s)`);
    }
  }

  private async answerOpenRequests(warnings: string[]): Promise<void> {
    const settings = await this.settings.get();
    if (!settings.autoQuote) {
      return;
    }
    const requests = await this.desk.readOpenRequests();
    if (requests.length === 0) {
      return;
    }
    const context = await this.pricing.readContext();
    if (!context.isLive) {
      warnings.push("Dealer bot is waiting for a live USYC price (is the oracle bot running?)");
      return;
    }
    for (const request of requests) {
      await this.answer(request, settings, context, warnings);
    }
  }

  private async answer(
    request: Contract<RfqRequest>,
    settings: DealerSettingsView,
    context: PricingContext,
    warnings: string[],
  ): Promise<void> {
    const { side, ptAmount, terms } = request.payload;
    const label = `${side} ${ptAmount} PT of ${terms.marketId}`;
    const refusal = reasonToDecline(request, settings, context);
    if (refusal !== null) {
      await this.decline(request, label, refusal);
      return;
    }
    const price = priceForSide(this.pricing.pricesFor(context, terms.maturity), side);
    try {
      await this.desk.quote(request.contractId, price);
      this.logger.log(`Quoted ${label} at ${price}`);
    } catch (error) {
      // Our own clear messages ("Not enough free PT ...") mean Bank cannot
      // fill it: say no, so the client is not left waiting. Anything else (a
      // busy ledger) is tried again on the next tick.
      if (isUserMessageError(error)) {
        await this.decline(request, label, error.message);
      } else {
        warnings.push(`Could not quote ${label} yet: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async decline(request: Contract<RfqRequest>, label: string, reason: string): Promise<void> {
    await this.desk.decline(request.contractId);
    this.logger.log(`Declined ${label}: ${reason}`);
  }

  private logWarningsOnce(warnings: string[]): void {
    for (const warning of warnings) {
      if (!this.loggedWarnings.has(warning)) {
        this.logger.warn(warning);
      }
    }
    this.loggedWarnings = new Set(warnings);
  }
}

// Why the bot says no before trying, or null to go ahead.
// Examples: 5000 PT with a 1000 limit -> "over the size limit of 1000 PT";
// an RFQ on Apr 1 -> "the market has reached maturity".
function reasonToDecline(request: Contract<RfqRequest>, settings: DealerSettingsView, context: PricingContext): string | null {
  if (decimalToUnits(request.payload.ptAmount) > decimalToUnits(settings.maxPtPerQuote)) {
    return `over the size limit of ${Number(settings.maxPtPerQuote)} PT`;
  }
  if (yearsBetween(context.simTime, request.payload.terms.maturity) <= 0) {
    return "the market has reached maturity";
  }
  return null;
}
