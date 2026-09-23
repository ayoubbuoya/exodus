// What an approved client can do with their custodial wallet: see balances,
// subscribe USDC into USYC, and send tokens to another approved client.
//
// Each command is sent with the client's own ledger user (LedgerService.clientFor)
// and reuses the same @exodus/ledger helpers as the /lab page, including the
// explicit disclosure of the fund, price snapshot, factory and receiver's pass.
import { Injectable, Logger } from "@nestjs/common";
import {
  decimalToUnits,
  getOwnedHoldings,
  sendHoldings,
  subscribeUsyc,
  unitsToDecimal,
} from "@exodus/ledger";
import type { ClientWallet } from "../common/request-context.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import type { SubscribeDto, TransferDto } from "./dto/wallet-commands.dto.ts";
import { FaucetService } from "./faucet.service.ts";
import { toWalletError } from "./wallet-errors.ts";

export type WalletOverview = {
  partyId: string;
  // Total per instrument, for example { "USDC": "600.0", "USYC": "487.804878" }.
  balances: Record<string, string>;
  // Every holding contract (a balance can be split over several).
  holdings: { contractId: string; instrument: string; amount: string }[];
  // null = the faucet can be used now.
  nextFaucetClaimAt: Date | null;
};

// `retried` is true when the first try hit a stale contract and the second worked.
export type SubscribeResult = { usdcAmount: string; retried: boolean };

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly faucet: FaucetService,
  ) {}

  async getOverview(wallet: ClientWallet): Promise<WalletOverview> {
    const holdings = await this.readHoldings(wallet);
    return {
      partyId: wallet.partyId,
      balances: sumByInstrument(holdings),
      holdings,
      nextFaucetClaimAt: await this.faucet.getNextClaimAt(wallet.userId),
    };
  }

  // The client's holdings, read through the CIP-56 Holding interface (as /lab does).
  private async readHoldings(wallet: ClientWallet): Promise<WalletOverview["holdings"]> {
    try {
      const owned = await getOwnedHoldings(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId);
      return owned.map((holding) => ({
        contractId: holding.contractId,
        instrument: holding.payload.instrumentId.id,
        amount: holding.payload.amount,
      }));
    } catch (error) {
      throw toWalletError(error, "Reading holdings", this.logger);
    }
  }

  // Alice pays 500 USDC and gets 500 / index USYC, in one atomic ledger transaction.
  async subscribe(wallet: ClientWallet, dto: SubscribeDto): Promise<SubscribeResult> {
    const parties = await this.ledger.getDemoParties();
    try {
      const outcome = await subscribeUsyc(this.ledger.clientFor(wallet.ledgerUserId), {
        subscriber: wallet.partyId,
        usycIssuer: parties.UsycIssuer,
        usdcAmount: dto.usdcAmount,
      });
      this.logger.log(`User ${wallet.userId} subscribed ${dto.usdcAmount} USDC`);
      return { usdcAmount: dto.usdcAmount, retried: outcome.retried };
    } catch (error) {
      throw toWalletError(error, "Subscribe", this.logger);
    }
  }

  // Alice sends 50 USYC to Bob. The transfer factory checks both access passes on-ledger.
  async transfer(wallet: ClientWallet, dto: TransferDto): Promise<TransferDto> {
    try {
      await sendHoldings(this.ledger.clientFor(wallet.ledgerUserId), {
        sender: wallet.partyId,
        receiver: dto.receiverPartyId,
        instrument: dto.instrument,
        amount: dto.amount,
      });
      this.logger.log(`User ${wallet.userId} sent ${dto.amount} ${dto.instrument}`);
      return dto;
    } catch (error) {
      throw toWalletError(error, "Transfer", this.logger);
    }
  }
}

// Adds up amounts per instrument with exact integer maths (no float rounding):
// [USDC 100, USDC 0.5, USYC 10] -> { USDC: "100.5", USYC: "10" }
function sumByInstrument(holdings: { instrument: string; amount: string }[]): Record<string, string> {
  const totals = new Map<string, bigint>();
  for (const holding of holdings) {
    const current = totals.get(holding.instrument) ?? 0n;
    totals.set(holding.instrument, current + decimalToUnits(holding.amount));
  }
  const balances: Record<string, string> = {};
  for (const [instrument, units] of totals) {
    balances[instrument] = unitsToDecimal(units);
  }
  return balances;
}
