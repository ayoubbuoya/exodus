// Accounts: sign up, check a password, and the "who am I" profile.
import { ConflictException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import * as argon2 from "argon2";
import type { AuthUser } from "../common/request-context.ts";
import { Prisma, type ApplicationStatus } from "../generated/prisma/client.ts";
import { PrismaService } from "../prisma/prisma.service.ts";
import type { LoginDto, SignupDto } from "./dto/credentials.dto.ts";

// What the web app needs to decide where to send the user:
// no application -> /onboarding form; PENDING/REJECTED -> status page; wallet -> /app.
export type Profile = AuthUser & {
  application: {
    status: ApplicationStatus;
    fullName: string;
    country: string;
    rejectionReason: string | null;
    createdAt: Date;
  } | null;
  wallet: { partyId: string } | null;
};

// Prisma's error code for "unique constraint failed" (here: the email is taken).
const UNIQUE_VIOLATION = "P2002";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async signup(dto: SignupDto): Promise<AuthUser> {
    // Argon2id is the recommended password hash: slow and memory-hard on purpose,
    // so a stolen hash is very expensive to brute-force.
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    try {
      const user = await this.prisma.user.create({
        data: { email: dto.email, passwordHash },
        select: { id: true, email: true, role: true },
      });
      this.logger.log(`New account ${user.id}`);
      return user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException("An account with this email already exists.");
      }
      throw error;
    }
  }

  // Returns the user if the email and password match. The same message for an
  // unknown email and a wrong password, so login does not reveal which emails exist.
  async verifyCredentials(dto: LoginDto, ip: string | undefined): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true, role: true, passwordHash: true },
    });
    const passwordMatches = user !== null && (await argon2.verify(user.passwordHash, dto.password));
    if (user === null || !passwordMatches) {
      this.logger.warn(`Failed login from ${ip ?? "unknown IP"}`);
      throw new UnauthorizedException("Wrong email or password.");
    }
    this.logger.log(`User ${user.id} logged in`);
    return { id: user.id, email: user.email, role: user.role };
  }

  async getProfile(user: AuthUser): Promise<Profile> {
    const found = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        application: {
          select: { status: true, fullName: true, country: true, rejectionReason: true, createdAt: true },
        },
        wallet: { select: { partyId: true } },
      },
    });
    return { ...user, application: found.application, wallet: found.wallet };
  }
}
