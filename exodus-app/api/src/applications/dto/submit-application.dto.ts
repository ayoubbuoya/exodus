// The access form (kept light on purpose): name, country, and "I understand the tokens are simulated".
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { Equals, IsISO31661Alpha2, IsString, Length } from "class-validator";

export class SubmitApplicationDto {
  @ApiProperty({ example: "Alice Martin", minLength: 2, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  fullName!: string;

  @ApiProperty({ example: "FR", description: "ISO 3166-1 alpha-2 country code" })
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim().toUpperCase() : value))
  @IsISO31661Alpha2({ message: "Pick a country from the list." })
  country!: string;

  // Must be exactly true: "USYC" and "USDC" here are simulations, not Circle's tokens.
  @ApiProperty({ example: true })
  @Equals(true, { message: "Please confirm that you understand these are simulated test tokens." })
  acceptsSimulatedTokens!: boolean;
}
