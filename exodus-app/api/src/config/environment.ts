// The settings the API needs, read from environment variables (or .env).
//
// We check them all at startup: a typo such as LEDGER_URL=localhost:7575 should
// stop the API right away with a clear message, not fail later in the middle
// of Alice's approval. See .env.example for what each value means.
import { plainToInstance, Transform } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Matches, Max, Min, validateSync } from "class-validator";

// A positive Daml Decimal as text, for example "100.0" (at most 10 decimals, like Numeric 10).
export const DECIMAL_PATTERN = /^\d{1,18}(\.\d{1,10})?$/;

export class EnvironmentVariables {
  @Matches(/^postgres(ql)?:\/\//, { message: "DATABASE_URL must start with postgresql://" })
  DATABASE_URL!: string;

  @IsUrl({ require_tld: false, protocols: ["http", "https"], require_protocol: true })
  LEDGER_URL: string = "http://localhost:7575";

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsInt()
  @Min(1)
  SESSION_TTL_HOURS: number = 168;

  // Environment variables are always text, so "false" must be turned into false
  // by hand (Boolean("false") would be true).
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  COOKIE_SECURE: boolean = false;

  @Matches(DECIMAL_PATTERN, { message: "FAUCET_AMOUNT must be a decimal such as 100.0" })
  FAUCET_AMOUNT: string = "100.0";

  @IsInt()
  @Min(0)
  FAUCET_COOLDOWN_HOURS: number = 24;

  @IsInt()
  @Min(1)
  PRICE_POLL_SECONDS: number = 5;

  @IsInt()
  @Min(5)
  WALLET_CHECK_SECONDS: number = 30;

  // Only used by `npm run db:seed`, so optional for the API itself.
  @IsOptional()
  @IsString()
  ADMIN_EMAIL?: string;

  @IsOptional()
  @IsString()
  ADMIN_PASSWORD?: string;
}

// Called by ConfigModule with the raw variables. Returns typed values
// (numbers as numbers) or throws one error that lists every problem.
export function validateEnvironment(raw: Record<string, unknown>): EnvironmentVariables {
  const environment = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: true });
  const errors = validateSync(environment);
  if (errors.length > 0) {
    const problems = errors.map((error) => `- ${Object.values(error.constraints ?? {}).join(", ")}`);
    throw new Error(`Invalid environment variables (see .env.example):\n${problems.join("\n")}`);
  }
  return environment;
}
