// /api/dealer: the house dealer's desk (decision D2; admins run it, Phase 6
// choice 1A). Admins see Bank's open RFQs and position, quote or decline by
// hand, and change the bot's settings.
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.ts";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { DealerDeskService, type DealerPosition, type DealerRequestView } from "./dealer-desk.service.ts";
import { DealerSettingsService, type DealerSettingsView } from "./dealer-settings.service.ts";
import { ManualQuoteDto, UpdateDealerSettingsDto } from "./dto/dealer.dto.ts";
import { QuoteRequestParamsDto } from "./dto/trading.dto.ts";

@ApiTags("dealer")
@ApiCookieAuth(SESSION_COOKIE)
@ApiForbiddenResponse({ description: "Not an admin" })
@UseGuards(AdminGuard)
@Controller("dealer")
export class DealerController {
  constructor(
    private readonly desk: DealerDeskService,
    private readonly settings: DealerSettingsService,
  ) {}

  @Get("quote-requests")
  @ResponseMessage("Open requests loaded")
  @ApiOperation({ summary: "RFQs sent to the house dealer that are not answered yet, with the bot's suggested price" })
  @ApiOkResponse({ description: "{ items: [DealerRequestView] }" })
  async listRequests(): Promise<{ items: DealerRequestView[] }> {
    return { items: await this.desk.listOpenRequests() };
  }

  @Post("quote-requests/:requestId/quotes")
  @ResponseMessage("Quote sent")
  @ApiOperation({ summary: "Quote an RFQ by hand at the given price (firm for the configured seconds)" })
  @ApiCreatedResponse({ description: "Quoted" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example not enough free PT or USDC" })
  async quote(@Param() params: QuoteRequestParamsDto, @Body() dto: ManualQuoteDto): Promise<{ requestId: string; price: string }> {
    return this.desk.quoteManually(params.requestId, dto.price);
  }

  @Post("quote-requests/:requestId/declines")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Request declined")
  @ApiOperation({ summary: "Decline an RFQ" })
  @ApiOkResponse({ description: "Declined" })
  async decline(@Param() params: QuoteRequestParamsDto): Promise<{ requestId: string }> {
    return this.desk.declineManually(params.requestId);
  }

  @Get("position")
  @ResponseMessage("Dealer position loaded")
  @ApiOperation({ summary: "The house dealer's PT, YT, USDC (and USDC set aside for sell quotes) and live quotes" })
  @ApiOkResponse({ description: "DealerPosition" })
  async position(): Promise<DealerPosition> {
    return this.desk.getPosition();
  }

  @Get("settings")
  @ResponseMessage("Dealer settings loaded")
  @ApiOperation({ summary: "The dealer bot's settings (auto-quote, APY offset, fallback, spread, size limit, quote lifetime)" })
  @ApiOkResponse({ description: "DealerSettingsView" })
  async getSettings(): Promise<DealerSettingsView> {
    return this.settings.get();
  }

  @Put("settings")
  @ResponseMessage("Dealer settings saved")
  @ApiOperation({ summary: "Replace the dealer bot's settings" })
  @ApiOkResponse({ description: "DealerSettingsView" })
  async updateSettings(@Body() dto: UpdateDealerSettingsDto): Promise<DealerSettingsView> {
    return this.settings.update(dto);
  }
}
