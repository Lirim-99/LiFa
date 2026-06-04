import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import type { AuthenticatedUser } from "../../common/decorators/current-user.decorator";
import type { CompanyContext } from "../../common/decorators/current-company.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import {
  REQUIRE_PERMISSION_KEY,
  type RequirePermissionMetadata,
} from "./decorators/require-permission.decorator";
import { roleHasPermission } from "./permissions.matrix";

const COMPANY_HEADER = "x-company-id";

/**
 * Global guard. Enforces `@RequirePermission(...)` against the user's role
 * in the active company. Routes without the decorator pass through.
 *
 * Because this is a global guard it runs BEFORE controller-scoped guards
 * (like CompanyGuard). When `request.company` isn't set yet, this guard
 * resolves the company context itself from the `X-Company-Id` header or
 * the user's default company — the same logic CompanyGuard uses — and
 * attaches it to `request.company` so downstream code still works.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RequirePermissionMetadata | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!meta) return true; // No permission required — allow.

    const request = context.switchToHttp().getRequest<
      Request & {
        user?: AuthenticatedUser;
        company?: CompanyContext;
        params: Record<string, string>;
      }
    >();
    const user = request.user;
    if (!user) throw new UnauthorizedException();

    const companyId = await this.resolveCompanyId(request, meta, user.userId);
    if (!companyId) {
      throw new ForbiddenException("No company context for permission check");
    }

    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.userId, companyId } },
      include: { role: { select: { code: true } } },
    });
    if (!access) {
      throw new ForbiddenException("Access denied");
    }

    if (!roleHasPermission(access.role.code, meta.permission)) {
      throw new ForbiddenException(`Requires permission: ${meta.permission}`);
    }

    // Ensure request.company is populated for @CurrentCompany() downstream,
    // in case CompanyGuard hasn't run yet.
    if (!request.company) {
      request.company = { companyId: access.companyId, roleCode: access.role.code };
    }

    return true;
  }

  /**
   * Resolve the company ID for permission checking. Tries, in order:
   *   1. Explicit URL param (from `@RequirePermission('x', { companyIdParam })`)
   *   2. `request.company` (already set by CompanyGuard if it ran first)
   *   3. `X-Company-Id` header
   *   4. User's default company
   */
  private async resolveCompanyId(
    request: {
      headers: Record<string, string | string[] | undefined>;
      params: Record<string, string>;
      company?: CompanyContext;
    },
    meta: RequirePermissionMetadata,
    userId: string,
  ): Promise<string | undefined> {
    if (meta.options.companyIdParam) {
      return request.params[meta.options.companyIdParam];
    }
    if (request.company?.companyId) {
      return request.company.companyId;
    }

    // CompanyGuard (controller-scoped) hasn't run yet — resolve inline.
    const headerValue = request.headers[COMPANY_HEADER];
    const fromHeader = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (fromHeader) return fromHeader;

    // Fall back to user's default company.
    const defaultAccess = await this.prisma.userCompanyAccess.findFirst({
      where: { userId, isDefault: true },
      select: { companyId: true },
    });
    return defaultAccess?.companyId;
  }
}
