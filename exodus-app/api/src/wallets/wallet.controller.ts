// /api/wallet: the approved client's custodial wallet.
// SessionGuard (global) checks the login; ApprovedClientGuard checks the approval.
import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import type { ActivityRow } from "@exodus/ledger";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import { CurrentWallet, type ClientWallet } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { ApprovedClientGuard } from "./approved-client.guard.ts";
import { ActivityQueryDto, SubscribeDto, TransferDto } from "./dto/wallet-commands.dto.ts";
import { FaucetService, type FaucetClaimResult } from "./faucet.service.ts";
import { WalletService, type SubscribeResult, type WalletOverview } from "./wallet.service.ts";

@ApiTags("wallet")
@ApiCookieAuth(SESSION_COOKIE)
@ApiForbiddenResponse({ description: "Not an approved client" })
@UseGuards(ApprovedClientGuard)
@Controller("wallet")
export class WalletController {
  constructor(
    private readonly wallets: WalletService,
    private readonly faucet: FaucetService,
  ) {}

  @Get()
  @ResponseMessage("Wallet loaded")
  @ApiOperation({ summary: "My party id, balances, holdings and faucet cooldown" })
  @ApiOkResponse({ description: "The wallet" })
  async getOverview(@CurrentWallet() wallet: ClientWallet): Promise<WalletOverview> {
    return this.wallets.getOverview(wallet);
  }

  @Get("activity")
  @ResponseMessage("Activity loaded")
  @ApiOperation({ summary: "My recent token movements (received, sent, subscribed), newest first, from the ledger" })
  @ApiOkResponse({ description: "{ items: [{ updateId, kind, at, changes: { USDC: \"-40\", USYC: \"39.9\" } }] }" })
  async getActivity(
    @CurrentWallet() wallet: ClientWallet,
    @Query() query: ActivityQueryDto,
  ): Promise<{ items: ActivityRow[] }> {
    return { items: await this.wallets.getActivity(wallet, query.limit) };
  }

  @Post("faucet-claims")
  @ResponseMessage("Test USDC sent to your wallet")
  @ApiOperation({ summary: "Get simulated test USDC (once per cooldown)" })
  @ApiCreatedResponse({ description: "Minted; returns the amount and the next claim time" })
  @ApiTooManyRequestsResponse({ description: "Cooldown not over yet" })
  async claimFaucet(@CurrentWallet() wallet: ClientWallet): Promise<FaucetClaimResult> {
    return this.faucet.claim(wallet);
  }

  @Post("subscriptions")
  @ResponseMessage("Subscribed to USYC")
  @ApiOperation({ summary: "Pay USDC, get USYC at the current price (atomic)" })
  @ApiCreatedResponse({ description: "Subscribed" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example not enough USDC or no valid price" })
  async subscribe(@CurrentWallet() wallet: ClientWallet, @Body() dto: SubscribeDto): Promise<SubscribeResult> {
    return this.wallets.subscribe(wallet, dto);
  }

  @Post("transfers")
  @ResponseMessage("Tokens sent")
  @ApiOperation({ summary: "Send USYC or USDC to another approved client (CIP-56 transfer)" })
  @ApiCreatedResponse({ description: "Sent" })
  @ApiUnprocessableEntityResponse({ description: "Rejected, for example the receiver is not an approved client" })
  async transfer(@CurrentWallet() wallet: ClientWallet, @Body() dto: TransferDto): Promise<TransferDto> {
    return this.wallets.transfer(wallet, dto);
  }
}
