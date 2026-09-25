// Query and body DTOs for the admin's application review.
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination.dto.ts";
import { ApplicationStatus } from "../../generated/prisma/client.ts";

// GET /api/admin/applications?status=PENDING&page=1&limit=20
export class ListApplicationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ApplicationStatus, description: "Only this status (default: all)" })
  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}

export class RejectApplicationDto {
  // Shown to the applicant on their status page, so keep it polite.
  @ApiPropertyOptional({ example: "Please use your full legal name.", maxLength: 500 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}
