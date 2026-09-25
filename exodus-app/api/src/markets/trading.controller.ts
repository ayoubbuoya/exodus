// /api/quote-requests and /api/quotes: private PT trading with the house
// dealer. Accept and reject are sub-resources ("an acceptance of quote X"),
// like the admin's approval, because accepting moves tokens on the ledger.
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import { CurrentWallet, type ClientWallet } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { ApprovedClientGuard } from "../wallets/approved-client.guard.ts";
import { CreateQuoteRequestDto, QuoteParamsDto, QuoteRequestParamsDto } from "./dto/trading.dto.ts";
import { TradingService, type QuoteRequestView, type QuoteView } from "./trading.service.ts";

@ApiTags("trading")
@ApiCookieAuth(SESSION_COOKIE)
@ApiForbiddenResponse({ description: "Not an approved client" })
@UseGuards(ApprovedClientGuard)
@Controller()
export class TradingController {
  constructor(private readonly trading: TradingService) {}

  @Post("quote-requests")
  @ResponseMessage("Quote requested; the dealer answers in a few seconds")
  @ApiOperation({ summary: "Ask the house dealer for a private price to buy or sell PT (RFQ)" })
  @ApiCreatedResponse({ description: "Requested; the quote shows in GET /quotes" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example the market has matured" })
  async createRequest(
    @CurrentWallet() wallet: ClientWallet,
    @Body() dto: CreateQuoteRequestDto,
  ): Promise<CreateQuoteRequestDto> {
    return this.trading.createRequest(wallet, dto);
  }

  @Get("quote-requests")
  @ResponseMessage("Quote requests loaded")
  @ApiOperation({ summary: "My requests the dealer has not answered yet, oldest first" })
  @ApiOkResponse({ description: "{ items: [QuoteRequestView] }" })
  async listRequests(@CurrentWallet() wallet: ClientWallet): Promise<{ items: QuoteRequestView[] }> {
    return { items: await this.trading.listRequests(wallet) };
  }

  @Delete("quote-requests/:requestId")
  @ResponseMessage("Quote request cancelled")
  @ApiOperation({ summary: "Cancel a request the dealer has not answered yet" })
  @ApiOkResponse({ description: "Cancelled" })
  @ApiUnprocessableEntityResponse({ description: "Already answered or cancelled" })
  async cancelRequest(
    @CurrentWallet() wallet: ClientWallet,
    @Param() params: QuoteRequestParamsDto,
  ): Promise<{ requestId: string }> {
    return this.trading.cancelRequest(wallet, params.requestId);
  }

  @Get("quotes")
  @ResponseMessage("Quotes loaded")
  @ApiOperation({ summary: "My firm quotes (price, USDC amount, expiry, fixed APY), soonest expiry first" })
  @ApiOkResponse({ description: "{ items: [QuoteView] }" })
  async listQuotes(@CurrentWallet() wallet: ClientWallet): Promise<{ items: QuoteView[] }> {
    return { items: await this.trading.listQuotes(wallet) };
  }

  @Post("quotes/:quoteId/acceptance")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Trade done: both sides settled in one transaction")
  @ApiOperation({ summary: "Accept a quote: USDC and PT change hands atomically (DvP)" })
  @ApiOkResponse({ description: "Settled" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example the quote expired or not enough USDC" })
  async accept(@CurrentWallet() wallet: ClientWallet, @Param() params: QuoteParamsDto): Promise<{ quoteId: string; retried: boolean }> {
    return this.trading.accept(wallet, params.quoteId);
  }

  @Post("quotes/:quoteId/rejection")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Quote rejected")
  @ApiOperation({ summary: "Say no to a quote (the dealer's locked PT is released at once)" })
  @ApiOkResponse({ description: "Rejected" })
  @ApiUnprocessableEntityResponse({ description: "No such live quote" })
  async reject(@CurrentWallet() wallet: ClientWallet, @Param() params: QuoteParamsDto): Promise<{ quoteId: string }> {
    return this.trading.reject(wallet, params.quoteId);
  }
}
