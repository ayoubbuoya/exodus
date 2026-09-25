// /api/applications/me: the logged-in user's own access application.
import { Body, Controller, Get, Put } from "@nestjs/common";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { SESSION_COOKIE } from "../auth/session.constants.ts";
import { CurrentUser, type AuthUser } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import { ApplicationsService, type OwnApplication } from "./applications.service.ts";
import { SubmitApplicationDto } from "./dto/submit-application.dto.ts";

@ApiTags("applications")
@ApiCookieAuth(SESSION_COOKIE)
@Controller("applications/me")
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  @ResponseMessage("Application loaded")
  @ApiOperation({ summary: "My access application and its status" })
  @ApiOkResponse({ description: "The application" })
  @ApiNotFoundResponse({ description: "Not applied yet" })
  async getOwn(@CurrentUser() user: AuthUser): Promise<OwnApplication> {
    return this.applications.getOwn(user.id);
  }

  // PUT because each user has exactly one application: this creates it, or
  // replaces it after a rejection.
  @Put()
  @ResponseMessage("Application submitted")
  @ApiOperation({ summary: "Submit my access application (again, after a rejection)" })
  @ApiOkResponse({ description: "The application, now PENDING" })
  @ApiConflictResponse({ description: "Already pending or approved" })
  async submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitApplicationDto): Promise<OwnApplication> {
    return this.applications.submit(user.id, dto);
  }
}
