import { Module } from "@nestjs/common";
import { PriceRecorderService } from "./price-recorder.service.ts";
import { PricesController } from "./prices.controller.ts";
import { PricesService } from "./prices.service.ts";

@Module({
  controllers: [PricesController],
  providers: [PricesService, PriceRecorderService],
  // The markets module reads the underlying APY for the dealer's prices.
  exports: [PricesService],
})
export class PricesModule {}
