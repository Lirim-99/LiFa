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

/**
 * Global guard. Enforces `@RequirePermission(...)` against the user's role
 * in the active company. Routes without the decorator pass through.
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

    const companyId = this.resolveCompanyId(request, meta);
    if (!companyId) {
      throw new ForbiddenException("No company context for permission check");
    }

    const access = await this.prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId: user.userId, companyId } },
      include: { role: { select: { code: true } } },
    });
    if (!access) {
      // 404-style: hide that the company exists by reporting Forbidden — and
      // the absence of access is itself a permission denial.
      throw new ForbiddenException("Access denied");
    }

    if (!roleHasPermission(access.role.code, meta.permission)) {
      throw new ForbiddenException(`Requires permission: ${meta.permission}`);
    }
    return true;
  }

  private resolveCompanyId(
    request: { params: Record<string, string>; company?: CompanyContext },
    meta: RequirePermissionMetadata,
  ): string | undefined {
    if (meta.options.companyIdParam) {
      return request.params[meta.options.companyIdParam];
    }
    return request.company?.companyId;
  }
}
