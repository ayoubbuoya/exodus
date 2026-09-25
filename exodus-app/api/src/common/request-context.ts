// What the guards attach to the Express request, and decorators to read it in controllers.
import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { Role } from "../generated/prisma/client.ts";

// The logged-in user, as SessionGuard finds it. Never includes the password hash.
export type AuthUser = {
  id: string;
  email: string;
  role: Role;
};

// The approved client's custodial wallet, as ApprovedClientGuard finds it.
export type ClientWallet = {
  id: string;
  userId: string;
  partyId: string;
  ledgerUserId: string;
};

export type AppRequest = Request & {
  user?: AuthUser;
  wallet?: ClientWallet;
};

// @CurrentUser() user: AuthUser  (only on routes behind SessionGuard, which is every non-@Public route)
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const request = context.switchToHttp().getRequest<AppRequest>();
  if (request.user === undefined) {
    // Only possible if someone puts @CurrentUser() on a @Public() route: a programming error.
    throw new Error("@CurrentUser() used on a route without SessionGuard");
  }
  return request.user;
});

// @CurrentWallet() wallet: ClientWallet  (only on routes behind ApprovedClientGuard)
export const CurrentWallet = createParamDecorator((_data: unknown, context: ExecutionContext): ClientWallet => {
  const request = context.switchToHttp().getRequest<AppRequest>();
  if (request.wallet === undefined) {
    throw new Error("@CurrentWallet() used on a route without ApprovedClientGuard");
  }
  return request.wallet;
});
