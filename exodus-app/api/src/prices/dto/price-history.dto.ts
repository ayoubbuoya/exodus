import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export const MAX_PRICE_POINTS = 2000;

// GET /api/prices/usyc?limit=500: the newest `limit` points, oldest first (ready to draw).
// A capped `limit` instead of pages: a chart wants one series, and the list is
// small (one point per oracle step, heartbeats are not stored).
export class PriceHistoryQueryDto {
  @ApiPropertyOptional({ default: 500, minimum: 1, maximum: MAX_PRICE_POINTS })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PRICE_POINTS)
  limit: number = 500;
}
