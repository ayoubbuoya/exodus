// /api/auth: sign up, log in, log out, and "who am I".
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../common/public.decorator.ts";
import { CurrentUser, type AuthUser } from "../common/request-context.ts";
import { ResponseMessage } from "../common/response-envelope.ts";
import type { EnvironmentVariables } from "../config/environment.ts";
import { AuthService, type Profile } from "./auth.service.ts";
import { LoginDto, SignupDto } from "./dto/credentials.dto.ts";
import { SESSION_COOKIE, SESSION_COOKIE_PATH } from "./session.constants.ts";
import { SessionService, type NewSession } from "./session.service.ts";

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  private readonly secureCookie: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.secureCookie = config.get("COOKIE_SECURE", { infer: true });
  }

  // Creates the account and logs the user in right away (one step less for Alice).
  @Public()
  @Throttle({ default: { limit: 10, ttl: ONE_HOUR_MS } })
  @Post("signup")
  @ResponseMessage("Account created")
  @ApiOperation({ summary: "Create an account (email + password) and log in" })
  @ApiCreatedResponse({ description: "Account created; the session cookie is set" })
  @ApiConflictResponse({ description: "The email is already taken" })
  @ApiTooManyRequestsResponse({ description: "More than 10 sign-ups per hour from this IP" })
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) response: Response): Promise<AuthUser> {
    const user = await this.auth.signup(dto);
    this.setSessionCookie(response, await this.sessions.createSession(user.id));
    return user;
  }

  // Brute-force protection: at most 5 attempts per minute per IP.
  @Public()
  @Throttle({ default: { limit: 5, ttl: ONE_MINUTE_MS } })
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Logged in")
  @ApiOperation({ summary: "Log in with email + password" })
  @ApiOkResponse({ description: "Logged in; the session cookie is set" })
  @ApiUnauthorizedResponse({ description: "Wrong email or password" })
  @ApiTooManyRequestsResponse({ description: "More than 5 attempts per minute from this IP" })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthUser> {
    const user = await this.auth.verifyCredentials(dto, request.ip);
    this.setSessionCookie(response, await this.sessions.createSession(user.id));
    return user;
  }

  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: "Log out (ends this session)" })
  @ApiNoContentResponse({ description: "Logged out; the cookie is cleared" })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    const token: unknown = request.cookies?.[SESSION_COOKIE];
    if (typeof token === "string") {
      await this.sessions.deleteSession(token);
    }
    response.clearCookie(SESSION_COOKIE, { path: SESSION_COOKIE_PATH });
  }

  @Get("me")
  @ResponseMessage("Profile loaded")
  @ApiCookieAuth(SESSION_COOKIE)
  @ApiOperation({ summary: "The logged-in user, their application status and wallet party" })
  @ApiOkResponse({ description: "The profile" })
  @ApiUnauthorizedResponse({ description: "Not logged in" })
  async me(@CurrentUser() user: AuthUser): Promise<Profile> {
    return this.auth.getProfile(user);
  }

  // httpOnly: JavaScript in the page cannot read it (protects against XSS stealing it).
  // sameSite "lax": other sites cannot make the browser send it on POSTs (CSRF).
  // The web app reaches the API on its own origin through the Vite proxy, so "lax" is enough.
  private setSessionCookie(response: Response, session: NewSession): void {
    response.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.secureCookie,
      path: SESSION_COOKIE_PATH,
      expires: session.expiresAt,
    });
  }
}
