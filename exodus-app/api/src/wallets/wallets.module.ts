import { Module } from "@nestjs/common";
import { ApprovedClientGuard } from "./approved-client.guard.ts";
import { FaucetService } from "./faucet.service.ts";
import { WalletProvisioningService } from "./wallet-provisioning.service.ts";
import { WalletReconcilerService } from "./wallet-reconciler.service.ts";
import { WalletController } from "./wallet.controller.ts";
import { WalletService } from "./wallet.service.ts";

// WalletProvisioningService is exported for the admin's Approve button.
@Module({
  controllers: [WalletController],
  providers: [WalletService, FaucetService, WalletProvisioningService, WalletReconcilerService, ApprovedClientGuard],
  exports: [WalletProvisioningService],
})
export class WalletsModule {}
