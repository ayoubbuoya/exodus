// Private PT trading for approved clients: ask the house dealer (Bank) for a
// price (RFQ), see the firm quote, accept it (atomic DvP) or reject it.
//
// Example: Alice asks to buy 500 PT. Within about 2 s the dealer bot answers
// with a quote (0.975503, 487.751500 USDC, valid 60 s). Alice accepts: in ONE
// ledger transaction her USDC goes to Bank and the 500 PT to her. The
// Operator never sees the price (spec section 10).
import { Injectable, Logger } from "@nestjs/common";
import {
  acceptQuote,
  cancelRfq,
  getQuotes,
  getRfqRequests,
  isQuoteLive,
  rejectQuote,
  requestQuote,
  yearsBetween,
  type Contract,
  type Quote,
  type RfqRequest,
  type RfqSide,
} from "@exodus/ledger";
import type { ClientWallet } from "../common/request-context.ts";
import { toHttpError } from "../ledger/ledger-errors.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { fixedApyPercent } from "./dealer-pricing.ts";
import { HOUSE_DEALER } from "./dealer-settings.service.ts";
import type { CreateQuoteRequestDto } from "./dto/trading.dto.ts";
import { MarketPricingService } from "./market-pricing.service.ts";

// A request the dealer has not answered yet.
export type QuoteRequestView = {
  requestId: string;
  marketId: string;
  side: RfqSide;
  ptAmount: string;
  requestedAt: string;
};

// A firm quote. Example:
//   { quoteId: "00ab...", marketId: "PT-USYC-APR2027", side: "BuyPt", ptAmount: "500",
//     price: "0.975503", usdcAmount: "487.7515", validUntil: "...", isLive: true, fixedApyPercent: 5.1 }
export type QuoteView = {
  quoteId: string;
  marketId: string;
  side: RfqSide;
  ptAmount: string;
  price: string; // USDC per PT
  usdcAmount: string; // what changes hands: roundDown6 (price * ptAmount)
  validUntil: string;
  isLive: boolean; // false once expired: accept would fail
  fixedApyPercent: number | null; // the fixed APY of this price, from today's demo date
};

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly pricing: MarketPricingService,
  ) {}

  // Alice asks the house dealer for a price. The dealer bot answers within a
  // few seconds; the quote then shows in GET /api/quotes.
  async createRequest(wallet: ClientWallet, dto: CreateQuoteRequestDto): Promise<CreateQuoteRequestDto> {
    const parties = await this.ledger.getDemoParties();
    try {
      await requestQuote(this.ledger.clientFor(wallet.ledgerUserId), {
        requester: wallet.partyId,
        dealer: parties[HOUSE_DEALER],
        operator: parties.Operator,
        usdcIssuer: parties.UsdcIssuer,
        marketId: dto.marketId,
        side: dto.side,
        ptAmount: dto.ptAmount,
      });
      this.logger.log(`User ${wallet.userId} asked for a quote: ${dto.side} ${dto.ptAmount} PT of ${dto.marketId}`);
      return dto;
    } catch (error) {
      throw toHttpError(error, "Quote request", this.logger);
    }
  }

  // The client's requests still waiting for an answer, oldest first.
  async listRequests(wallet: ClientWallet): Promise<QuoteRequestView[]> {
    try {
      const requests = await getRfqRequests(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId);
      return requests.filter((request) => request.payload.requester === wallet.partyId).map(toRequestView);
    } catch (error) {
      throw toHttpError(error, "Reading quote requests", this.logger);
    }
  }

  async cancelRequest(wallet: ClientWallet, requestId: string): Promise<{ requestId: string }> {
    try {
      await cancelRfq(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId, requestId);
      return { requestId };
    } catch (error) {
      throw toHttpError(error, "Cancelling a quote request", this.logger);
    }
  }

  // The client's quotes, soonest expiry first. Expired ones stay listed (with
  // isLive = false) until the dealer bot withdraws them, a second or two later.
  async listQuotes(wallet: ClientWallet): Promise<QuoteView[]> {
    const context = await this.pricing.readContext();
    try {
      const quotes = await getQuotes(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId);
      return quotes
        .filter((quote) => quote.payload.requester === wallet.partyId)
        .map((quote) => toQuoteView(quote, yearsBetween(context.simTime, quote.payload.terms.maturity)));
    } catch (error) {
      throw toHttpError(error, "Reading quotes", this.logger);
    }
  }

  // Atomic DvP: both legs move in one ledger transaction, or nothing moves.
  async accept(wallet: ClientWallet, quoteId: string): Promise<{ quoteId: string; retried: boolean }> {
    try {
      const outcome = await acceptQuote(this.ledger.clientFor(wallet.ledgerUserId), {
        requester: wallet.partyId,
        quoteId,
      });
      this.logger.log(`User ${wallet.userId} accepted a quote`);
      return { quoteId, retried: outcome.retried };
    } catch (error) {
      throw toHttpError(error, "Accepting a quote", this.logger);
    }
  }

  // Before expiry, a buy quote's locked PT goes back to the dealer at once.
  async reject(wallet: ClientWallet, quoteId: string): Promise<{ quoteId: string }> {
    try {
      await rejectQuote(this.ledger.clientFor(wallet.ledgerUserId), wallet.partyId, quoteId);
      return { quoteId };
    } catch (error) {
      throw toHttpError(error, "Rejecting a quote", this.logger);
    }
  }
}

export function toRequestView(request: Contract<RfqRequest>): QuoteRequestView {
  return {
    requestId: request.contractId,
    marketId: request.payload.terms.marketId,
    side: request.payload.side,
    ptAmount: request.payload.ptAmount,
    requestedAt: request.payload.requestedAt,
  };
}

export function toQuoteView(quote: Contract<Quote>, years: number): QuoteView {
  const { terms, side, ptAmount, price, usdcAmount, validUntil } = quote.payload;
  return {
    quoteId: quote.contractId,
    marketId: terms.marketId,
    side,
    ptAmount,
    price,
    usdcAmount,
    validUntil,
    isLive: isQuoteLive(quote.payload),
    fixedApyPercent: fixedApyPercent(price, years),
  };
}
