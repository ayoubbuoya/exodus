// /api/prices/usyc: the simulated USYC price history for the chart.
// Public: like the real fund's published NAV, the price is not a secret, and
// the landing page can show it too. (The price CONTRACTS stay private on the ledger.)
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/public.decorator.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { PriceHistoryQueryDto } from "./dto/price-history.dto.ts";
import { PricesService, type LatestPriceView, type PricePointView } from "./prices.service.ts";

@ApiTags("prices")
@Controller("prices")
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Public()
  @Get("usyc/latest")
  @ResponseMessage("Latest price loaded")
  @ApiOperation({ summary: "The newest USYC price snapshot, whether it is live, days to maturity and the 30-day APY" })
  @ApiOkResponse({ description: "{ index, simTime, publishedAt, validUntil, isLive, daysToMaturity, apy30dPercent }" })
  @ApiServiceUnavailableResponse({ description: "The ledger is not reachable or not bootstrapped" })
  async getUsycLatest(): Promise<LatestPriceView> {
    return this.prices.getLatest();
  }

  @Public()
  @Get("usyc")
  @ResponseMessage("Price history loaded")
  @ApiOperation({ summary: "USYC index history (demo dates), oldest first" })
  @ApiOkResponse({ description: "{ instrument, points: [{ index, simTime, publishedAt }] }" })
  async getUsycHistory(@Query() query: PriceHistoryQueryDto): Promise<{ instrument: string; points: PricePointView[] }> {
    return this.prices.getHistory("USYC", query.limit);
  }
}
