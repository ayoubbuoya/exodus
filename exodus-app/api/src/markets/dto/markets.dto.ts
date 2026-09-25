// Request bodies and route params for the markets (the Pendle part):
// split, merge, claim, PT redeem, and cancelling an open request.
import { ApiProperty } from "@nestjs/swagger";
import { Matches } from "class-validator";

// A market id, for example "PT-USYC-APR2027".
export const MARKET_ID_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

// A Canton contract id: hex text such as "00a1b2...". Checking it here keeps
// odd input away from the ledger.
export const CONTRACT_ID_PATTERN = /^[0-9a-f]{2,512}$/;

// PT, YT and USYC amounts: positive, at most 6 decimals (like every holding;
// the contracts refuse more). Examples: "100", "12.5", "0.000001".
export const TOKEN_AMOUNT_PATTERN = /^\d{1,18}(\.\d{1,6})?$/;
export const TOKEN_AMOUNT_MESSAGE = "Enter a positive amount with at most 6 decimals, for example 100 or 12.5.";

export class MarketParamsDto {
  @ApiProperty({ example: "PT-USYC-APR2027" })
  @Matches(MARKET_ID_PATTERN, { message: "Not a valid market id." })
  marketId!: string;
}

export class SplitDto {
  @ApiProperty({ example: "1000", description: "USYC to split; you get usycAmount * index PT and YT" })
  @Matches(TOKEN_AMOUNT_PATTERN, { message: TOKEN_AMOUNT_MESSAGE })
  usycAmount!: string;
}

export class MergeDto {
  @ApiProperty({ example: "100", description: "PT AND YT to merge back into USYC (amount / lastIndex USYC)" })
  @Matches(TOKEN_AMOUNT_PATTERN, { message: TOKEN_AMOUNT_MESSAGE })
  amount!: string;
}

// DELETE /api/portfolio/requests/:requestId (an open claim, PT redeem or merge).
export class MarketRequestParamsDto {
  @ApiProperty({ example: "00" + "ab".repeat(34) })
  @Matches(CONTRACT_ID_PATTERN, { message: "Not a valid request id." })
  requestId!: string;
}
