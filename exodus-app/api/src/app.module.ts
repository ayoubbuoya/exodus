// The root module: wires config, database, ledger, scheduling, rate limiting,
// the global login check, and the feature modules.
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AdminModule } from "./admin/admin.module.ts";
import { ApplicationsModule } from "./applications/applications.module.ts";
import { AuthModule } from "./auth/auth.module.ts";
import { SessionGuard } from "./auth/session.guard.ts";
import { validateEnvironment } from "./config/environment.ts";
import { LedgerModule } from "./ledger/ledger.module.ts";
import { MarketsModule } from "./markets/markets.module.ts";
import { PricesModule } from "./prices/prices.module.ts";
import { PrismaModule } from "./prisma/prisma.module.ts";
import { WalletsModule } from "./wallets/wallets.module.ts";

// Default rate limit for every route: 120 requests per minute per IP.
// Login and sign-up set stricter limits with @Throttle().
const DEFAULT_RATE_LIMIT = { ttl: 60_000, limit: 120 };

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    ThrottlerModule.forRoot({
      throttlers: [DEFAULT_RATE_LIMIT],
      // Shown to the user (the default is "ThrottlerException: Too Many Requests").
      errorMessage: "Too many attempts. Please wait a minute and try again.",
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    LedgerModule,
    AuthModule,
    ApplicationsModule,
    AdminModule,
    WalletsModule,
    PricesModule,
    MarketsModule,
  ],
  providers: [
    // Global guards run in this order: rate limit first, then the login check.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
