// The admin's review of access applications: list them, approve (which sets
// up the client's custodial wallet on the ledger) or reject.
import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { toPage, type Page } from "../common/pagination.dto.ts";
import type { AuthUser } from "../common/request-context.ts";
import { ApplicationStatus, Prisma } from "../generated/prisma/client.ts";
import { PrismaService } from "../prisma/prisma.service.ts";
import { WalletProvisioningService } from "../wallets/wallet-provisioning.service.ts";
import type { ListApplicationsQueryDto, RejectApplicationDto } from "./dto/admin-applications.dto.ts";

// What the admin table shows per row: "Alice Martin, alice@example.com, FR, PENDING, 2 h ago".
const REVIEW_FIELDS = {
  id: true,
  fullName: true,
  country: true,
  acceptedSimulationTerms: true,
  status: true,
  rejectionReason: true,
  reviewedAt: true,
  createdAt: true,
  user: { select: { id: true, email: true, wallet: { select: { partyId: true } } } },
} satisfies Prisma.AccessApplicationSelect;

export type ApplicationForReview = Prisma.AccessApplicationGetPayload<{ select: typeof REVIEW_FIELDS }>;

@Injectable()
export class AdminApplicationsService {
  private readonly logger = new Logger(AdminApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: WalletProvisioningService,
  ) {}

  // Oldest first, so the admin works through the queue in order.
  async list(query: ListApplicationsQueryDto): Promise<Page<ApplicationForReview>> {
    const where: Prisma.AccessApplicationWhereInput = query.status === undefined ? {} : { status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.accessApplication.findMany({
        where,
        select: REVIEW_FIELDS,
        orderBy: { createdAt: "asc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.accessApplication.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  // Approve Alice:
  // 1. on the ledger: her party, ledger user and ClientAccess pass (WalletProvisioningService);
  // 2. in the database, in one transaction: her wallet row + application APPROVED.
  // If step 1 fails, nothing is saved and the admin can click Approve again.
  async approve(applicationId: string, admin: AuthUser): Promise<ApplicationForReview> {
    const application = await this.findPending(applicationId);
    const wallet = await this.provisioning.provision(application.userId);

    const [, approved] = await this.prisma.$transaction([
      this.prisma.wallet.upsert({
        where: { userId: application.userId },
        create: { userId: application.userId, ...wallet },
        update: wallet,
      }),
      this.prisma.accessApplication.update({
        where: { id: applicationId },
        data: { status: ApplicationStatus.APPROVED, reviewedById: admin.id, reviewedAt: new Date() },
        select: REVIEW_FIELDS,
      }),
    ]);
    this.logger.log(`Admin ${admin.id} approved application ${applicationId} (party ${wallet.partyId})`);
    return approved;
  }

  // Only a PENDING application can be rejected. The conditional update makes
  // "check status + change it" one step, so it cannot race with an approval.
  async reject(applicationId: string, dto: RejectApplicationDto, admin: AuthUser): Promise<ApplicationForReview> {
    const updated = await this.prisma.accessApplication.updateMany({
      where: { id: applicationId, status: ApplicationStatus.PENDING },
      data: {
        status: ApplicationStatus.REJECTED,
        rejectionReason: dto.reason ?? null,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });
    if (updated.count === 0) {
      await this.findPending(applicationId); // throws the right 404 / 409
    }
    this.logger.log(`Admin ${admin.id} rejected application ${applicationId}`);
    return this.prisma.accessApplication.findUniqueOrThrow({ where: { id: applicationId }, select: REVIEW_FIELDS });
  }

  private async findPending(applicationId: string): Promise<{ userId: string }> {
    const application = await this.prisma.accessApplication.findUnique({
      where: { id: applicationId },
      select: { userId: true, status: true },
    });
    if (application === null) {
      throw new NotFoundException("Application not found.");
    }
    if (application.status !== ApplicationStatus.PENDING) {
      throw new ConflictException(`This application is already ${application.status.toLowerCase()}.`);
    }
    return application;
  }
}
