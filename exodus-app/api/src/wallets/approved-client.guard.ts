// Lets only approved clients (those with a wallet) use wallet routes, and puts
// their wallet on the request for @CurrentWallet(). Runs after SessionGuard.
//
// This is the off-ledger check. The ledger checks again on its own: Subscribe
// and transfers need the client's ClientAccess pass.
import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { AppRequest } from "../common/request-context.ts";
import { PrismaService } from "../prisma/prisma.service.ts";

@Injectable()
export class ApprovedClientGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (request.user === undefined) {
      return false;
    }
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: request.user.id },
      select: { id: true, userId: true, partyId: true, ledgerUserId: true },
    });
    if (wallet === null) {
      throw new ForbiddenException("Your access application is not approved yet.");
    }
    request.wallet = wallet;
    return true;
  }
}
