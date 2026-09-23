// The database client, shared by every service through dependency injection.
//
// Prisma 7 talks to PostgreSQL through a "driver adapter" (here the `pg`
// package) instead of a bundled query engine, so we pass one in.
import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import type { EnvironmentVariables } from "../config/environment.ts";
import { PrismaClient } from "../generated/prisma/client.ts";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<EnvironmentVariables, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get("DATABASE_URL", { infer: true }) }) });
  }

  // Connect at startup, so a wrong DATABASE_URL fails right away.
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
