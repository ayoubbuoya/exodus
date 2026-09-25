import { Module } from "@nestjs/common";
import { AdminGuard } from "./admin.guard.ts";
import { AuthController } from "./auth.controller.ts";
import { AuthService } from "./auth.service.ts";
import { SessionService } from "./session.service.ts";

// SessionService is exported for the global SessionGuard (registered in AppModule).
@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionService, AdminGuard],
  exports: [SessionService, AdminGuard],
})
export class AuthModule {}
