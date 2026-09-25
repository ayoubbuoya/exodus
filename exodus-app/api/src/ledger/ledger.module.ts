import { Global, Module } from "@nestjs/common";
import { LedgerService } from "./ledger.service.ts";

// Global, like the database: several modules talk to the ledger.
@Global()
@Module({
  providers: [LedgerService],
  exports: [LedgerService],
})
export class LedgerModule {}
