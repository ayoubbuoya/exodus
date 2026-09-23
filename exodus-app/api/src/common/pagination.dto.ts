// Shared ?page=&limit= query parameters for list endpoints, and the list response shape.
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";

export const MAX_PAGE_SIZE = 100;

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: MAX_PAGE_SIZE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = 20;
}

// Example: { items: [...20 applications], total: 45, page: 1, limit: 20, totalPages: 3 }
export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function toPage<T>(items: T[], total: number, query: PaginationQueryDto): Page<T> {
  return { items, total, page: query.page, limit: query.limit, totalPages: Math.ceil(total / query.limit) };
}
