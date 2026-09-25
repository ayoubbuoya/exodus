// /api/markets: the market cards, and split / merge / claim / PT redeem.
// Reading the markets needs a login only; the commands need an approved
// client with a wallet (ApprovedClientGuard).
import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import { CurrentWallet, type ClientWallet } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { ApprovedClientGuard } from "../wallets/approved-client.guard.ts";
import { MarketParamsDto, MergeDto, SplitDto } from "./dto/markets.dto.ts";
import { MarketsService, type MarketCommandResult, type MarketView } from "./markets.service.ts";

@ApiTags("markets")
@ApiCookieAuth(SESSION_COOKIE)
@Controller("markets")
export class MarketsController {
  constructor(private readonly markets: MarketsService) {}

  @Get()
  @ResponseMessage("Markets loaded")
  @ApiOperation({ summary: "Every market: maturity, underlying APY, the house dealer's indicative prices and fixed APY" })
  @ApiOkResponse({ description: "{ items: [MarketView] }" })
  async list(): Promise<{ items: MarketView[] }> {
    return { items: await this.markets.listMarkets() };
  }

  @Get(":marketId")
  @ResponseMessage("Market loaded")
  @ApiOperation({ summary: "One market, with the maturity index once matured" })
  @ApiOkResponse({ description: "MarketView" })
  @ApiNotFoundResponse({ description: "No such market" })
  async get(@Param() params: MarketParamsDto): Promise<MarketView> {
    return this.markets.getMarket(params.marketId);
  }

  @Post(":marketId/splits")
  @UseGuards(ApprovedClientGuard)
  @ResponseMessage("USYC split into PT + YT")
  @ApiOperation({ summary: "Split USYC into PT + YT (usycAmount * index of each), in one transaction" })
  @ApiCreatedResponse({ description: "Split" })
  @ApiForbiddenResponse({ description: "Not an approved client" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example not enough USYC or the market has matured" })
  async split(
    @CurrentWallet() wallet: ClientWallet,
    @Param() params: MarketParamsDto,
    @Body() dto: SplitDto,
  ): Promise<MarketCommandResult> {
    return this.markets.split(wallet, params.marketId, dto);
  }

  @Post(":marketId/merges")
  @UseGuards(ApprovedClientGuard)
  @ResponseMessage("Merge requested")
  @ApiOperation({ summary: "Merge PT + YT back into USYC (before maturity); the Operator pays amount / lastIndex USYC in a few seconds" })
  @ApiCreatedResponse({ description: "Requested; see the portfolio's open requests" })
  @ApiForbiddenResponse({ description: "Not an approved client" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example not enough PT or YT, or the market has matured" })
  async merge(
    @CurrentWallet() wallet: ClientWallet,
    @Param() params: MarketParamsDto,
    @Body() dto: MergeDto,
  ): Promise<MarketCommandResult> {
    return this.markets.merge(wallet, params.marketId, dto);
  }

  @Post(":marketId/claims")
  @UseGuards(ApprovedClientGuard)
  @ResponseMessage("Yield claim requested")
  @ApiOperation({ summary: "Claim the yield of all my YT; the Operator pays it in a few seconds" })
  @ApiCreatedResponse({ description: "Requested" })
  @ApiForbiddenResponse({ description: "Not an approved client" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example no YT in this market" })
  async claim(@CurrentWallet() wallet: ClientWallet, @Param() params: MarketParamsDto): Promise<MarketCommandResult> {
    return this.markets.claim(wallet, params.marketId);
  }

  @Post(":marketId/pt-redemptions")
  @UseGuards(ApprovedClientGuard)
  @ResponseMessage("PT redeem requested")
  @ApiOperation({ summary: "After maturity: redeem all my PT for 1 USD of USYC each; the Operator pays in a few seconds" })
  @ApiCreatedResponse({ description: "Requested" })
  @ApiForbiddenResponse({ description: "Not an approved client" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example the market has not matured yet" })
  async redeemPt(@CurrentWallet() wallet: ClientWallet, @Param() params: MarketParamsDto): Promise<MarketCommandResult> {
    return this.markets.redeemPt(wallet, params.marketId);
  }
}
