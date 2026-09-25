// Request bodies for the dealer desk (admins run the house dealer, Bank).
import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsNumber, Matches, Max, Min } from "class-validator";
import { DECIMAL_PATTERN } from "../../config/environment.ts";

// A PT price in USDC: from 0.000001 to 1, at most 6 decimals (a PT never
// costs more than the 1 USD it pays at maturity). Examples: "0.975", "1".
// "0" passes this pattern; the ledger client then refuses it with a clear message.
const PRICE_PATTERN = /^(0(\.\d{1,6})?|1(\.0{1,6})?)$/;

export class ManualQuoteDto {
  @ApiProperty({ example: "0.975", description: "USDC per PT, for example 0.975 (above 0, at most 1)" })
  @Matches(PRICE_PATTERN, { message: "Enter a price above 0 and at most 1, with at most 6 decimals, for example 0.975." })
  price!: string;
}

// PUT /api/dealer/settings: every field is sent (a full replace).
// Percentages are numbers: 5.2 means 5.2 %.
export class UpdateDealerSettingsDto {
  @ApiProperty({ example: true, description: "Answer RFQs automatically; when false, they wait for an admin" })
  @IsBoolean()
  autoQuote!: boolean;

  @ApiProperty({ example: 0, description: "Target APY = underlying 30-day APY + this, in percent points" })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(-20)
  @Max(20)
  apyOffsetPercent!: number;

  @ApiProperty({ example: 5.2, description: "Target APY while there are fewer than 7 demo days of price history" })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(50)
  fallbackApyPercent!: number;

  @ApiProperty({ example: 0.1, description: "Half the gap between buy and sell, in APY points" })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(5)
  spreadPercent!: number;

  @ApiProperty({ example: "1000", description: "The bot declines bigger requests" })
  @Matches(DECIMAL_PATTERN, { message: "Enter a positive amount, for example 1000." })
  maxPtPerQuote!: string;

  @ApiProperty({ example: 60, description: "How long a quote is firm, in seconds" })
  @IsInt()
  @Min(10)
  @Max(600)
  quoteValidSeconds!: number;
}
