import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.ts";
import { WalletsModule } from "../wallets/wallets.module.ts";
import { AdminApplicationsController } from "./admin-applications.controller.ts";
import { AdminApplicationsService } from "./admin-applications.service.ts";

@Module({
  imports: [AuthModule, WalletsModule],
  controllers: [AdminApplicationsController],
  providers: [AdminApplicationsService],
})
export class AdminModule {}
