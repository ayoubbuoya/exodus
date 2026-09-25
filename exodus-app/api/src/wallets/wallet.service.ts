// What an approved client can do with their custodial wallet: see balances,
// subscribe USDC into USYC, redeem USYC back into USDC, and send tokens to
// another approved client.
//
// Each command is sent with the client's own ledger user (LedgerService.clientFor)
// and reuses the same @exodus/ledger helpers as the /lab page, including the
// explicit disclosure of the fund, price snapshot, factory and receiver's pass.
import { Injectable, Logger } from "@nestjs/common";
import {
  cancelUsycRedeem,
  decimalToUnits,
  getHoldingActivity,
  getOwnedHoldings,
  getRedeemRequests,
  requestUsycRedeem,
  type ActivityRow,
  sendHoldings,
  subscribeUsyc,
  unitsToDecimal,
} from "@exodus/ledger";
import type { ClientWallet } from "../common/request-context.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import type { RedeemDto, SubscribeDto, TransferDto } from "./dto/wallet-commands.dto.ts";
import { FaucetService } from "./faucet.service.ts";
import { toHttpError } from "../ledger/ledger-errors.ts";

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

// A redeem request was accepted: the USYC is burned, the USDC follows when
// the fund settles (every few seconds).
export type RedeemResult = { usycAmount: string; retried: boolean };

// One of the client's open redeem requests, for the "Pending" list.
// Example: { requestId: "00d1...", usycAmount: "100.0000000000", requestedAt: "2026-09-25T10:00:00Z" }
export type OpenRedemption = { requestId: string; usycAmount: string; requestedAt: string };

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

  // The client's recent token movements, newest first, rebuilt from the ledger
  // history (see getHoldingActivity in @exodus/ledger). Includes tokens other
  // clients sent to them, which our own database would not know about.
  async getActivity(wallet: ClientWallet, limit: number): Promise<ActivityRow[]> {
    try {
      return await getHoldingActivity(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId, limit);
    } catch (error) {
      throw toHttpError(error, "Reading activity", this.logger);
    }
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
      throw toHttpError(error, "Reading holdings", this.logger);
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
      throw toHttpError(error, "Subscribe", this.logger);
    }
  }

  // Alice redeems 100 USYC: burned now, paid in USDC by the fund's settlement
  // loop (RedeemSettlementService) at the price of that moment.
  async requestRedeem(wallet: ClientWallet, dto: RedeemDto): Promise<RedeemResult> {
    const parties = await this.ledger.getDemoParties();
    try {
      const outcome = await requestUsycRedeem(this.ledger.clientFor(wallet.ledgerUserId), {
        redeemer: wallet.partyId,
        usycIssuer: parties.UsycIssuer,
        usycAmount: dto.usycAmount,
      });
      this.logger.log(`User ${wallet.userId} requested a redeem of ${dto.usycAmount} USYC`);
      return { usycAmount: dto.usycAmount, retried: outcome.retried };
    } catch (error) {
      throw toHttpError(error, "Redeem request", this.logger);
    }
  }

  // The client's redeem requests the fund has not paid yet, oldest first.
  async listOpenRedemptions(wallet: ClientWallet): Promise<OpenRedemption[]> {
    try {
      const requests = await getRedeemRequests(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId);
      return requests.map((request) => ({
        requestId: request.contractId,
        usycAmount: request.payload.usycAmount,
        requestedAt: request.payload.requestedAt,
      }));
    } catch (error) {
      throw toHttpError(error, "Reading redeem requests", this.logger);
    }
  }

  // Alice cancels an open request and gets her USYC back. Fails with 422 if
  // the fund has already paid it.
  async cancelRedeem(wallet: ClientWallet, requestId: string): Promise<{ requestId: string }> {
    try {
      await cancelUsycRedeem(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId, requestId);
      this.logger.log(`User ${wallet.userId} cancelled redeem request ${requestId.slice(0, 12)}...`);
      return { requestId };
    } catch (error) {
      throw toHttpError(error, "Redeem cancel", this.logger);
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
      throw toHttpError(error, "Transfer", this.logger);
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
