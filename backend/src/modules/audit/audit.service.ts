import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { paginatedResponse, type PaginatedResponse } from "../../common/dto/paginated-response.dto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditFilterDto } from "./dto/audit-filter.dto";

/**
 * Common entity-type and action constants. Strings are fine in the schema,
 * but keeping a referenced list here makes audit queries less error-prone
 * and keeps the @RequirePermission story for filters consistent.
 */
export const AuditEntityType = {
  COMPANY: "COMPANY",
  ACCOUNT: "ACCOUNT",
  INVOICE: "INVOICE",
  BILL: "BILL",
  PAYMENT: "PAYMENT",
  JOURNAL_ENTRY: "JOURNAL_ENTRY",
  USER_ACCESS: "USER_ACCESS",
  FISCAL_COUPON: "FISCAL_COUPON",
} as const;

export const AuditAction = {
  CREATED: "CREATED",
  UPDATED: "UPDATED",
  DEACTIVATED: "DEACTIVATED",
  ISSUED: "ISSUED",
  VOIDED: "VOIDED",
  POSTED: "POSTED",
  FISCALIZED: "FISCALIZED",
  ACCESS_GRANTED: "ACCESS_GRANTED",
  ROLE_CHANGED: "ROLE_CHANGED",
  ACCESS_REVOKED: "ACCESS_REVOKED",
} as const;

export interface AuditLogParams {
  companyId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append an audit-log row. Failure is SWALLOWED — auditing must never break
   * the calling business flow. If a Prisma transaction client is passed, the
   * row is written inside that transaction (commits/rolls back together).
   */
  async log(params: AuditLogParams, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    try {
      await client.auditLog.create({
        data: {
          companyId: params.companyId,
          userId: params.userId,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          beforeJson:
            params.before == null ? Prisma.JsonNull : (params.before as Prisma.InputJsonValue),
          afterJson:
            params.after == null ? Prisma.JsonNull : (params.after as Prisma.InputJsonValue),
          ipAddress: params.ipAddress,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to write audit log [${params.entityType}/${params.action} on ${params.entityId}]: ${
          (err as Error).message
        }`,
      );
      // Intentionally do NOT re-throw.
    }
  }

  /** Read-only listing for the audit-log viewer. Filters + pagination. */
  async findAll(companyId: string, filters: AuditFilterDto): Promise<PaginatedResponse<unknown>> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = { companyId };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.occurredFrom || filters.occurredTo) {
      where.occurredAt = {
        ...(filters.occurredFrom ? { gte: filters.occurredFrom } : {}),
        ...(filters.occurredTo ? { lte: filters.occurredTo } : {}),
      };
    }

    const orderBy: Prisma.AuditLogOrderByWithRelationInput = {
      occurredAt: filters.sortOrder ?? "desc",
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginatedResponse(data, total, page, limit);
  }
}
