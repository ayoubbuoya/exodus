// Starts the Exodus API on http://localhost:3000/api (Swagger docs at /api/docs).
//
// The web app does not call this port directly: Vite forwards /api/* from
// http://localhost:5173, so the browser sees one origin (no CORS, simple cookies).
import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.ts";
import { SESSION_COOKIE } from "./auth/session.constants.ts";
import { AllExceptionsFilter } from "./common/all-exceptions.filter.ts";
import { ResponseEnvelopeInterceptor } from "./common/response-envelope.ts";
import { createValidationPipe } from "./common/validation.ts";
import type { EnvironmentVariables } from "./config/environment.ts";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  // Requests arrive through a proxy that adds X-Forwarded-For: Vite on this
  // machine, or `vite preview` / nginx in another container (a private address)
  // with Docker. Trusting only those gives us the real client IP for rate limits,
  // without letting a remote caller fake their IP with that header. The API port
  // itself must never be public.
  app.set("trust proxy", ["loopback", "uniquelocal"]);
  app.setGlobalPrefix("api");

  // Security headers (nosniff, frame deny, HSTS, CSP, ...).
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor(app.get(Reflector)));
  app.enableShutdownHooks();

  setUpSwagger(app);

  const port = config.get("PORT", { infer: true });
  await app.listen(port);
  new Logger("Bootstrap").log(`Exodus API on http://localhost:${port}/api (docs: /api/docs)`);
}

function setUpSwagger(app: NestExpressApplication): void {
  const document = new DocumentBuilder()
    .setTitle("Exodus API")
    .setDescription(
      "Accounts, access applications, admin approval, custodial Canton wallets, the test USDC faucet " +
        "and the USYC price history. USYC and USDC here are simulated tokens, not Circle's.",
    )
    .setVersion("0.0.1")
    .addCookieAuth(SESSION_COOKIE)
    .build();
  SwaggerModule.setup("api/docs", app, () => SwaggerModule.createDocument(app, document));
}

bootstrap().catch((error: unknown) => {
  new Logger("Bootstrap").error("The API could not start", error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
