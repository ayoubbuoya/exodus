// The house dealer's desk (decision D2): Bank's open RFQs, quoting and
// declining them, and Bank's position. Used by admins on /dealer (manual
// override) and by the dealer bot (DealerBotService).
//
// The backend's own ledger user acts as Bank, like it acts as UsdcIssuer for
// the faucet. Bank sees every RFQ sent to it (it observes them); nobody else
// does, not even the Operator.
import { Injectable, Logger } from "@nestjs/common";
import {
  decimalToUnits,
  declineRfq,
  getMarketPositions,
  getOwnedHoldings,
  getQuotes,
  getRfqRequests,
  quoteRfq,
  requestClaim,
  requestPtRedeem,
  setAsideUsdcIds,
  unitsToDecimal,
  yearsBetween,
  type Contract,
  type RfqRequest,
} from "@exodus/ledger";
import { toHttpError } from "../ledger/ledger-errors.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import { fixedApyPercent, priceForSide } from "./dealer-pricing.ts";
import { DealerSettingsService, HOUSE_DEALER } from "./dealer-settings.service.ts";
import { MarketPricingService } from "./market-pricing.service.ts";
import { toQuoteView, toRequestView, type QuoteRequestView, type QuoteView } from "./trading.service.ts";

// An RFQ as the desk sees it: who asked, and the price the bot would give.
export type DealerRequestView = QuoteRequestView & {
  requester: string; // the client's party id (the dealer is its counterparty, so it knows)
  suggestedPrice: string | null; // from the settings; null at maturity
  suggestedFixedApyPercent: number | null;
};

// Bank's inventory. Example after bootstrap:
//   { markets: [{ marketId: "PT-USYC-APR2027", ptFree: "1000", ytTotal: "1000", ... }],
//     usdc: "10000", usdcSetAside: "0", usyc: "0", liveQuotes: [] }
export type DealerPosition = {
  markets: {
    marketId: string;
    ptTotal: string;
    ptLocked: string; // locked for live buy quotes
    ptFree: string; // what the bot can still quote
    ytTotal: string;
    claimableUsyc: string | null;
  }[];
  usdc: string;
  usdcSetAside: string; // held for live sell quotes; the bot never spends it
  usyc: string;
  liveQuotes: (QuoteView & { requester: string })[];
};

@Injectable()
export class DealerDeskService {
  private readonly logger = new Logger(DealerDeskService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly pricing: MarketPricingService,
    private readonly settings: DealerSettingsService,
  ) {}

  // Bank's party id, for example "Bank::1220ab...".
  async dealerParty(): Promise<string> {
    const parties = await this.ledger.getDemoParties();
    return parties[HOUSE_DEALER];
  }

  // The RFQs sent to Bank that nobody answered yet, oldest first (raw, for the bot).
  async readOpenRequests(): Promise<Contract<RfqRequest>[]> {
    const dealer = await this.dealerParty();
    const requests = await getRfqRequests(this.ledger.backendLedger, dealer);
    return requests.filter((request) => request.payload.dealer === dealer);
  }

  // The same, with the price the bot would quote, for the desk page.
  async listOpenRequests(): Promise<DealerRequestView[]> {
    const context = await this.pricing.readContext();
    try {
      const requests = await this.readOpenRequests();
      return requests.map((request) => {
        const { terms, side, requester } = request.payload;
        const years = yearsBetween(context.simTime, terms.maturity);
        // No price at or after maturity: PT trading is closed then.
        const price = years > 0 ? priceForSide(this.pricing.pricesFor(context, terms.maturity), side) : null;
        return {
          ...toRequestView(request),
          requester,
          suggestedPrice: price,
          suggestedFixedApyPercent: price === null ? null : fixedApyPercent(price, years),
        };
      });
    } catch (error) {
      throw toHttpError(error, "Reading the dealer's requests", this.logger);
    }
  }

  // Quotes one RFQ at `price`, firm for the configured number of seconds.
  // Throws the @exodus/ledger error as is; callers turn it into HTTP or a decline.
  async quote(requestId: string, price: string): Promise<void> {
    const settings = await this.settings.get();
    await quoteRfq(this.ledger.backendLedger, {
      dealer: await this.dealerParty(),
      rfqId: requestId,
      price,
      validForSeconds: settings.quoteValidSeconds,
    });
  }

  async decline(requestId: string): Promise<void> {
    await declineRfq(this.ledger.backendLedger, await this.dealerParty(), requestId);
  }

  // An admin quotes by hand (for example a size the bot declines).
  async quoteManually(requestId: string, price: string): Promise<{ requestId: string; price: string }> {
    try {
      await this.quote(requestId, price);
      this.logger.log(`Dealer desk quoted request ${requestId.slice(0, 12)}... at ${price}`);
      return { requestId, price };
    } catch (error) {
      throw toHttpError(error, "Manual quote", this.logger);
    }
  }

  async declineManually(requestId: string): Promise<{ requestId: string }> {
    try {
      await this.decline(requestId);
      this.logger.log(`Dealer desk declined request ${requestId.slice(0, 12)}...`);
      return { requestId };
    } catch (error) {
      throw toHttpError(error, "Declining a request", this.logger);
    }
  }

  // Bank claims the yield of all its YT in one market (spec section 9, step 3:
  // on Jan 1, 1000 YT from 1.00 to 1.025 -> 24.390243 USYC). The Operator's
  // bot pays it within a few seconds, like any client's claim.
  async claimYield(marketId: string): Promise<{ marketId: string }> {
    const parties = await this.ledger.getDemoParties();
    try {
      await requestClaim(this.ledger.backendLedger, { owner: parties[HOUSE_DEALER], operator: parties.Operator, marketId });
      this.logger.log(`Dealer desk requested Bank's YT claim in ${marketId}`);
      return { marketId };
    } catch (error) {
      throw toHttpError(error, "Dealer claim", this.logger);
    }
  }

  // After maturity, Bank redeems all its free PT (spec section 9, step 6:
  // 500 PT at 1.05 -> 476.190476 USYC).
  async redeemPt(marketId: string): Promise<{ marketId: string }> {
    const parties = await this.ledger.getDemoParties();
    try {
      await requestPtRedeem(this.ledger.backendLedger, { owner: parties[HOUSE_DEALER], operator: parties.Operator, marketId });
      this.logger.log(`Dealer desk requested Bank's PT redeem in ${marketId}`);
      return { marketId };
    } catch (error) {
      throw toHttpError(error, "Dealer PT redeem", this.logger);
    }
  }

  async getPosition(): Promise<DealerPosition> {
    const context = await this.pricing.readContext();
    try {
      const dealer = await this.dealerParty();
      const positions = await getMarketPositions(this.ledger.backendLedger, dealer, context.index);
      const quotes = (await getQuotes(this.ledger.backendLedger, dealer)).filter((quote) => quote.payload.dealer === dealer);
      const balances = await this.readCashBalances(dealer, setAsideUsdcIds(quotes, dealer));
      return {
        markets: positions.map((position) => ({
          marketId: position.terms.marketId,
          ptTotal: position.ptTotal,
          ptLocked: position.ptLocked,
          ptFree: position.ptFree,
          ytTotal: position.ytTotal,
          claimableUsyc: position.claimableUsyc,
        })),
        ...balances,
        liveQuotes: quotes.map((quote) => ({
          ...toQuoteView(quote, yearsBetween(context.simTime, quote.payload.terms.maturity)),
          requester: quote.payload.requester,
        })),
      };
    } catch (error) {
      throw toHttpError(error, "Reading the dealer's position", this.logger);
    }
  }

  // Bank's USDC and USYC totals, and how much USDC is set aside for sell quotes.
  private async readCashBalances(
    dealer: string,
    setAside: Set<string>,
  ): Promise<{ usdc: string; usdcSetAside: string; usyc: string }> {
    let usdc = 0n;
    let usdcSetAside = 0n;
    let usyc = 0n;
    for (const holding of await getOwnedHoldings(this.ledger.backendLedger, dealer)) {
      const units = decimalToUnits(holding.payload.amount);
      if (holding.payload.instrumentId.id === "USDC") {
        usdc += units;
        if (setAside.has(holding.contractId)) {
          usdcSetAside += units;
        }
      } else if (holding.payload.instrumentId.id === "USYC") {
        usyc += units;
      }
    }
    return { usdc: unitsToDecimal(usdc), usdcSetAside: unitsToDecimal(usdcSetAside), usyc: unitsToDecimal(usyc) };
  }
}
