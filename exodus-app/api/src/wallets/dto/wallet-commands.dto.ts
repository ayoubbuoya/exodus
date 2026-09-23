// Request bodies for the custodial wallet commands.
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { DECIMAL_PATTERN } from "../../config/environment.ts";

// The simulated tokens a client can hold and send (issued by our demo issuers, not by Circle).
export const INSTRUMENTS = ["USYC", "USDC"] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

// A Canton party id: "<hint>::1220<64 hex>", for example
// "client-7f3a9c21e4b0::1220ab...". The part after "::" is the participant's key fingerprint.
const PARTY_ID_PATTERN = /^[A-Za-z0-9_\- ]{1,185}::1220[0-9a-f]{64}$/;

const AMOUNT_MESSAGE = "Enter a positive amount with at most 10 decimals, for example 100 or 12.5.";

export class SubscribeDto {
  @ApiProperty({ example: "500", description: "USDC to pay; the fund returns USYC at the current price" })
  @Matches(DECIMAL_PATTERN, { message: AMOUNT_MESSAGE })
  usdcAmount!: string;
}

export class TransferDto {
  // A party id, not an email: looking clients up by email would let anyone
  // find out who is a client (the same privacy goal as the access passes).
  @ApiProperty({ example: "client-5b21aa90c3d1::1220" + "ab".repeat(32) })
  @IsString()
  @MaxLength(255)
  @Matches(PARTY_ID_PATTERN, { message: "Enter a valid Canton party id (name::1220...)." })
  receiverPartyId!: string;

  @ApiProperty({ enum: INSTRUMENTS, example: "USYC" })
  @IsIn(INSTRUMENTS)
  instrument!: Instrument;

  @ApiProperty({ example: "50" })
  @Matches(DECIMAL_PATTERN, { message: AMOUNT_MESSAGE })
  amount!: string;
}

export const MAX_ACTIVITY_ROWS = 100;

// GET /api/wallet/activity?limit=20: the newest `limit` rows. A capped list
// rather than pages: the dashboard only shows the recent movements.
export class ActivityQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: MAX_ACTIVITY_ROWS })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ACTIVITY_ROWS)
  limit: number = 20;
}
