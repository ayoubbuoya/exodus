// The markets (the Pendle part): the market cards, and what an approved
// client can do in a market: split USYC into PT + YT, merge them back, claim
// the YT yield, and redeem PT after maturity.
//
// The USYC fund (subscribe / redeem USDC <-> USYC) is NOT here: it is the
// simulated on-ramp and lives in the wallets module.
//
// Every client command is sent with the client's own ledger user
// (LedgerService.clientFor); the @exodus/ledger helpers read the Market, the
// price and the maturity snapshot as the Operator and disclose them.
// Payouts (merge, claim, PT redeem) are requests: the Operator's bot
// (OperatorSettlementService) pays them within a few seconds.
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  getMarkets,
  getMaturitySnapshot,
  marketSymbols,
  requestClaim,
  requestMerge,
  requestPtRedeem,
  splitUsyc,
  type Disclosable,
  type Market,
} from "@exodus/ledger";
import type { ClientWallet } from "../common/request-context.ts";
import { toHttpError } from "../ledger/ledger-errors.ts";
import { LedgerService } from "../ledger/ledger.service.ts";
import type { DealerPrices } from "./dealer-pricing.ts";
import type { MergeDto, SplitDto } from "./dto/markets.dto.ts";
import { daysBetween, MarketPricingService, type PricingContext } from "./market-pricing.service.ts";

// One market card (GET /api/markets). Example on Oct 1:
//   { marketId: "PT-USYC-APR2027", symbols: { pt: "PT-USYC-APR2027", yt: "YT-USYC-APR2027" },
//     maturity: "2027-04-01T00:00:00Z", daysToMaturity: 182, matured: false,
//     currentIndex: "1.0000000000", underlyingApyPercent: null,
//     indicative: { askPrice: "0.975503", askFixedApyPercent: 5.1, ... }, ... }
export type MarketView = {
  marketId: string;
  symbols: { pt: string; yt: string };
  instrument: string; // the yield asset, "USYC" (simulated)
  maturity: string; // on the demo clock
  daysToMaturity: number;
  matured: boolean;
  maturityIndex: string | null; // the frozen index once matured, for example "1.0500000000"
  currentIndex: string;
  priceIsLive: boolean; // false while the oracle bot is stopped: trading and splits fail
  underlyingApyPercent: number | null;
  // The house dealer's indicative prices (decision D5): askPrice is what you
  // pay to buy PT, bidPrice what you get to sell, with the fixed APY of each.
  // Null once the market has reached maturity (PT trading is closed then).
  indicative: DealerPrices | null;
  dealerAutoQuote: boolean; // false: quotes come from an admin, not within seconds
};

// What a client command answers with. `retried` is true when the first try
// hit a contract that changed meanwhile and the second try worked.
export type MarketCommandResult = { marketId: string; amount: string | null; retried: boolean };

@Injectable()
export class MarketsService {
  private readonly logger = new Logger(MarketsService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly pricing: MarketPricingService,
  ) {}

  async listMarkets(): Promise<MarketView[]> {
    const context = await this.pricing.readContext();
    const markets = await this.readMarkets();
    const views: MarketView[] = [];
    for (const market of markets) {
      views.push(await this.toView(market, context));
    }
    return views;
  }

  async getMarket(marketId: string): Promise<MarketView> {
    const context = await this.pricing.readContext();
    const market = (await this.readMarkets()).find((candidate) => candidate.payload.terms.marketId === marketId);
    if (market === undefined) {
      throw new NotFoundException(`No market "${marketId}".`);
    }
    return this.toView(market, context);
  }

  // Every market, read as the Operator (the only party that sees them).
  private async readMarkets(): Promise<Disclosable<Market>[]> {
    const parties = await this.ledger.getDemoParties();
    try {
      return await getMarkets(this.ledger.backendLedger, parties.Operator);
    } catch (error) {
      throw toHttpError(error, "Reading markets", this.logger);
    }
  }

  private async toView(market: Disclosable<Market>, context: PricingContext): Promise<MarketView> {
    const { terms, matured } = market.payload;
    const daysToMaturity = daysBetween(context.simTime, terms.maturity);
    // PT trading stops at maturity (like Pendle), so there is no price to show then.
    const tradingClosed = matured || daysToMaturity === 0;
    return {
      marketId: terms.marketId,
      symbols: marketSymbols(terms.marketId),
      instrument: terms.instrument,
      maturity: terms.maturity,
      daysToMaturity,
      matured,
      maturityIndex: matured ? await this.readMaturityIndex(terms.marketId) : null,
      currentIndex: context.index,
      priceIsLive: context.isLive,
      underlyingApyPercent: context.underlyingApyPercent,
      indicative: tradingClosed ? null : this.pricing.pricesFor(context, terms.maturity),
      dealerAutoQuote: context.settings.autoQuote,
    };
  }

  private async readMaturityIndex(marketId: string): Promise<string | null> {
    const parties = await this.ledger.getDemoParties();
    try {
      const snapshot = await getMaturitySnapshot(this.ledger.backendLedger, parties.Operator, marketId);
      return snapshot?.payload.index ?? null;
    } catch (error) {
      throw toHttpError(error, "Reading the maturity snapshot", this.logger);
    }
  }

  // ---------------------------------------------------------------------------
  // Client commands
  // ---------------------------------------------------------------------------

  // Alice splits 1000 USYC at index 1.025 -> 1025 PT + 1025 YT, in one transaction.
  async split(wallet: ClientWallet, marketId: string, dto: SplitDto): Promise<MarketCommandResult> {
    const parties = await this.ledger.getDemoParties();
    try {
      const outcome = await splitUsyc(this.ledger.clientFor(wallet.ledgerUserId), {
        splitter: wallet.partyId,
        operator: parties.Operator,
        marketId,
        usycAmount: dto.usycAmount,
      });
      this.logger.log(`User ${wallet.userId} split ${dto.usycAmount} USYC in ${marketId}`);
      return { marketId, amount: dto.usycAmount, retried: outcome.retried };
    } catch (error) {
      throw toHttpError(error, "Split", this.logger);
    }
  }

  // Alice asks to merge 100 PT + 100 YT back into USYC; the bot pays
  // 100 / lastIndex USYC a few seconds later. Before maturity only.
  async merge(wallet: ClientWallet, marketId: string, dto: MergeDto): Promise<MarketCommandResult> {
    const parties = await this.ledger.getDemoParties();
    try {
      const outcome = await requestMerge(this.ledger.clientFor(wallet.ledgerUserId), {
        owner: wallet.partyId,
        operator: parties.Operator,
        marketId,
        amount: dto.amount,
      });
      this.logger.log(`User ${wallet.userId} requested a merge of ${dto.amount} PT + YT in ${marketId}`);
      return { marketId, amount: dto.amount, retried: outcome.retried };
    } catch (error) {
      throw toHttpError(error, "Merge", this.logger);
    }
  }

  // Alice claims the yield of all her YT; the bot pays it at the price of
  // that moment (after maturity: up to the maturity index, and the YT is used up).
  async claim(wallet: ClientWallet, marketId: string): Promise<MarketCommandResult> {
    const parties = await this.ledger.getDemoParties();
    try {
      await requestClaim(this.ledger.clientFor(wallet.ledgerUserId), {
        owner: wallet.partyId,
        operator: parties.Operator,
        marketId,
      });
      this.logger.log(`User ${wallet.userId} requested a YT claim in ${marketId}`);
      return { marketId, amount: null, retried: false };
    } catch (error) {
      throw toHttpError(error, "Claim", this.logger);
    }
  }

  // After maturity, Alice redeems all her PT: 1 PT pays 1 USD of USYC at the
  // price of the settle moment (500 PT at 1.05 -> 476.190476 USYC).
  async redeemPt(wallet: ClientWallet, marketId: string): Promise<MarketCommandResult> {
    const parties = await this.ledger.getDemoParties();
    try {
      await requestPtRedeem(this.ledger.clientFor(wallet.ledgerUserId), {
        owner: wallet.partyId,
        operator: parties.Operator,
        marketId,
      });
      this.logger.log(`User ${wallet.userId} requested a PT redeem in ${marketId}`);
      return { marketId, amount: null, retried: false };
    } catch (error) {
      throw toHttpError(error, "PT redeem", this.logger);
    }
  }
}
