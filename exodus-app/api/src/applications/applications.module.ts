import { Module } from "@nestjs/common";
import { ApplicationsController } from "./applications.controller.ts";
import { ApplicationsService } from "./applications.service.ts";

@Module({
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
})
export class ApplicationsModule {}
