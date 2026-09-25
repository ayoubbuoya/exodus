// /api/portfolio: the approved client's PT and YT, their USD value, and the
// open payout requests (claim, PT redeem, merge) with Cancel.
import { Controller, Delete, Get, Param, UseGuards } from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { MarketRequestKind } from "@exodus/ledger";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import { CurrentWallet, type ClientWallet } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { ApprovedClientGuard } from "../wallets/approved-client.guard.ts";
import { MarketRequestParamsDto } from "./dto/markets.dto.ts";
import { PortfolioService, type Portfolio } from "./portfolio.service.ts";

@ApiTags("portfolio")
@ApiCookieAuth(SESSION_COOKIE)
@ApiForbiddenResponse({ description: "Not an approved client" })
@UseGuards(ApprovedClientGuard)
@Controller("portfolio")
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  @ResponseMessage("Portfolio loaded")
  @ApiOperation({ summary: "My PT and YT per market, claimable yield, USD value, and open payout requests" })
  @ApiOkResponse({ description: "{ positions, openRequests, totalUsd }" })
  async get(@CurrentWallet() wallet: ClientWallet): Promise<Portfolio> {
    return this.portfolio.getPortfolio(wallet);
  }

  @Delete("requests/:requestId")
  @ResponseMessage("Request cancelled, your tokens are back")
  @ApiOperation({ summary: "Cancel my open claim, PT redeem or merge and get the PT/YT back" })
  @ApiOkResponse({ description: "{ requestId, kind }" })
  @ApiNotFoundResponse({ description: "Not an open request of mine (maybe already paid)" })
  async cancel(
    @CurrentWallet() wallet: ClientWallet,
    @Param() params: MarketRequestParamsDto,
  ): Promise<{ requestId: string; kind: MarketRequestKind }> {
    return this.portfolio.cancelRequest(wallet, params.requestId);
  }
}
