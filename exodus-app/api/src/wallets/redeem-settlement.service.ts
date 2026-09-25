// The fund's settlement loop: pays open USYC redeem requests (spec gap 13).
//
// When Alice redeems 100 USYC, her USYC is burned and a UsycRedeemRequest is
// created (see requestUsycRedeem in @exodus/ledger). Every REDEEM_SETTLE_SECONDS
// this job acts as the fund (UsycIssuer) and pays each open request in USDC
// at the price of that moment: at index 1.03, 100 USYC -> 103 USDC.
//
// Why a loop and not "pay right away in Alice's request"? Only this job spends
// the fund's USDC, one request after the other, so two clients redeeming at
// the same moment never fight over the same fund holding, and clients never
// see the fund's cash balance.
//
// If a request cannot be paid (for example the fund is short), it stays open:
// we try again on the next tick, and Alice can cancel it to get her USYC back.
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import { formatAmount, settleUsycRedeems } from "@exodus/ledger";
import type { EnvironmentVariables } from "../config/environment.ts";
import { LedgerService } from "../ledger/ledger.service.ts";

const JOB_NAME = "redeem-settlement";

@Injectable()
export class RedeemSettlementService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedeemSettlementService.name);
  private readonly intervalMs: number;
  private isRunning = false;
  // Warnings we already logged, so a stopped oracle or a short fund gives one
  // line, not one every 2 seconds. Cleared after a tick without warnings.
  private loggedWarnings = new Set<string>();

  constructor(
    private readonly ledger: LedgerService,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs = config.get("REDEEM_SETTLE_SECONDS", { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    // The interval comes from config, so we register it here instead of using @Interval(2000).
    const timer = setInterval(() => void this.settleOpenRequests(), this.intervalMs);
    this.scheduler.addInterval(JOB_NAME, timer);
  }

  async settleOpenRequests(): Promise<void> {
    // Skip a tick if the previous one is still busy: two runs at once would
    // pick the same fund USDC holding and one of them would fail.
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    const warnings: string[] = [];
    try {
      const parties = await this.ledger.getDemoParties();
      // The backend's own ledger user acts as UsycIssuer, like the faucet acts as UsdcIssuer.
      const report = await settleUsycRedeems(this.ledger.backendLedger, parties.UsycIssuer);
      for (const paid of report.settled) {
        this.logger.log(
          `Redeem settled: ${formatAmount(paid.usycAmount)} USYC -> ${formatAmount(paid.usdcAmount)} USDC ` +
            `at index ${formatAmount(paid.index, 10)} for ${paid.owner}`,
        );
      }
      for (const skipped of report.skipped) {
        warnings.push(`Redeem ${skipped.requestId.slice(0, 12)}... not settled yet: ${skipped.reason}`);
      }
    } catch (error) {
      warnings.push(`Redeem settlement skipped: ${error instanceof Error ? error.message : String(error)}`);
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
