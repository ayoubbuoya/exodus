// The markets (the Pendle part): market cards, split/merge/claim/redeem, the
// portfolio, private PT trading, the dealer desk, and the two bots (Operator
// settlement and house dealer). The USYC fund on-ramp stays in WalletsModule.
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.ts";
import { PricesModule } from "../prices/prices.module.ts";
import { ApprovedClientGuard } from "../wallets/approved-client.guard.ts";
import { DealerBotService } from "./dealer-bot.service.ts";
import { DealerController } from "./dealer.controller.ts";
import { DealerDeskService } from "./dealer-desk.service.ts";
import { DealerSettingsService } from "./dealer-settings.service.ts";
import { MarketPricingService } from "./market-pricing.service.ts";
import { MarketsController } from "./markets.controller.ts";
import { MarketsService } from "./markets.service.ts";
import { OperatorSettlementService } from "./operator-settlement.service.ts";
import { PortfolioController } from "./portfolio.controller.ts";
import { PortfolioService } from "./portfolio.service.ts";
import { TradingController } from "./trading.controller.ts";
import { TradingService } from "./trading.service.ts";

@Module({
  // AuthModule for AdminGuard (dealer desk), PricesModule for the underlying APY.
  imports: [AuthModule, PricesModule],
  controllers: [MarketsController, PortfolioController, TradingController, DealerController],
  providers: [
    ApprovedClientGuard,
    MarketPricingService,
    DealerSettingsService,
    MarketsService,
    PortfolioService,
    TradingService,
    DealerDeskService,
    DealerBotService,
    OperatorSettlementService,
  ],
})
export class MarketsModule {}
