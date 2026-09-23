import { Global, Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service.ts";

// Global: every feature module needs the database, so they get it without importing this module.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
