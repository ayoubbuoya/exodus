// Global guard: every route needs a valid session cookie, unless it is marked @Public().
// On success it puts the user on the request, for @CurrentUser().
import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../common/public.decorator.ts";
import type { AppRequest } from "../common/request-context.ts";
import { SESSION_COOKIE } from "./session.constants.ts";
import { SessionService } from "./session.service.ts";

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AppRequest>();
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== "string" || token === "") {
      throw new UnauthorizedException("Please log in.");
    }

    const user = await this.sessions.findUserBySessionToken(token);
    if (user === null) {
      throw new UnauthorizedException("Your session has expired. Please log in again.");
    }
    request.user = user;
    return true;
  }
}
