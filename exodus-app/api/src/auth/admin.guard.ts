// Lets only admins through. Use it together with the global SessionGuard, which
// runs first and puts the user on the request.
import { ForbiddenException, Injectable, Logger, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { AppRequest } from "../common/request-context.ts";
import { Role } from "../generated/prisma/client.ts";

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (request.user?.role === Role.ADMIN) {
      return true;
    }
    // SECURITY: a client probing admin routes is worth a log line.
    this.logger.warn(`User ${request.user?.id ?? "unknown"} was denied ${request.method} ${request.originalUrl}`);
    throw new ForbiddenException("Only admins can do this.");
  }
}
