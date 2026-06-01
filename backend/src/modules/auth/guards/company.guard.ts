import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import type { AuthenticatedUser } from "../../../common/decorators/current-user.decorator";
import type { CompanyContext } from "../../../common/decorators/current-company.decorator";
import { PrismaService } from "../../../prisma/prisma.service";

const COMPANY_HEADER = "x-company-id";

/**
 * Resolves the active company for the request.
 *
 * Precedence:
 *   1. `X-Company-Id` header — must match a UserCompanyAccess for the user.
 *   2. The user's `is_default` UserCompanyAccess.
 *   3. Otherwise → 400.
 *
 * The resolved `{ companyId, roleCode }` is attached to `request.company` for
 * downstream consumption via `@CurrentCompany()`.
 *
 * Applied per-controller. Not global, because /auth/* and a handful of /users/*
 * endpoints don't need a company context.
 */
@Injectable()
export class CompanyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser; company?: CompanyContext }>();

    const user = request.user;
    if (!user) {
      // Should be unreachable — JwtAuthGuard runs first.
      throw new ForbiddenException("Not authenticated");
    }

    const headerValue = request.headers[COMPANY_HEADER];
    const requestedCompanyId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    const access = requestedCompanyId
      ? await this.prisma.userCompanyAccess.findUnique({
          where: { userId_companyId: { userId: user.userId, companyId: requestedCompanyId } },
          include: { role: { select: { code: true } } },
        })
      : await this.prisma.userCompanyAccess.findFirst({
          where: { userId: user.userId, isDefault: true },
          include: { role: { select: { code: true } } },
        });

    if (!access) {
      if (requestedCompanyId) {
        throw new ForbiddenException("No access to the requested company");
      }
      throw new BadRequestException(
        "No active company. Send X-Company-Id header or set a default company.",
      );
    }

    request.company = { companyId: access.companyId, roleCode: access.role.code };
    return true;
  }
}
