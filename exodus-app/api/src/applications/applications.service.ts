// A client's own access application: read it, submit it, or submit again after a rejection.
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ApplicationStatus, Prisma } from "../generated/prisma/client.ts";
import { PrismaService } from "../prisma/prisma.service.ts";
import type { SubmitApplicationDto } from "./dto/submit-application.dto.ts";

// The fields a client may see about their own application (not who reviewed it).
const OWN_APPLICATION_FIELDS = {
  id: true,
  status: true,
  fullName: true,
  country: true,
  rejectionReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AccessApplicationSelect;

export type OwnApplication = Prisma.AccessApplicationGetPayload<{ select: typeof OWN_APPLICATION_FIELDS }>;

const UNIQUE_VIOLATION = "P2002";

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getOwn(userId: string): Promise<OwnApplication> {
    const application = await this.prisma.accessApplication.findUnique({
      where: { userId },
      select: OWN_APPLICATION_FIELDS,
    });
    if (application === null) {
      throw new NotFoundException("You have not applied for access yet.");
    }
    return application;
  }

  // First submission creates the application. After a rejection, the same row is
  // reused and goes back to PENDING (the old review is cleared).
  // A PENDING or APPROVED application cannot be changed.
  async submit(userId: string, dto: SubmitApplicationDto): Promise<OwnApplication> {
    const existing = await this.prisma.accessApplication.findUnique({
      where: { userId },
      select: { status: true },
    });
    if (existing?.status === ApplicationStatus.PENDING) {
      throw new ConflictException("Your application is already being reviewed.");
    }
    if (existing?.status === ApplicationStatus.APPROVED) {
      throw new ConflictException("Your application is already approved.");
    }

    const fields = {
      fullName: dto.fullName,
      country: dto.country,
      acceptedSimulationTerms: dto.acceptsSimulatedTokens,
    };
    const application = existing === null ? await this.create(userId, fields) : await this.resubmit(userId, fields);
    this.logger.log(`User ${userId} submitted an access application`);
    return application;
  }

  private async create(
    userId: string,
    fields: { fullName: string; country: string; acceptedSimulationTerms: boolean },
  ): Promise<OwnApplication> {
    try {
      return await this.prisma.accessApplication.create({
        data: { userId, ...fields },
        select: OWN_APPLICATION_FIELDS,
      });
    } catch (error) {
      // Two submits at the same moment: the second one hits the unique user_id.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_VIOLATION) {
        throw new ConflictException("Your application is already being reviewed.");
      }
      throw error;
    }
  }

  private async resubmit(
    userId: string,
    fields: { fullName: string; country: string; acceptedSimulationTerms: boolean },
  ): Promise<OwnApplication> {
    return this.prisma.accessApplication.update({
      where: { userId },
      data: {
        ...fields,
        status: ApplicationStatus.PENDING,
        reviewedById: null,
        reviewedAt: null,
        rejectionReason: null,
      },
      select: OWN_APPLICATION_FIELDS,
    });
  }
}
