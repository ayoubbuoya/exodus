// /api/prices/usyc: the simulated USYC price history for the chart.
// Public: like the real fund's published NAV, the price is not a secret, and
// the landing page can show it too. (The price CONTRACTS stay private on the ledger.)
import { Controller, Get, Query } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/public.decorator.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { PriceHistoryQueryDto } from "./dto/price-history.dto.ts";
import { PricesService, type PricePointView } from "./prices.service.ts";

@ApiTags("prices")
@Controller("prices")
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Public()
  @Get("usyc")
  @ResponseMessage("Price history loaded")
  @ApiOperation({ summary: "USYC index history (demo dates), oldest first" })
  @ApiOkResponse({ description: "{ instrument, points: [{ index, simTime, publishedAt }] }" })
  async getUsycHistory(@Query() query: PriceHistoryQueryDto): Promise<{ instrument: string; points: PricePointView[] }> {
    return this.prices.getHistory("USYC", query.limit);
  }
}
