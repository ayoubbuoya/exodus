// Keeps client wallets working when the Canton sandbox restarts.
//
// The sandbox keeps everything in memory. After a restart (and `npm run
// bootstrap`), Alice's party "client-7f3a9c21e4b0::1220ab..." no longer exists,
// but our database still points to it. Every WALLET_CHECK_SECONDS this job
// finds such wallets and sets them up again (new party, new pass).
// Alice keeps her account; her balances start again from 0, so we also reset
// her faucet cooldown.
import { Injectable, Logger, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SchedulerRegistry } from "@nestjs/schedule";
import type { EnvironmentVariables } from "../config/environment.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { PrismaService } from "../prisma/prisma.service.ts";
import { WalletProvisioningService } from "./wallet-provisioning.service.ts";

const JOB_NAME = "wallet-reconciler";

type StoredWallet = { id: string; userId: string; partyId: string };

@Injectable()
export class WalletReconcilerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(WalletReconcilerService.name);
  private readonly intervalMs: number;
  private isRunning = false;
  // The last warning we logged, so a stopped sandbox gives one line, not one every 30 s.
  private lastWarning = "";

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly provisioning: WalletProvisioningService,
    private readonly scheduler: SchedulerRegistry,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.intervalMs = config.get("WALLET_CHECK_SECONDS", { infer: true }) * 1000;
  }

  onApplicationBootstrap(): void {
    // The interval comes from config, so we register it here instead of using @Interval(30000).
    const timer = setInterval(() => void this.checkWallets(), this.intervalMs);
    this.scheduler.addInterval(JOB_NAME, timer);
    void this.checkWallets();
  }

  async checkWallets(): Promise<void> {
    // Skip a tick if the previous one is still busy (re-provisioning can take a few seconds).
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      await this.reprovisionMissingWallets();
      this.lastWarning = "";
    } catch (error) {
      this.warnOnce(`Wallet check skipped: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async reprovisionMissingWallets(): Promise<void> {
    const wallets = await this.prisma.wallet.findMany({ select: { id: true, userId: true, partyId: true } });
    if (wallets.length === 0) {
      return;
    }
    const knownParties = new Set(await this.ledger.backendLedger.listParties());
    const missing = wallets.filter((wallet) => !knownParties.has(wallet.partyId));
    if (missing.length === 0) {
      return;
    }

    // The platform party ids changed too, so do not use the cached ones.
    this.ledger.forgetDemoParties();
    this.logger.warn(`${missing.length} wallet(s) point to parties the ledger does not know (sandbox restart?)`);
    for (const wallet of missing) {
      await this.reprovision(wallet);
    }
  }

  private async reprovision(wallet: StoredWallet): Promise<void> {
    const provisioned = await this.provisioning.provision(wallet.userId);
    await this.prisma.$transaction([
      this.prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          partyId: provisioned.partyId,
          ledgerUserId: provisioned.ledgerUserId,
          accessContractId: provisioned.accessContractId,
        },
      }),
      // New, empty wallet: let the client use the faucet right away.
      this.prisma.user.update({ where: { id: wallet.userId }, data: { lastFaucetAt: null } }),
    ]);
    this.logger.log(`Re-provisioned wallet of user ${wallet.userId}: ${wallet.partyId} -> ${provisioned.partyId}`);
  }

  private warnOnce(message: string): void {
    if (message !== this.lastWarning) {
      this.logger.warn(message);
      this.lastWarning = message;
    }
  }
}
