// Sets up an approved client's custodial Canton wallet. Used by the admin's
// "Approve" button and by the WalletReconciler after a sandbox restart.
//
// For Alice (user id 7f3a9c21-e4b0-...), it makes sure these exist on the ledger:
//   1. a party        "client-7f3a9c21e4b0::1220ab..."
//   2. a ledger user  "client-7f3a9c21e4b0" that may act and read as that party
//   3. her ClientAccess pass, signed by the Operator, with both issuers as observers
//
// Why "client-<id>" and not "alice-martin": other parties see party ids (for
// example when she sends USYC to Bob), so a name in the id would leak who she is.
//
// Every step first looks for what is already there, so calling this twice is
// safe. If the ledger fails after step 1, the admin simply clicks Approve again.
// This service only touches the ledger; callers save the result in the database.
import { ConflictException, HttpException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ClientAccess, getClientAccess, partyName, type DemoParties } from "@exodus/ledger";
import { LedgerService } from "../ledger/ledger.service.ts";

export type ProvisionedWallet = {
  partyId: string;
  ledgerUserId: string;
  accessContractId: string;
};

// Party hint and ledger user id for a user: "client-" + first 12 hex digits of the user id.
// Example: "7f3a9c21-e4b0-4c1d-..." -> "client-7f3a9c21e4b0".
export function walletNameFor(userId: string): string {
  return `client-${userId.replaceAll("-", "").slice(0, 12)}`;
}

@Injectable()
export class WalletProvisioningService {
  private readonly logger = new Logger(WalletProvisioningService.name);

  // Users whose wallet is being set up right now. Stops a double click on
  // Approve (or the reconciler running at the same moment) from creating two
  // passes. Enough for one API process; several processes would need a DB lock.
  private readonly inProgress = new Set<string>();

  constructor(private readonly ledger: LedgerService) {}

  async provision(userId: string): Promise<ProvisionedWallet> {
    if (this.inProgress.has(userId)) {
      throw new ConflictException("This wallet is already being set up. Try again in a few seconds.");
    }
    this.inProgress.add(userId);
    try {
      return await this.provisionOnLedger(userId);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Wallet setup failed for user ${userId}`, error instanceof Error ? error.stack : String(error));
      throw new ServiceUnavailableException("Could not set up the wallet on the ledger. Is the sandbox running?");
    } finally {
      this.inProgress.delete(userId);
    }
  }

  private async provisionOnLedger(userId: string): Promise<ProvisionedWallet> {
    const parties = await this.ledger.getDemoParties();
    const walletName = walletNameFor(userId);

    const partyId = await this.findOrAllocateParty(walletName);
    await this.ledger.backendLedger.ensureUserForParty(walletName, partyId);
    const accessContractId = await this.findOrCreateAccessPass(parties, partyId);

    this.logger.log(`Wallet ready for user ${userId}: party ${partyId}`);
    return { partyId, ledgerUserId: walletName, accessContractId };
  }

  private async findOrAllocateParty(walletName: string): Promise<string> {
    const knownParties = await this.ledger.backendLedger.listParties();
    const existing = knownParties.find((partyId) => partyName(partyId) === walletName);
    if (existing !== undefined) {
      return existing;
    }
    return this.ledger.backendLedger.allocateParty(walletName);
  }

  // The pass is the client's on-ledger whitelist entry. The issuers observe it
  // because their transfer factories check the RECEIVER's pass too.
  private async findOrCreateAccessPass(parties: DemoParties, client: string): Promise<string> {
    const existing = await getClientAccess(this.ledger.backendLedger, parties.Operator, client);
    if (existing !== null) {
      return existing.contractId;
    }

    await this.ledger.backendLedger.create(parties.Operator, ClientAccess, {
      operator: parties.Operator,
      client,
      issuers: [parties.UsycIssuer, parties.UsdcIssuer],
    });
    // create() does not return the new contract id, so read it back.
    const created = await getClientAccess(this.ledger.backendLedger, parties.Operator, client);
    if (created === null) {
      throw new Error(`Access pass for ${client} was created but cannot be found`);
    }
    return created.contractId;
  }
}
