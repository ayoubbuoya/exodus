// Request bodies and route params for private PT trading (RFQ).
import { ApiProperty } from "@nestjs/swagger";
import { IsIn, Matches } from "class-validator";
import type { RfqSide } from "@exodus/ledger";
import { CONTRACT_ID_PATTERN, MARKET_ID_PATTERN, TOKEN_AMOUNT_MESSAGE, TOKEN_AMOUNT_PATTERN } from "./markets.dto.ts";

// From the client's side, the same words as the Daml contract (Exodus.Rfq):
// BuyPt = I buy PT and pay USDC; SellPt = I sell PT and get USDC.
export const RFQ_SIDES: RfqSide[] = ["BuyPt", "SellPt"];

export class CreateQuoteRequestDto {
  @ApiProperty({ example: "PT-USYC-APR2027" })
  @Matches(MARKET_ID_PATTERN, { message: "Not a valid market id." })
  marketId!: string;

  @ApiProperty({ enum: RFQ_SIDES, example: "BuyPt" })
  @IsIn(RFQ_SIDES)
  side!: RfqSide;

  @ApiProperty({ example: "500", description: "How much PT to buy or sell" })
  @Matches(TOKEN_AMOUNT_PATTERN, { message: TOKEN_AMOUNT_MESSAGE })
  ptAmount!: string;
}

export class QuoteRequestParamsDto {
  @ApiProperty({ example: "00" + "ab".repeat(34) })
  @Matches(CONTRACT_ID_PATTERN, { message: "Not a valid quote request id." })
  requestId!: string;
}

export class QuoteParamsDto {
  @ApiProperty({ example: "00" + "ab".repeat(34) })
  @Matches(CONTRACT_ID_PATTERN, { message: "Not a valid quote id." })
  quoteId!: string;
}
