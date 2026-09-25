// /api/admin/applications: the admin's review queue.
// Approve and reject are sub-resources ("an approval of application X") rather
// than a PATCH of `status`, because approving does much more than change a field.
import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AdminGuard } from "../auth/admin.guard.ts";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import type { Page } from "../common/pagination.dto.ts";
import { CurrentUser, type AuthUser } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { AdminApplicationsService, type ApplicationForReview } from "./admin-applications.service.ts";
import { ListApplicationsQueryDto, RejectApplicationDto } from "./dto/admin-applications.dto.ts";

@ApiTags("admin")
@ApiCookieAuth(SESSION_COOKIE)
@ApiForbiddenResponse({ description: "Not an admin" })
@UseGuards(AdminGuard)
@Controller("admin/applications")
export class AdminApplicationsController {
  constructor(private readonly applications: AdminApplicationsService) {}

  @Get()
  @ResponseMessage("Applications loaded")
  @ApiOperation({ summary: "List access applications (paginated, optional status filter)" })
  @ApiOkResponse({ description: "{ items, total, page, limit, totalPages }" })
  async list(@Query() query: ListApplicationsQueryDto): Promise<Page<ApplicationForReview>> {
    return this.applications.list(query);
  }

  @Post(":id/approval")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Application approved; wallet and access pass created")
  @ApiOperation({ summary: "Approve: allocate the client's party + ledger user and create their ClientAccess pass" })
  @ApiOkResponse({ description: "The approved application" })
  @ApiNotFoundResponse({ description: "No such application" })
  @ApiConflictResponse({ description: "Not pending, or already being approved" })
  @ApiServiceUnavailableResponse({ description: "The ledger is down or not bootstrapped" })
  async approve(
    @Param("id", ParseUUIDPipe) applicationId: string,
    @CurrentUser() admin: AuthUser,
  ): Promise<ApplicationForReview> {
    return this.applications.approve(applicationId, admin);
  }

  @Post(":id/rejection")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Application rejected")
  @ApiOperation({ summary: "Reject a pending application (the client may apply again)" })
  @ApiOkResponse({ description: "The rejected application" })
  @ApiNotFoundResponse({ description: "No such application" })
  @ApiConflictResponse({ description: "Not pending" })
  async reject(
    @Param("id", ParseUUIDPipe) applicationId: string,
    @Body() dto: RejectApplicationDto,
    @CurrentUser() admin: AuthUser,
  ): Promise<ApplicationForReview> {
    return this.applications.reject(applicationId, dto, admin);
  }
}
