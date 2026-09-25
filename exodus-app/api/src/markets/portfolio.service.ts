// The client's markets portfolio: PT and YT per market, what the YT can
// claim, the USD value (Pendle style: YT price = 1 - PT price), and the open
// payout requests (claim, PT redeem, merge) the Operator's bot has not paid yet.
//
// The fund's USYC/USDC wallet is a separate page (/api/wallet); this is only
// the market tokens.
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  cancelClaim,
  cancelMerge,
  cancelPtRedeem,
  decimalToUnits,
  getClaimRequests,
  getMarketPositions,
  getMarkets,
  getMaturitySnapshot,
  getMergeRequests,
  getPtRedeemRequests,
  previewClaim,
  previewMerge,
  previewPtRedeem,
  unitsToDecimal,
  type LedgerClient,
  type MarketPosition,
  type MarketRequestKind,
} from "@exodus/ledger";
import type { ClientWallet } from "../common/request-context.ts";
import { toHttpError } from "../ledger/ledger-errors.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { MarketPricingService, type PricingContext } from "./market-pricing.service.ts";
import { positionUsdValue, type PositionValue } from "./portfolio-value.ts";

// One market in the portfolio. Example for Bank on Jan 1:
//   { marketId: "PT-USYC-APR2027", ptTotal: "500", ptLocked: "0", ytTotal: "1000",
//     claimableUsyc: "24.390243", ptPrice: "0.975039",
//     value: { ptUsd: 487.52, ytUsd: 24.96, claimableUsd: 25, totalUsd: 537.48 } }
export type PortfolioPosition = {
  marketId: string;
  symbols: { pt: string; yt: string };
  matured: boolean;
  ptTotal: string;
  ptLocked: string; // reserved for a live quote (a dealer's PT); cannot be used
  ptFree: string;
  ytTotal: string;
  // Each YT piece with the index its yield is paid up to. A merge pays
  // amount / lastIndex, so the web app needs it for an exact preview.
  // Example: [{ amount: "1000.0000000000", lastIndex: "1.0250000000" }]
  ytPieces: { amount: string; lastIndex: string }[];
  claimableUsyc: string; // what a claim would pay now
  index: string; // the USYC price used for claimableUsyc (the maturity index once matured)
  ptPrice: string; // the dealer's mid price, "1" after maturity
  value: PositionValue;
};

// One open payout request. `estimatedUsyc` is what the bot would pay at
// today's price (a merge needs no price: amount / lastIndex).
export type OpenMarketRequest = {
  requestId: string;
  kind: MarketRequestKind; // "CLAIM" | "PT_REDEEM" | "MERGE"
  marketId: string;
  amount: string; // YT for a claim, PT for a redeem, PT and YT each for a merge
  estimatedUsyc: string;
  requestedAt: string;
};

export type Portfolio = {
  positions: PortfolioPosition[];
  openRequests: OpenMarketRequest[];
  totalUsd: number;
};

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly pricing: MarketPricingService,
  ) {}

  async getPortfolio(wallet: ClientWallet): Promise<Portfolio> {
    const context = await this.pricing.readContext();
    try {
      const client = this.ledger.clientFor(wallet.ledgerUserId);
      const maturityIndexes = await this.readMaturityIndexes();
      const positions = (await getMarketPositions(client, wallet.partyId)).map((position) =>
        this.toPosition(position, context, maturityIndexes.get(position.terms.marketId) ?? null),
      );
      const openRequests = await this.readOpenRequests(client, wallet.partyId, context.index);
      const totalUsd = positions.reduce((sum, position) => sum + position.value.totalUsd, 0);
      return { positions, openRequests, totalUsd: Math.round(totalUsd * 100) / 100 };
    } catch (error) {
      throw toHttpError(error, "Reading the portfolio", this.logger);
    }
  }

  // marketId -> frozen index, for the matured markets only.
  // Example: { "PT-USYC-APR2027" => "1.0500000000" } after Apr 1.
  private async readMaturityIndexes(): Promise<Map<string, string>> {
    const parties = await this.ledger.getDemoParties();
    const indexes = new Map<string, string>();
    for (const market of await getMarkets(this.ledger.backendLedger, parties.Operator)) {
      if (!market.payload.matured) {
        continue;
      }
      const marketId = market.payload.terms.marketId;
      const snapshot = await getMaturitySnapshot(this.ledger.backendLedger, parties.Operator, marketId);
      if (snapshot !== null) {
        indexes.set(marketId, snapshot.payload.index);
      }
    }
    return indexes;
  }

  // After maturity a YT only earns up to the maturity index, and a PT is
  // worth 1 USD; before it, both use today's price.
  private toPosition(position: MarketPosition, context: PricingContext, maturityIndex: string | null): PortfolioPosition {
    const matured = maturityIndex !== null;
    const index = maturityIndex ?? context.index;
    const ptPrice = matured ? "1" : this.pricing.pricesFor(context, position.terms.maturity).midPrice;
    const claimableUsyc = sumClaimable(position, index);
    return {
      marketId: position.terms.marketId,
      symbols: position.symbols,
      matured,
      ptTotal: position.ptTotal,
      ptLocked: position.ptLocked,
      ptFree: position.ptFree,
      ytTotal: position.ytTotal,
      ytPieces: position.ytPieces.map((piece) => ({ amount: piece.payload.amount, lastIndex: piece.payload.lastIndex })),
      claimableUsyc,
      index,
      ptPrice,
      value: positionUsdValue({
        ptAmount: position.ptTotal,
        ytAmount: position.ytTotal,
        claimableUsyc,
        // The claim is paid in USYC, worth today's price in USD.
        index: context.index,
        ptPrice,
      }),
    };
  }

  // The client's open claims, PT redeems and merges, oldest first.
  private async readOpenRequests(client: LedgerClient, party: string, index: string): Promise<OpenMarketRequest[]> {
    const requests: OpenMarketRequest[] = [];
    for (const claim of await getClaimRequests(client, party)) {
      const { terms, amount, lastIndex, requestedAt } = claim.payload;
      requests.push({
        requestId: claim.contractId,
        kind: "CLAIM",
        marketId: terms.marketId,
        amount,
        estimatedUsyc: previewClaim(amount, lastIndex, index),
        requestedAt,
      });
    }
    for (const redeem of await getPtRedeemRequests(client, party)) {
      const { terms, ptAmount, requestedAt } = redeem.payload;
      requests.push({
        requestId: redeem.contractId,
        kind: "PT_REDEEM",
        marketId: terms.marketId,
        amount: ptAmount,
        estimatedUsyc: previewPtRedeem(ptAmount, index),
        requestedAt,
      });
    }
    for (const merge of await getMergeRequests(client, party)) {
      const { terms, amount, lastIndex, requestedAt } = merge.payload;
      requests.push({
        requestId: merge.contractId,
        kind: "MERGE",
        marketId: terms.marketId,
        amount,
        estimatedUsyc: previewMerge(amount, lastIndex),
        requestedAt,
      });
    }
    requests.sort((a, b) => Date.parse(a.requestedAt) - Date.parse(b.requestedAt));
    return requests;
  }

  // Cancels one of the client's open requests (any kind) and gives the
  // tokens back. 404 if it is not theirs or was already paid.
  async cancelRequest(wallet: ClientWallet, requestId: string): Promise<{ requestId: string; kind: MarketRequestKind }> {
    const client = this.ledger.clientFor(wallet.ledgerUserId);
    const kind = await this.findRequestKind(client, wallet.partyId, requestId);
    if (kind === null) {
      throw new NotFoundException("No open request with this id. It may already be paid or cancelled.");
    }
    try {
      if (kind === "CLAIM") {
        await cancelClaim(client, wallet.partyId, requestId);
      } else if (kind === "PT_REDEEM") {
        await cancelPtRedeem(client, wallet.partyId, requestId);
      } else {
        await cancelMerge(client, wallet.partyId, requestId);
      }
      this.logger.log(`User ${wallet.userId} cancelled a ${kind} request`);
      return { requestId, kind };
    } catch (error) {
      throw toHttpError(error, "Cancelling a request", this.logger);
    }
  }

  // Which kind of request `requestId` is among the client's own open
  // requests, or null. The ledger only shows a client its own requests.
  private async findRequestKind(client: LedgerClient, party: string, requestId: string): Promise<MarketRequestKind | null> {
    try {
      const isIn = (requests: { contractId: string }[]) => requests.some((request) => request.contractId === requestId);
      if (isIn(await getClaimRequests(client, party))) {
        return "CLAIM";
      }
      if (isIn(await getPtRedeemRequests(client, party))) {
        return "PT_REDEEM";
      }
      if (isIn(await getMergeRequests(client, party))) {
        return "MERGE";
      }
      return null;
    } catch (error) {
      throw toHttpError(error, "Reading open requests", this.logger);
    }
  }
}

// What all YT pieces of a position could claim at `index`, added up exactly.
// Each piece is claimed on its own (its own lastIndex) and rounded down on
// its own, like the contract does.
function sumClaimable(position: MarketPosition, index: string): string {
  let totalUnits = 0n;
  for (const piece of position.ytPieces) {
    totalUnits += decimalToUnits(previewClaim(piece.payload.amount, piece.payload.lastIndex, index));
  }
  return unitsToDecimal(totalUnits);
}
