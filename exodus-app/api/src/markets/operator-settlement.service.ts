// The Operator's bot for the markets: matures markets and pays PT/YT payouts
// from the Operator's USYC vault (spec sections 8.3 to 8.6).
//
// Every MARKET_SETTLE_SECONDS it calls settleMarketRequests (@exodus/ledger), which:
//   1. matures every market whose date the demo clock has reached, with the
//      first price on or after maturity (decision Q1, spec gap 3);
//   2. pays open claims, PT redeems and merges, oldest first:
//        Jan 1: Bank's claim on 1000 YT at 1.025 -> 24.390243 USYC
//        Apr 1: Alice's 500 PT at 1.05           -> 476.190476 USYC
//
// Why a loop and not "pay right away"? Only this job spends the vault, one
// payout after the other, so two payouts never fight over the same vault
// holding (UTXO contention), and clients never see the vault. Same pattern as
// the fund's RedeemSettlementService.
//
// A request that cannot be paid now stays open (the next tick tries again),
// and its owner can cancel it.
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { formatAmount, settleMarketRequests } from "@exodus/ledger";
import type { EnvironmentVariables } from "../config/environment.ts";
import { LedgerService } from "../ledger/ledger.service.ts";

const JOB_NAME = "market-settlement";

@Injectable()
export class OperatorSettlementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OperatorSettlementService.name);
  private readonly intervalMs: number;
  private isRunning = false;
  // Warnings already logged, so a stopped oracle gives one line, not one every 2 s.
  private loggedWarnings = new Set<string>();

  constructor(
    private readonly ledger: LedgerService,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs = config.get("MARKET_SETTLE_SECONDS", { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    const timer = setInterval(() => void this.tick(), this.intervalMs);
    this.scheduler.addInterval(JOB_NAME, timer);
  }

  async tick(): Promise<void> {
    // Skip if the previous tick is still busy: two runs at once would pick
    // the same vault holding and one payout would fail.
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    const warnings: string[] = [];
    try {
      const parties = await this.ledger.getDemoParties();
      // The backend's own ledger user acts as the Operator.
      const report = await settleMarketRequests(this.ledger.backendLedger, parties.Operator);
      for (const matured of report.matured) {
        this.logger.log(`Market ${matured.marketId} matured at index ${formatAmount(matured.index, 10)}`);
      }
      for (const paid of report.settled) {
        this.logger.log(`${paid.kind} of ${paid.marketId} settled: ${formatAmount(paid.usycPaid)} USYC to ${paid.owner}`);
      }
      for (const skipped of report.skipped) {
        warnings.push(`${skipped.kind} ${skipped.requestId.slice(0, 12)}... not settled yet: ${skipped.reason}`);
      }
    } catch (error) {
      warnings.push(`Market settlement skipped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
    this.logWarningsOnce(warnings);
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
